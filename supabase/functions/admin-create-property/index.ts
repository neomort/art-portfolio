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

Deno.serve({ permissions: { net: ['*.supabase.co'] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'admin-create-property', correlationId: cid })

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

    const property = payload?.property as Record<string, unknown> | undefined
    const rawSchedule = payload?.schedule as Record<string, unknown> | null | undefined
    const explicitTargetUser = payload?.target_user_id as string | undefined

    if (!property || typeof property !== 'object') {
      return json(400, { error: 'property object is required' })
    }

    const targetUserId = explicitTargetUser || (property?.venue_id as string | undefined)
    if (!targetUserId) {
      return json(400, { error: 'target_user_id is required' })
    }

    const { data: targetProfile, error: targetProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, primary_organization_id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (targetProfileErr) {
      log.error('target_profile_lookup_failed', { error: targetProfileErr.message })
      return json(500, { error: 'Unable to load target profile' })
    }

    if (!targetProfile) {
      log.warn('target_user_missing', { targetUserId })
      return json(404, { error: 'Target user not found' })
    }

    const organizationId = property?.organization_id ?? targetProfile.primary_organization_id ?? null
    if (!organizationId) {
      return json(400, { error: 'organization_id is required for property creation' })
    }

    const nowIso = new Date().toISOString()
    const cleanProperty: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(property)) {
      if (key === 'id') continue
      if (value === undefined) continue
      cleanProperty[key] = value
    }

    cleanProperty['venue_id'] = targetUserId
    cleanProperty['organization_id'] = organizationId
    if (!Array.isArray(cleanProperty['images'])) {
      cleanProperty['images'] = []
    }
    cleanProperty['created_at'] = cleanProperty['created_at'] ?? nowIso
    cleanProperty['updated_at'] = nowIso

    const { data: insertedProperty, error: insertError } = await supabaseAdmin
      .from('properties')
      .insert(cleanProperty)
      .select()
      .single()

    if (insertError) {
      log.error('property_insert_failed', { error: insertError.message })
      return json(400, { error: 'Failed to create property', details: insertError.message })
    }

    let scheduleError: string | null = null
    if (rawSchedule && typeof rawSchedule === 'object') {
      const schedulePayload = {
        property_id: insertedProperty.id,
        limit_availability: rawSchedule.limit_availability ?? false,
        available_from: rawSchedule.available_from ?? null,
        available_until: rawSchedule.available_until ?? null,
        daily_schedule: rawSchedule.daily_schedule ?? null,
      }

      const { error: scheduleUpsertError } = await supabaseAdmin
        .from('property_schedule')
        .upsert(schedulePayload, { onConflict: 'property_id' })

      if (scheduleUpsertError) {
        scheduleError = scheduleUpsertError.message
        log.warn('schedule_upsert_failed', { error: scheduleUpsertError.message, propertyId: insertedProperty.id })
      }
    }

    log.info('property_created_via_admin', { propertyId: insertedProperty.id, targetUserId })
    return json(200, { ok: true, property: insertedProperty, schedule_error: scheduleError })
  } catch (err) {
    log.error('unexpected_error', { error: String(err) })
    return json(500, { error: 'Unexpected error' })
  }
})
