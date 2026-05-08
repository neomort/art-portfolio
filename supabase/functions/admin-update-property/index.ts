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
  const log = createLogger({ function: 'admin-update-property', correlationId: cid })

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

    const propertyId = payload?.property_id as string | undefined
    const updates = payload?.updates as Record<string, unknown> | undefined
    const schedule = payload?.schedule as Record<string, unknown> | null | undefined

    if (!propertyId) {
      return json(400, { error: 'property_id is required' })
    }
    if (!updates || typeof updates !== 'object') {
      return json(400, { error: 'updates object is required' })
    }

    const { data: existingProperty, error: propertyErr } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyErr) {
      log.error('property_lookup_failed', { error: propertyErr.message, propertyId })
      return json(500, { error: 'Failed to load property' })
    }

    if (!existingProperty) {
      log.warn('property_missing', { propertyId })
      return json(404, { error: 'Property not found' })
    }

    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue
      if (value === undefined) continue
      cleanUpdates[key] = value
    }

    if (!('updated_at' in cleanUpdates)) {
      cleanUpdates.updated_at = new Date().toISOString()
    }

    const { data: updatedProperty, error: updateErr } = await supabaseAdmin
      .from('properties')
      .update(cleanUpdates)
      .eq('id', propertyId)
      .select()
      .single()

    if (updateErr) {
      log.error('property_update_failed', { propertyId, error: updateErr.message })
      return json(400, { error: 'Failed to update property', details: updateErr.message })
    }

    let scheduleError: string | null = null
    if (schedule && typeof schedule === 'object') {
      const schedulePayload = {
        property_id: propertyId,
        limit_availability: schedule.limit_availability ?? false,
        available_from: schedule.available_from ?? null,
        available_until: schedule.available_until ?? null,
        daily_schedule: schedule.daily_schedule ?? null,
      }

      const { error: scheduleUpsertError } = await supabaseAdmin
        .from('property_schedule')
        .upsert(schedulePayload, { onConflict: 'property_id' })

      if (scheduleUpsertError) {
        scheduleError = scheduleUpsertError.message
        log.warn('schedule_upsert_failed', { propertyId, error: scheduleUpsertError.message })
      }
    }

    log.info('property_updated_via_admin', { propertyId })
    return json(200, { ok: true, property: updatedProperty, schedule_error: scheduleError })
  } catch (err) {
    log.error('unexpected_error', { error: String(err) })
    return json(500, { error: 'Unexpected error' })
  }
})
