// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { z } from 'npm:zod'
import { createLogger } from '../_shared/logger.ts'

const DEFAULT_FRONTEND = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
const FRONTEND_URLS = (Deno.env.get('FRONTEND_URLS') || '').split(',').map(s => s.trim()).filter(Boolean)
const ALLOWED_ORIGINS = new Set([DEFAULT_FRONTEND, ...FRONTEND_URLS])

function isOriginAllowed(req: Request) {
  const reqOrigin = req.headers.get('origin') || ''
  if (!reqOrigin) return true // allow non-browser or same-origin requests lacking Origin
  if (ALLOWED_ORIGINS.has('*')) return true
  return ALLOWED_ORIGINS.has(reqOrigin)
}

function getCorsHeaders(req: Request) {
  const reqOrigin = req.headers.get('origin') || ''
  const allowWildcard = ALLOWED_ORIGINS.has('*')
  const allowed = allowWildcard || (reqOrigin && ALLOWED_ORIGINS.has(reqOrigin))
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Vary': 'Origin',
  }
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = reqOrigin
  }
  return headers
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_IMAGES_PER_PROPERTY = 30
// Rate limit thresholds
const LIMIT_PER_MINUTE = Number(Deno.env.get('MINT_UPLOAD_PER_MINUTE') || 30)
const LIMIT_PER_HOUR = Number(Deno.env.get('MINT_UPLOAD_PER_HOUR') || 200)
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const BodySchema = z.object({
  propertyId: z.string().min(1),
  files: z.array(
    z.object({
      filename: z.string().min(1),
      size: z.number().int().positive().max(MAX_SIZE),
      mime: z.string().refine((m) => ALLOWED_MIME.has(m), 'Unsupported MIME type'),
    })
  ).min(1).max(10),
})

Deno.serve({ permissions: { net: ['*.supabase.co'] } }, async (req) => {
  // Generate or propagate a per-request correlation ID
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'mint-upload-url', correlationId: cid })
  const started = performance.now()

  // Small request-scoped helpers
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'X-Correlation-Id': cid }, status }
    )
  const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
    json(status, { error: message, ...extra })
  const corsOk = () => new Response('ok', { headers: { ...getCorsHeaders(req), 'X-Correlation-Id': cid } })

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req)) {
      log.warn('cors_preflight_forbidden', { origin: req.headers.get('origin') || '' })
      return new Response('Forbidden', { status: 403, headers: { 'X-Correlation-Id': cid, 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' } })
    }
    log.info('cors_preflight_ok', { origin: req.headers.get('origin') || '' })
    return corsOk()
  }

  try {
    // Fail-closed CORS for unknown origins
    if (!isOriginAllowed(req)) {
      log.warn('cors_forbidden', { origin: req.headers.get('origin') || '' })
      return error(403, 'CORS: origin not allowed')
    }
    log.info('request_received', { origin: req.headers.get('origin') || '', method: req.method })
    const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY_ENV = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL_ENV || !SUPABASE_ANON_KEY_ENV) {
      log.error('env_missing', { hasUrl: !!SUPABASE_URL_ENV, hasAnon: !!SUPABASE_ANON_KEY_ENV })
      return error(500, 'Server configuration error')
    }
    const supabaseClient = createClient(
      SUPABASE_URL_ENV,
      SUPABASE_ANON_KEY_ENV,
    )

    // Auth via bearer token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      log.warn('auth_missing')
      return error(400, 'Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    // Validate JWT directly with GoTrue to avoid client/env issues
    const goTrueUrl = `${SUPABASE_URL_ENV}/auth/v1/user`
    const apikey = SUPABASE_ANON_KEY_ENV
    // Safe diagnostics
    const tokenLen = token.length
    let exp: number | null = null
    let sub: string | null = null
    let aud: string | null = null
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0
        const payload = JSON.parse(atob(b64 + '='.repeat(pad)))
        if (typeof payload.exp === 'number') exp = payload.exp
        if (typeof payload.sub === 'string') sub = payload.sub
        if (typeof payload.aud === 'string') aud = payload.aud
      }
    } catch {}
    const nowSecAuth = Math.floor(Date.now() / 1000)
    log.info('auth_debug', { tokenLen, goTrueUrl, hasApikey: !!apikey, exp, sub, aud, now: nowSecAuth, expDelta: exp ? (exp - nowSecAuth) : null })
    const authResp = await fetch(goTrueUrl, {
      headers: { 'apikey': apikey, 'Authorization': `Bearer ${token}` },
    })
    if (!authResp.ok) {
      const msg = await authResp.text().catch(() => '')
      log.warn('auth_failed', { status: authResp.status, msg })
      return error(401, 'Invalid JWT')
    }
    const userJson = await authResp.json().catch(() => null)
    if (!userJson?.id) {
      log.warn('auth_failed', { err: 'no_user' })
      return error(401, 'Authentication failed: No user found')
    }
    const userId = userJson.id as string

    // Ensure Supabase client operates under user's RLS context
    try {
      // @ts-ignore
      supabaseClient.auth.setAuth(token)
    } catch (e) {
      log.warn('set_auth_failed', { err: String(e) })
    }

    // Determine request IP (best-effort)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown'

    // Parse and validate body
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      log.warn('validation_failed', { issues: parsed.error.flatten() })
      return json(400, { error: 'Invalid request', details: parsed.error.flatten() })
    }

    const { propertyId, files } = parsed.data
    log.info('request_validated', { propertyId, filesCount: files.length })

    // Verify property exists and is owned by the authenticated user
    const { data: propRow, error: propErr } = await supabaseClient
      .from('properties')
      .select('id, venue_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propErr) throw propErr
    if (!propRow) {
      log.warn('property_not_found', { propertyId })
      return error(404, 'Property not found')
    }
    if (propRow.venue_id !== userId) {
      log.warn('forbidden_not_owner', { propertyId, owner: propRow.venue_id, userId })
      return error(403, 'Forbidden: you do not own this property')
    }

    // Enforce per-property image cap by listing existing images in storage
    const bucket = 'property-images'
    const folderPath = `properties/${userId}/${propertyId}`
    const { data: existingFiles, error: listErr } = await supabaseClient.storage
      .from(bucket)
      .list(folderPath, { limit: 1000 })

    if (listErr) throw listErr
    const existingCount = existingFiles?.length ?? 0
    log.info('storage_listed', { folderPath, existingCount })
    if (existingCount + files.length > MAX_IMAGES_PER_PROPERTY) {
      log.warn('image_cap_exceeded', { cap: MAX_IMAGES_PER_PROPERTY, existingCount, incoming: files.length })
      return error(409, `Image limit exceeded: ${MAX_IMAGES_PER_PROPERTY} per property`)
    }

    // Rate limit: per-user and per-IP, rolling windows
    const nowMs = Date.now()
    const oneMinuteAgo = new Date(nowMs - 60_000).toISOString()
    const oneHourAgo = new Date(nowMs - 3_600_000).toISOString()

    const fn = 'mint-upload-url'

    // Count per-user
    const { count: minuteUserCount, error: minuteUserErr } = await supabaseClient
      .from('edge_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('function', fn)
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo)

    if (minuteUserErr) throw minuteUserErr

    if ((minuteUserCount ?? 0) >= LIMIT_PER_MINUTE) {
      log.warn('rate_limit_user_minute', { count: minuteUserCount, limit: LIMIT_PER_MINUTE })
      return error(429, 'Too many requests (per-minute user limit)')
    }

    const { count: hourUserCount, error: hourUserErr } = await supabaseClient
      .from('edge_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('function', fn)
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)

    if (hourUserErr) throw hourUserErr
    if ((hourUserCount ?? 0) >= LIMIT_PER_HOUR) {
      log.warn('rate_limit_user_hour', { count: hourUserCount, limit: LIMIT_PER_HOUR })
      return error(429, 'Too many requests (per-hour user limit)')
    }

    // Count per-IP
    const { count: minuteIpCount, error: minuteIpErr } = await supabaseClient
      .from('edge_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('function', fn)
      .eq('ip', ip)
      .gte('created_at', oneMinuteAgo)

    if (minuteIpErr) throw minuteIpErr
    if ((minuteIpCount ?? 0) >= LIMIT_PER_MINUTE) {
      log.warn('rate_limit_ip_minute', { count: minuteIpCount, limit: LIMIT_PER_MINUTE, ip })
      return error(429, 'Too many requests (per-minute IP limit)')
    }

    const { count: hourIpCount, error: hourIpErr } = await supabaseClient
      .from('edge_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('function', fn)
      .eq('ip', ip)
      .gte('created_at', oneHourAgo)

    if (hourIpErr) throw hourIpErr
    if ((hourIpCount ?? 0) >= LIMIT_PER_HOUR) {
      log.warn('rate_limit_ip_hour', { count: hourIpCount, limit: LIMIT_PER_HOUR, ip })
      return error(429, 'Too many requests (per-hour IP limit)')
    }

    // Generate signed upload URLs
    const results: Array<{ path: string; token: string }> = []

    for (const f of files) {
      const ext = EXT_FOR_MIME[f.mime] || 'bin'
      const uuid = crypto.randomUUID()
      const path = `properties/${userId}/${propertyId}/${uuid}.${ext}`

      const { data, error } = await supabaseClient.storage.from(bucket).createSignedUploadUrl(path)
      if (error || !data) {
        throw new Error(`Failed to create signed upload URL: ${error?.message}`)
      }

      results.push({ path, token: data.token })
    }
    log.info('signed_urls_created', { count: results.length, bucket })

    // Log the successful mint to audit table (one log per request)
    await supabaseClient.from('edge_rate_limits').insert({
      user_id: userId,
      ip,
      function: fn,
    })
    log.info('audit_logged', { userId })

    const latencyMs = Math.round(performance.now() - started)
    log.info('success', { latencyMs, uploads: results.length })
    return json(200, { bucket, uploads: results })
  } catch (e) {
    const latencyMs = Math.round(performance.now() - started)
    log.error('handler_error', { latencyMs, err: String(e) })
    return error(500, 'Internal Server Error')
  }
})
