// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { createLogger } from '../_shared/logger.ts'

/*
POST /functions/v1/delete-organization
Headers:
  - Content-Type: application/json
  - Authorization: Bearer <JWT>
Body JSON:
  {
    "organization_id": "<uuid>"
  }

Authorization
- Caller must be platform admin (profiles.is_admin = true) OR an owner/admin member of the target org.
- Additional safety checks:
  - No members in public.organization_members
  - No invites in public.organization_member_invites
  - No properties in public.properties
  If any exist, returns 400 with details.
*/

const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = (Deno.env.get('FRONTEND_URL') || FALLBACK_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
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
  const log = createLogger({ function: 'delete-organization', correlationId: cid })

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json', 'X-Correlation-Id': cid }, status }
    )
  const corsOk = () => new Response('ok', { headers: { ...buildCorsHeaders(req), 'X-Correlation-Id': cid }, status: 200 })

  if (req.method === 'OPTIONS') return corsOk()

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) return json(401, { error: 'Not authenticated' })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
      Deno.env.get('SERVICE_ROLE_KEY') || ''
    )
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !authUser?.user) return json(401, { error: 'Not authenticated' })
    const callerId = authUser.user.id

    const body = await req.json()
    const organization_id = body.organization_id as string | undefined
    if (!organization_id) return json(400, { error: 'organization_id is required' })

    // Ensure org exists
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', organization_id)
      .single()
    if (orgErr || !org) return json(404, { error: 'Organization not found' })

    // Authorization
    let callerIsAdmin = false
    {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', callerId)
        .single()
      callerIsAdmin = !!prof?.is_admin
    }

    if (!callerIsAdmin) {
      const { data: om } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', callerId)
        .maybeSingle()
      if (!om || !(om.role === 'owner' || om.role === 'admin')) {
        return json(403, { error: 'Forbidden' })
      }
    }

    // Safety checks: no members, no invites, no properties
    const [{ count: memberCount }, { count: inviteCount }, { count: propertyCount }] = await Promise.all([
      supabaseAdmin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', organization_id),
      supabaseAdmin.from('organization_member_invites').select('*', { count: 'exact', head: true }).eq('organization_id', organization_id),
      supabaseAdmin.from('properties').select('*', { count: 'exact', head: true }).eq('organization_id', organization_id),
    ])

    if ((memberCount ?? 0) > 0) return json(400, { error: 'Cannot delete organization with members', members: memberCount })
    if ((inviteCount ?? 0) > 0) return json(400, { error: 'Cannot delete organization with pending invites', invites: inviteCount })
    if ((propertyCount ?? 0) > 0) return json(400, { error: 'Cannot delete organization with properties', properties: propertyCount })

    // Delete organization
    const { error: delErr } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organization_id)
    if (delErr) return json(400, { error: 'Failed to delete organization', details: String(delErr) })

    log.info('organization_deleted', { organization_id })
    return json(200, { ok: true })
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: String(e) })
  }
})
