// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { createLogger } from '../_shared/logger.ts'

const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = (Deno.env.get('FRONTEND_URL') || FALLBACK_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const allow = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || FALLBACK_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  } as Record<string, string>
}

Deno.serve({ permissions: { net: ['*.supabase.co'] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'admin-update-profile', correlationId: cid })

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      {
        headers: {
          ...buildCorsHeaders(req),
          'Content-Type': 'application/json',
          'X-Correlation-Id': cid,
        },
        status,
      },
    )

  const corsOk = () =>
    new Response('ok', {
      headers: { ...buildCorsHeaders(req), 'X-Correlation-Id': cid },
      status: 200,
    })

  if (req.method === 'OPTIONS') return corsOk()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !serviceKey) {
      log.error('missing_env_config', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceKey })
      return json(500, { error: 'Server misconfiguration' })
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      log.warn('missing_auth_header')
      return json(401, { error: 'Not authenticated' })
    }
    const token = authHeader.slice('Bearer '.length)

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !authUser?.user) {
      log.warn('invalid_token', { error: authErr?.message })
      return json(401, { error: 'Not authenticated' })
    }

    const callerId = authUser.user.id
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', callerId)
      .maybeSingle()

    if (callerProfileErr) {
      log.error('caller_profile_lookup_failed', { error: callerProfileErr.message })
      return json(500, { error: 'Unable to verify caller' })
    }

    if (callerProfile?.is_admin !== true) {
      log.warn('caller_not_admin')
      return json(403, { error: 'Forbidden' })
    }

    let payload: Record<string, unknown>
    try {
      payload = await req.json()
    } catch (err) {
      log.warn('invalid_json', { error: String(err) })
      return json(400, { error: 'Invalid JSON body' })
    }

    const targetUserId = payload?.user_id as string | undefined
    const profileUpdates = payload?.updates as Record<string, unknown> | undefined
    const organizationPayload = payload?.organization as Record<string, unknown> | undefined

    if (!targetUserId) {
      return json(400, { error: 'user_id is required' })
    }
    if (profileUpdates && typeof profileUpdates !== 'object') {
      return json(400, { error: 'updates must be an object if provided' })
    }

    const cleanUpdates: Record<string, unknown> = {}
    if (profileUpdates) {
      for (const [key, value] of Object.entries(profileUpdates)) {
        if (key === 'id') continue
        if (value === undefined) continue
        cleanUpdates[key] = value
      }
    }

    if (Object.keys(cleanUpdates).length && !('updated_at' in cleanUpdates)) {
      cleanUpdates.updated_at = new Date().toISOString()
    }

    let updatedProfile = null
    if (Object.keys(cleanUpdates).length) {
      const { data: updatedProfileData, error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update(cleanUpdates)
        .eq('id', targetUserId)
        .select()
        .single()

      if (updateErr) {
        log.error('profile_update_failed', { targetUserId, error: updateErr.message })
        return json(400, { error: 'Failed to update profile', details: updateErr.message })
      }
      updatedProfile = updatedProfileData
    } else {
      const { data: existingProfile, error: loadErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle()

      if (loadErr) {
        log.error('profile_lookup_failed', { targetUserId, error: loadErr.message })
        return json(500, { error: 'Failed to load profile after update' })
      }
      updatedProfile = existingProfile
    }

    let resultingOrgId = (updatedProfile as any)?.primary_organization_id ?? null

    if (organizationPayload && typeof organizationPayload === 'object') {
      const slugify = (value: string) =>
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

      const orgUpdates = organizationPayload?.updates as Record<string, unknown> | undefined
      const adjustments = Array.isArray(organizationPayload?.adjustments)
        ? (organizationPayload.adjustments as Array<{ type: string; data?: Record<string, unknown>; sort_order?: number }>)
        : null
      const currentOrgId = typeof organizationPayload?.current_id === 'string' && organizationPayload.current_id.length > 0
        ? (organizationPayload.current_id as string)
        : null
      const createPayload = organizationPayload?.create as Record<string, unknown> | undefined

      // If create payload provided, create new organization
      if (createPayload && typeof createPayload === 'object') {
        const name = String(createPayload.name || '').trim()
        if (!name) {
          return json(400, { error: 'Organization name is required to create organization' })
        }

        const baseSlug = slugify(name) || 'org'
        let slug = baseSlug
        let attempt = 2
        while (true) {
          const { data: existing, error: slugErr } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()
          if (slugErr) {
            log.warn('org_slug_check_failed', { error: slugErr.message })
            break
          }
          if (!existing) break
          slug = `${baseSlug}-${attempt++}`
        }

        const insertPayload = {
          name,
          slug,
          about_brand: createPayload.about_brand ?? '',
          business_type: createPayload.business_type ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data: newOrg, error: createErr } = await supabaseAdmin
          .from('organizations')
          .insert(insertPayload)
          .select()
          .single()

        if (createErr) {
          log.error('organization_create_failed', { error: createErr.message })
          return json(400, { error: 'Failed to create organization', details: createErr.message })
        }

        resultingOrgId = (newOrg as any)?.id ?? null

        const { error: linkErr } = await supabaseAdmin
          .from('profiles')
          .update({ primary_organization_id: resultingOrgId, updated_at: new Date().toISOString() })
          .eq('id', targetUserId)

        if (linkErr) {
          log.error('organization_link_failed', { error: linkErr.message })
          return json(400, { error: 'Failed to link profile to organization', details: linkErr.message })
        }

        updatedProfile = {
          ...updatedProfile,
          primary_organization_id: resultingOrgId,
        }
      }

      // Update existing organization if requested
      const orgIdToModify = resultingOrgId || currentOrgId
      if (orgIdToModify && orgUpdates && typeof orgUpdates === 'object') {
        const cleanOrgUpdates: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(orgUpdates)) {
          if (['id', 'organization_id'].includes(key)) continue
          cleanOrgUpdates[key] = value
        }
        if (Object.keys(cleanOrgUpdates).length) {
          cleanOrgUpdates.updated_at = new Date().toISOString()
          const { error: orgUpdateErr } = await supabaseAdmin
            .from('organizations')
            .update(cleanOrgUpdates)
            .eq('id', orgIdToModify)
          if (orgUpdateErr) {
            log.error('organization_update_failed', { error: orgUpdateErr.message, orgId: orgIdToModify })
            return json(400, { error: 'Failed to update organization', details: orgUpdateErr.message })
          }
        }
      }

      // Replace adjustments if provided
      if (orgIdToModify && Array.isArray(adjustments)) {
        const { error: deleteErr } = await supabaseAdmin
          .from('organization_adjustments')
          .delete()
          .eq('organization_id', orgIdToModify)
        if (deleteErr) {
          log.error('organization_adjustments_delete_failed', { error: deleteErr.message, orgId: orgIdToModify })
          return json(400, { error: 'Failed to reset organization adjustments', details: deleteErr.message })
        }

        const insertRows = adjustments
          .map((adj, idx) => ({
            organization_id: orgIdToModify,
            type: adj.type,
            data: adj.data ?? {},
            sort_order: typeof adj.sort_order === 'number' ? adj.sort_order : idx,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
          .filter((row) => row.type)

        if (insertRows.length > 0) {
          const { error: insertErr } = await supabaseAdmin
            .from('organization_adjustments')
            .insert(insertRows)
          if (insertErr) {
            log.error('organization_adjustments_insert_failed', { error: insertErr.message, orgId: orgIdToModify })
            return json(400, { error: 'Failed to save organization adjustments', details: insertErr.message })
          }
        }
      } else if (orgIdToModify && organizationPayload?.clear_adjustments === true) {
        const { error: deleteErr } = await supabaseAdmin
          .from('organization_adjustments')
          .delete()
          .eq('organization_id', orgIdToModify)
        if (deleteErr) {
          log.error('organization_adjustments_delete_failed', { error: deleteErr.message, orgId: orgIdToModify })
          return json(400, { error: 'Failed to clear organization adjustments', details: deleteErr.message })
        }
      }
    }

    log.info('profile_updated_via_admin', { targetUserId, resultingOrgId })
    return json(200, { ok: true, profile: updatedProfile, organization_id: resultingOrgId })
  } catch (err) {
    log.error('unexpected_error', { error: String(err) })
    return json(500, { error: 'Unexpected error' })
  }
})
