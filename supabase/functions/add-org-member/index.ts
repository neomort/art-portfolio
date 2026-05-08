// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { createLogger } from '../_shared/logger.ts'

/*
POST /functions/v1/add-org-member
Headers:
  - Content-Type: application/json
  - Authorization: Bearer <JWT>
Body JSON:
  {
    "organization_id": "<uuid>",
    // one of the following is required
    "user_id": "<uuid>",
    "email": "user@example.com",
    // optional, defaults to 'member'
    "role": "owner" | "admin" | "member"
  }

Notes:
- Requires authenticated caller.
- Authorization: caller must be profiles.is_admin=true OR an owner/admin in organization_members for the target organization.
- Resolves email to auth.users.id, ensures a profile row exists.
- Upserts into public.organization_members(organization_id, user_id, role).
*/

const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = (Deno.env.get('FRONTEND_URL') || FALLBACK_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  // In development, reflect the caller's Origin to avoid mismatch; in production, Frontend URL(s) should still be set.
  const allow = origin || allowedOrigins[0] || FALLBACK_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  } as Record<string, string>
}

Deno.serve({ permissions: { net: ["*.supabase.co"] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'add-org-member', correlationId: cid })

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json', 'X-Correlation-Id': cid }, status }
    )
  const corsOk = () => new Response('ok', { headers: { ...buildCorsHeaders(req), 'X-Correlation-Id': cid }, status: 200 })

  if (req.method === 'OPTIONS') return corsOk()

  try {
    // Extract bearer token
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) {
      log.warn('unauthenticated_request', { err: String(authErr) })
      return json(401, { error: 'Not authenticated' })
    }

    // Use admin client to validate token and get user id reliably in Edge Functions
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
      serviceKey
    )
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !authUser?.user) {
      log.warn('unauthenticated_request_token_invalid', { err: String(authErr) })
      return json(401, { error: 'Not authenticated' })
    }

    const callerId = authUser.user.id

    const body = await req.json()
    const organization_id = body.organization_id as string | undefined
    const user_id = body.user_id as string | undefined
    const email = body.email as string | undefined
    const role = (body.role as string | undefined) ?? 'member'

    if (!organization_id) return json(400, { error: 'organization_id is required' })
    if (!user_id && !email) return json(400, { error: 'Provide user_id or email' })
    if (!['owner','admin','member'].includes(role)) return json(400, { error: 'Invalid role' })

    // supabaseAdmin already defined above

    // 1) Ensure organization exists
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', organization_id)
      .single()
    if (orgErr || !org) return json(404, { error: 'Organization not found', details: orgErr?.message })

    // 2) Authorization: caller must be org owner/admin OR platform admin
    let callerIsAdmin = false
    {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', callerId)
        .single()
      if (!profErr && prof?.is_admin === true) callerIsAdmin = true
    }

    if (!callerIsAdmin) {
      const { data: om, error: omErr } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', callerId)
        .maybeSingle()
      if (omErr || !om || !(om.role === 'owner' || om.role === 'admin')) {
        log.warn('forbidden_caller_not_org_admin')
        return json(403, { error: 'Forbidden' })
      }
    }

    // 3) Resolve user id
    let resolvedUserId = user_id
    const findUserIdByEmail = async (emailToFind: string): Promise<string | null> => {
      const PER_PAGE = 200
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE })
        if (error) break
        const match = data?.users?.find(u => u.email?.toLowerCase() === emailToFind.toLowerCase())
        if (match) return match.id
        if (!data || data.users.length < PER_PAGE) break
      }
      return null
    }

    if (!resolvedUserId && email) {
      // Try to find existing auth user by walking pages
      const existingId = await findUserIdByEmail(email)
      if (existingId) {
        resolvedUserId = existingId
      }
    }

    // 4) If no resolved user id (no auth user), create a pending invite instead of creating an auth user
    if (!resolvedUserId) {
      const { data: invite, error: inviteErr } = await supabaseAdmin
        .from('organization_member_invites')
        .upsert({ organization_id, email, role, invited_by: callerId }, { onConflict: 'organization_id,email' })
        .select('id, organization_id, email, role, created_at')
        .single()
      if (inviteErr) return json(400, { error: 'Failed to create invite', details: String(inviteErr), step: 'organization_member_invites_upsert' })
      log.info('member_invited', { organization_id, email, role })
      return json(200, { ok: true, invited: true, invite })
    }

    // 5) Ensure profile exists for that user (most installs will already have it)
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', resolvedUserId)
      .maybeSingle()
    if (profErr) return json(400, { error: 'Failed to check profile', details: String(profErr) })
    if (!profile) {
      // Insert minimal row with only id to avoid unique email conflicts
      const { error: insProfErr } = await supabaseAdmin
        .from('profiles')
        .insert({ id: resolvedUserId })
      if (insProfErr) return json(400, { error: 'Failed to create profile', details: String(insProfErr) })
      // Best-effort update email if possible (ignore conflicts)
      if (email) {
        await supabaseAdmin
          .from('profiles')
          .update({ email })
          .eq('id', resolvedUserId)
      }
    }

    // 6) Upsert organization member
    const { data: member, error: upsertErr } = await supabaseAdmin
      .from('organization_members')
      .upsert({ organization_id, user_id: resolvedUserId, role }, { onConflict: 'organization_id,user_id' })
      .select('organization_id, user_id, role')
      .single()
    if (upsertErr) return json(400, { error: 'Failed to add member', details: String(upsertErr), step: 'organization_members_upsert' })

    log.info('member_added', { organization_id, user_id: resolvedUserId, role })
    return json(200, { ok: true, member, organization: org })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: String(e) })
  }
})
