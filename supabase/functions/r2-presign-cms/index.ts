/// <reference path="./shims.d.ts" />
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

// Limits (mirror property images limits)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_FILES_PER_REQUEST = 10
const TOTAL_SIZE_CAP = 50 * 1024 * 1024 // 50MB per request
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

function badRequest(body: any, status = 400) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
}

Deno.serve({ permissions: { net: ['*.r2.cloudflarestorage.com', '*.supabase.co'] } }, async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''

  console.log('[r2-presign-cms] env check', {
    supabaseUrlPresent: !!supabaseUrl,
    hasServiceRole: !!serviceRole,
  })

  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')
  const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
  const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const R2_BUCKET = Deno.env.get('R2_BUCKET')
  const R2_PUBLIC_BASE_URL = Deno.env.get('R2_PUBLIC_BASE_URL') // e.g., https://cdn.splitspace.com

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error('[r2-presign-cms] missing R2 config', {
      hasAccountId: !!R2_ACCOUNT_ID,
      hasAccessKey: !!R2_ACCESS_KEY_ID,
      hasSecret: !!R2_SECRET_ACCESS_KEY,
      hasBucket: !!R2_BUCKET,
    })
    return badRequest({ error: 'R2 is not configured. Missing one of R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET' }, 500)
  }

  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  } as const

  const supabaseAuth = createClient(supabaseUrl, serviceRole, clientOptions)
  const supabaseAdmin = createClient(supabaseUrl, serviceRole, clientOptions)

  // Parse body
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    console.warn('[r2-presign-cms] invalid JSON body', e)
    return badRequest({ error: 'Invalid JSON body' })
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[r2-presign-cms] missing Authorization header')
    return badRequest({ error: 'Missing Authorization' }, 401)
  }
  const jwt = authHeader.replace('Bearer ', '')
  const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(jwt)
  if (authErr || !userData?.user) {
    console.error('[r2-presign-cms] auth error', { authErr })
    return badRequest({ error: 'Unauthorized' }, 401)
  }
  const userId = userData.user.id
  console.log('[r2-presign-cms] authenticated user', { userId })

  let isAdmin = Boolean(
    (userData.user.app_metadata && (userData.user.app_metadata as Record<string, unknown>).is_admin) ??
      (userData.user.user_metadata && (userData.user.user_metadata as Record<string, unknown>).is_admin)
  )

  if (!isAdmin) {
    // Admin guard for CMS uploads (direct REST fetch with service role to bypass RLS)
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=is_admin`, {
      method: 'GET',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Accept: 'application/json',
      },
    })

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text()
      console.warn('[r2-presign-cms] failed to load profile via REST', {
        userId,
        status: profileResponse.status,
        errorText,
      })
      return badRequest({ error: 'Forbidden' }, 403)
    }

    const profileRows = (await profileResponse.json()) as Array<{ is_admin: boolean }>
    const profile = profileRows?.[0] || null
    console.log('[r2-presign-cms] profile lookup', { userId, profile })
    isAdmin = Boolean(profile?.is_admin)
  }

  if (!isAdmin) {
    console.warn('[r2-presign-cms] forbidden: admin claim not present', {
      userId,
      appMetadata: userData.user.app_metadata,
    })
    return badRequest({ error: 'Forbidden' }, 403)
  }

  const { files } = body || {}
  if (!Array.isArray(files)) {
    return badRequest({ error: 'files[] are required' })
  }

  // Enforce limits
  if (files.length === 0) return badRequest({ error: 'No files provided' })
  if (files.length > MAX_FILES_PER_REQUEST) return badRequest({ error: `Too many files: max ${MAX_FILES_PER_REQUEST}` })
  const totalSize = files.reduce((acc: number, f: any) => acc + (Number(f.size) || 0), 0)
  if (totalSize > TOTAL_SIZE_CAP) return badRequest({ error: `Total size exceeds ${Math.round(TOTAL_SIZE_CAP / 1024 / 1024)}MB` })
  for (const f of files) {
    const sz = Number(f.size) || 0
    const mime = String(f.mime || '')
    if (sz <= 0 || sz > MAX_IMAGE_SIZE) return badRequest({ error: `File too large: max ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB` })
    if (!ALLOWED_IMAGE_MIME.has(mime)) return badRequest({ error: `Unsupported type: ${mime}` })
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

  // Create signed PUT URLs under cms/ prefix
  const uploads: Array<{ key: string; putUrl: string; contentType: string; publicUrl?: string }> = []
  for (const f of files) {
    const originalName: string = String(f.filename || 'upload')
    const mime: string = String(f.mime || 'application/octet-stream')
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin'
    const key = `cms/${randomUUID()}.${ext}`

    const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: mime })
    const putUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 }) // 10 minutes
    const publicUrl = R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL}/${key}` : undefined

    uploads.push({ key, putUrl, contentType: mime, publicUrl })
  }

  return new Response(
    JSON.stringify({ bucket: R2_BUCKET, uploads }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})