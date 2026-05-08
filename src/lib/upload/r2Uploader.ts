import { SupabaseClient } from '@supabase/supabase-js'
import { validateImagesBatch } from '../fileValidation'
import { compressImagesBatch } from '../imageCompression'
import { getLogger } from '../logger'

const log = getLogger({ module: 'r2Uploader' })

type PresignUpload = {
  key: string
  putUrl: string
  contentType: string
  publicUrl?: string
}

type PresignPayload = {
  propertyId: string
  venueId: string | null | undefined
  organizationId: string | null
  files: Array<{ filename: string; size: number; mime: string }>
}

const MAX_UPLOADS_PER_BATCH = 30

const requestPresignedUploads = async (
  supabase: SupabaseClient,
  payload: PresignPayload,
): Promise<PresignUpload[]> => {
  const maxAttempts = 8
  let lastStatus: number | null = null
  let lastMessage = 'Unknown error'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: payload,
    })

    if (!error && Array.isArray((data as any)?.uploads)) {
      return (data as any).uploads as PresignUpload[]
    }

    lastStatus = error?.status ?? (data as any)?.status ?? null
    lastMessage = error?.message ?? (data as any)?.message ?? 'Unknown error'

    if (lastStatus === 404 && attempt < maxAttempts) {
      const delayMs = Math.min(200 * Math.pow(2, attempt - 1), 2000)
      log.warn('r2-presign returned 404; retrying after backoff', {
        attempt,
        delayMs,
        status: lastStatus,
        message: lastMessage,
      })
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }

    break
  }

  throw new Error(`Failed to prepare uploads: ${lastMessage} (status ${lastStatus ?? 'unknown'})`)
}

const putUploads = async (files: File[], uploads: PresignUpload[], resourceLabel: 'image' | 'file') => {
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const { putUrl, contentType, publicUrl } = uploads[i]

    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || file.type || 'application/octet-stream',
      },
      body: file,
    })

    if (!response.ok) {
      log.error('Failed to upload to R2', { status: response.status })
      throw new Error(`Failed to upload ${resourceLabel} (status ${response.status})`)
    }

    if (!publicUrl) {
      log.warn('R2 public URL missing; ensure R2_PUBLIC_BASE_URL is set')
      throw new Error('Upload succeeded but URL generation failed; contact support')
    }

    urls.push(publicUrl)
  }

  return urls
}

const resolveOrganizationId = async (
  supabase: SupabaseClient,
  propertyId: string,
  fallbackOrganizationId: string | null,
): Promise<string | null> => {
  if (fallbackOrganizationId) {
    return fallbackOrganizationId
  }

  try {
    const { data } = await supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .maybeSingle()

    return (data as any)?.organization_id ?? null
  } catch {
    return null
  }
}

export async function uploadPropertyImages(
  supabase: SupabaseClient,
  propertyId: string,
  files: File[],
  options?: { organizationId?: string | null; actingUserId?: string | null },
): Promise<string[]> {
  if (files.length > MAX_UPLOADS_PER_BATCH) {
    throw new Error(`You can only upload a maximum of ${MAX_UPLOADS_PER_BATCH} files at a time`)
  }
  const batch = await validateImagesBatch(files)
  if (!batch.ok) {
    throw new Error(`Image validation failed:\n- ${batch.reasons.join('\n- ')}`)
  }

  const compressed = await compressImagesBatch(files)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const actingUserId = options?.actingUserId ?? session?.user?.id ?? null

  if (!actingUserId) {
    log.error('No effective user when attempting to upload images')
    throw new Error('You must be signed in to upload images')
  }

  const organizationId = await resolveOrganizationId(
    supabase,
    propertyId,
    options?.organizationId ?? null,
  )

  const payload: PresignPayload = {
    propertyId,
    venueId: actingUserId,
    organizationId,
    files: compressed.map((file) => ({
      filename: file.name,
      size: file.size,
      mime: file.type,
    })),
  }

  const uploads = await requestPresignedUploads(supabase, payload)

  if (uploads.length !== compressed.length) {
    throw new Error('Upload preparation mismatch')
  }

  return putUploads(compressed, uploads, 'image')
}

export async function uploadPropertyFiles(
  supabase: SupabaseClient,
  propertyId: string,
  files: File[],
  options?: { organizationId?: string | null },
): Promise<string[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    log.error('No user session when attempting to upload files')
    throw new Error('You must be signed in to upload files')
  }

  const organizationId = await resolveOrganizationId(
    supabase,
    propertyId,
    options?.organizationId ?? null,
  )

  const payload: PresignPayload = {
    propertyId,
    venueId: session.user?.id,
    organizationId,
    files: files.map((file) => ({
      filename: file.name,
      size: file.size,
      mime: file.type,
    })),
  }

  const uploads = await requestPresignedUploads(supabase, payload)

  if (uploads.length !== files.length) {
    throw new Error('Upload preparation mismatch')
  }

  return putUploads(files, uploads, 'file')
}
