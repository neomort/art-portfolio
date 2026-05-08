/// <reference lib="deno.ns" />
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'

// CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Limits (mirrors src/lib/fileValidation.ts)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_FILES_PER_REQUEST = 30
const TOTAL_SIZE_CAP = 300 * 1024 * 1024 // 300MB per request
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'application/x-rtf',
])

function badRequest(body: any, status = 400) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
}

Deno.serve({ permissions: { net: ['*.r2.cloudflarestorage.com', '*.supabase.co'] } }, async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    // Minimal structured logging
    const reqId = randomUUID()
    const startedAt = Date.now()
    const log = (event: string, extra: Record<string, any> = {}) => {
      try {
        console.log(JSON.stringify({ fn: 'r2-presign', event, reqId, t: new Date().toISOString(), ...extra }))
      } catch {}
    }
    log('request_start', { method: req.method, url: req.url })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    // Log minimal env diagnostics (no secrets)
    let urlHost = 'invalid'
    try { urlHost = new URL(supabaseUrl).host } catch {}
    log('env_check', { urlHost, hasUrl: !!supabaseUrl, hasServiceRole: !!serviceKey })

    // Early guard: ensure required envs exist to avoid runtime throws without CORS
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing SUPABASE_URL or SERVICE_ROLE_KEY' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')
  const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
  const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const R2_BUCKET = Deno.env.get('R2_BUCKET')
  const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL') // e.g., https://cdn.splitspace.com

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    log('config_error', { missing: 'R2 envs' })
    return badRequest({ error: 'R2 is not configured. Missing one of R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Parse body with resilience: json -> text -> X-JSON-Payload header
  let body: any
  try {
    body = await req.json()
  } catch (_e) {
    try {
      const raw = await req.text()
      if (raw && raw.trim().length > 0) {
        try { body = JSON.parse(raw) } catch {
          log('parse_error', { message: 'Invalid JSON from text()' })
          return badRequest({ error: 'Invalid JSON body' })
        }
      } else {
        const hdr = req.headers.get('X-JSON-Payload') || req.headers.get('x-json-payload')
        if (hdr && hdr.trim().length > 0) {
          try { body = JSON.parse(hdr) } catch {
            log('parse_error', { message: 'Invalid JSON from X-JSON-Payload' })
            return badRequest({ error: 'Invalid JSON body' })
          }
        } else {
          log('parse_error', { message: 'Empty body' })
          return badRequest({ error: 'Empty body' })
        }
      }
    } catch (e2) {
      log('parse_error', { message: 'Invalid JSON body (text fallback failed)' })
      return badRequest({ error: 'Invalid JSON body' })
    }
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    log('auth_error', { reason: 'missing_authorization_header' })
    return badRequest({ error: 'Missing Authorization' }, 401)
  }
  const jwt = authHeader.replace('Bearer ', '')
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !userData?.user) {
    log('auth_error', { reason: 'invalid_user' })
    return badRequest({ error: 'Unauthorized' }, 401)
  }
  const userId = userData.user.id

  const { propertyId, files, venueId: bodyVenueId, organizationId: bodyOrgId } = body || {}
  if (!propertyId || !Array.isArray(files)) {
    log('validation_error', { reason: 'missing_propertyId_or_files' })
    return badRequest({ error: 'propertyId and files[] are required' })
  }

  // Enforce limits
  if (files.length === 0) return badRequest({ error: 'No files provided' })
  if (files.length > MAX_FILES_PER_REQUEST) return badRequest({ error: `Too many files: max ${MAX_FILES_PER_REQUEST}` })
  const totalSize = files.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0)
  if (totalSize > TOTAL_SIZE_CAP) return badRequest({ error: `Total size exceeds ${Math.round(TOTAL_SIZE_CAP / 1024 / 1024)}MB` })
  for (const f of files) {
    const sz = Number(f.size) || 0
    const mime = String(f.mime || '')
    if (sz <= 0 || sz > MAX_FILE_SIZE) return badRequest({ error: `File too large: max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB` })
    if (!ALLOWED_MIME.has(mime)) return badRequest({ error: `Unsupported type: ${mime}` })
  }

  // Authorization: ensure user can upload for this property (check organization membership)
  // Add a short retry loop to tolerate replica lag right after insert
  const fetchPropertyWithRetry = async (attempts = 6) => {
    let lastErr: any = null
    for (let i = 1; i <= attempts; i++) {
      const { data: p, error: e } = await supabase
        .from('properties')
        .select('id, venue_id, organization_id')
        .eq('id', propertyId)
        .single()
      if (!e && p) return { prop: p }
      lastErr = e
      // backoff 200ms, 400ms, 600ms
      const delay = Math.min(150 * i * i, 1200)
      log('property_retry', { attempt: i, delayMs: delay, error: e?.message || String(e || '') })
      await new Promise((res) => setTimeout(res, delay))
    }
    return { error: lastErr }
  }

  let propLike: { id: string; venue_id: string | null; organization_id: string | null } | null = null
  const { prop, error: propErr } = await fetchPropertyWithRetry()
  if (propErr || !prop) {
    // Additional diagnostics: HEAD count
    try {
      const { count, error: cntErr } = await supabase
        .from('properties')
        .select('id', { head: true, count: 'exact' })
        .eq('id', propertyId)
      log('property_count_diag', { propertyId, count: count ?? null, error: cntErr?.message || null })
    } catch {}
    // Attempt a secure auth fallback using provided venueId / organizationId
    let authorized = false
    const fallbackVenue = typeof bodyVenueId === 'string' && bodyVenueId.length > 0 ? bodyVenueId : null
    const fallbackOrg = typeof bodyOrgId === 'string' && bodyOrgId.length > 0 ? bodyOrgId : null
    try {
      if (fallbackVenue && fallbackVenue === userId) {
        authorized = true
      } else if (fallbackOrg) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', fallbackOrg)
          .eq('user_id', userId)
          .single()
        authorized = !!(membership && ['owner', 'admin', 'member'].includes(membership.role))
      }
    } catch (e) {
      log('auth_fallback_error', { error: (e as any)?.message || String(e || '') })
    }

    if (!authorized) {
      log('property_not_found', { propertyId })
      const diagHeaders = {
        'X-R2-Presign-Build': 'diag-1',
        'X-Env-Host': urlHost,
        // Use the defined serviceKey for diagnostics instead of undefined serviceRole
        'X-Has-ServiceRole': String(!!serviceKey),
      }
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...diagHeaders },
        status: 404,
      })
    }

    // Proceed using fallback identity for auth only
    log('auth_fallback_used', { propertyId, hasVenue: !!fallbackVenue, hasOrg: !!fallbackOrg })
    propLike = { id: propertyId, venue_id: fallbackVenue, organization_id: fallbackOrg }
  } else {
    propLike = prop
  }
  
  // Check if user is the venue owner OR a member of the organization
  let hasAccess = propLike!.venue_id === userId
  
  if (!hasAccess && propLike!.organization_id) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', propLike!.organization_id)
      .eq('user_id', userId)
      .single()
    
    hasAccess = membership && ['owner', 'admin', 'member'].includes(membership.role)
  }
  
  if (!hasAccess) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle()

      if (profile?.is_admin === true) {
        hasAccess = true
        log('admin_override', { propertyId, userId })
      }
    } catch (err) {
      log('admin_check_error', { error: (err as any)?.message || String(err || '') })
    }
  }

  if (!hasAccess) {
    log('forbidden', { propertyId, userId })
    return badRequest({ error: 'Forbidden' }, 403)
  }

  // Prepare S3 client for R2
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  })

  // Create signed PUT URLs
  const uploads: Array<{ key: string; putUrl: string; contentType: string; publicUrl?: string }> = []
  for (const f of files) {
    const originalName: string = String(f.filename || 'upload')
    const mime: string = String(f.mime || 'application/octet-stream')
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin'
    const key = `properties/${propertyId}/${randomUUID()}.${ext}`

    const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: mime })
    const putUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 }) // 10 minutes
    const publicUrl = R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL}/${key}` : undefined

    uploads.push({ key, putUrl, contentType: mime, publicUrl })
  }

  const durationMs = Date.now() - startedAt
  log('success', { propertyId, files: files.length, durationMs })
  const diagHeaders = {
    'X-R2-Presign-Build': 'diag-1',
    'X-Env-Host': urlHost,
    // Use the defined serviceKey for diagnostics instead of undefined serviceRole
    'X-Has-ServiceRole': String(!!serviceKey),
  }
  return new Response(JSON.stringify({ bucket: R2_BUCKET, uploads }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...diagHeaders },
    status: 200,
  })
  } catch (e) {
    // Last-resort error handler to ensure CORS headers are present
    try {
      console.error(JSON.stringify({ fn: 'r2-presign', event: 'unhandled_error', t: new Date().toISOString(), error: (e as any)?.message || String(e || '') }))
    } catch {}
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
