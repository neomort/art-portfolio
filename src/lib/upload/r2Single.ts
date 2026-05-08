import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Upload a single CMS image to Cloudflare R2 using the existing r2-presign Edge Function.
 * Returns the public URL on success.
 */
export async function uploadCmsImage(supabase: SupabaseClient, file: File): Promise<string> {
  // Must be authenticated; the Edge Function requires a user JWT
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in to upload images')
  }

  // Ask backend to presign a single upload under a CMS prefix (dedicated function)
  const { data, error } = await supabase.functions.invoke('r2-presign-cms', {
    body: {
      // Reuse propertyId field as a logical prefix understood by the function
      // so these assets are grouped separately from property images.
      propertyId: 'cms-pages',
      files: [
        { filename: file.name, size: file.size, mime: file.type || 'application/octet-stream' }
      ],
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) {
    const status = (error as any)?.context?.response?.status
      ?? (error as any)?.status
      ?? (error as any)?.response?.status
    const message = (error as any)?.context?.error
      ?? (error as any)?.error
      ?? (error as any)?.message
      ?? 'Unknown error'
    throw new Error(`Failed to prepare upload: ${message} (status ${status ?? 'unknown'})`)
  }

  const uploads = (data?.uploads || []) as Array<{ key: string; putUrl: string; contentType: string; publicUrl?: string }>
  if (!uploads.length) throw new Error('Upload preparation failed')

  const { putUrl, contentType, publicUrl } = uploads[0]
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Failed to upload image (status ${res.status})`)
  }
  if (!publicUrl) {
    throw new Error('Upload succeeded but URL generation failed; contact support')
  }

  return publicUrl
}
