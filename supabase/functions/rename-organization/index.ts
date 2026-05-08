// @deno-types="npm:@supabase/supabase-js@2.39.3"
import 'https://deno.land/std@0.224.0/dotenv/load.ts'
import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2.39.3'

// Define CORS headers as a function to ensure they're always fresh
function getCorsHeaders(additionalHeaders: Record<string, string> = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...additionalHeaders
  }
}

// Define types for our API
interface ErrorResponse {
  error: string
  message: string
  detail?: string
  requestId?: string
}

interface SuccessResponse<T = unknown> {
  success: boolean
  data?: T
  requestId: string
}

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

interface RequestBody {
  organizationId?: string
  newName?: string
}

// Helper function to create consistent JSON responses with CORS headers
function jsonResponse<T = unknown>(
  body: T | ErrorResponse,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  const responseHeaders = {
    'Content-Type': 'application/json',
    ...getCorsHeaders(),
    ...headers
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders
  })
}

// Main handler function with global error handling
export const handler = async (req: Request): Promise<Response> => {
  // Create a new AbortController for this request with a 25s timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('Request timed out'), 25000)

  try {
    return await handleRequest(req, controller.signal)
  } catch (error) {
    // This catches any unhandled errors
    console.error('Unhandled error in handler:', error)
    return jsonResponse({
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      detail: error.message
    }, 500)
  } finally {
    clearTimeout(timeoutId)
  }
}

// Actual request handler
async function handleRequest(req: Request, signal: AbortSignal): Promise<Response> {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  const log = (message: string, data: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      message,
      ...data
    }))
  }

  // Check if the request was aborted
  if (signal.aborted) {
    log('Request aborted due to timeout')
    return jsonResponse({
      error: 'request_timeout',
      message: 'Request took too long to process',
      requestId
    }, 504)
  }
    log('Request received', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    })

    // Handle CORS preflight - this should be simple and fast
    if (req.method === 'OPTIONS') {
      log('Handling OPTIONS request - returning CORS headers')
      return new Response('ok', {
        headers: getCorsHeaders({
          'Access-Control-Max-Age': '86400' // 24 hours
        })
      })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      log('Method not allowed', { method: req.method })
      return jsonResponse({
        error: 'method_not_allowed',
        message: 'Only POST requests are allowed',
        requestId
      }, 405)
    }

    // Get auth header
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    log('Auth header info', {
      hasAuthHeader: !!authHeader,
      authType: authHeader.split(' ')[0] || 'none'
    })

    const token = authHeader.split(' ')[1]
    if (!token) {
      log('No token found in Authorization header')
      return jsonResponse({
        error: 'unauthorized',
        message: 'Missing authorization token',
        requestId
      }, 401)
    }

    // Initialize Supabase client with timeout
    log('Initializing Supabase client')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      const missingVars = []
      if (!supabaseUrl) missingVars.push('SUPABASE_URL')
      if (!serviceKey) missingVars.push('SERVICE_ROLE_KEY')

      log('Missing required environment variables', { missing: missingVars })
      return jsonResponse({
        error: 'configuration_error',
        message: 'Server configuration error',
        requestId
      }, 500)
    }

    // Set up fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), 10000) // 10s timeout for DB operations

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        return response
      } finally {
        clearTimeout(timeoutId)
      }
    }

    const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-supabase-service-role': serviceKey,
          'x-request-id': requestId
        },
        fetch: fetchWithTimeout as any // Type assertion needed due to fetch signature mismatch
      }
    })

    log('Supabase client initialized')

    // Verify the JWT token with timeout
    log('Verifying JWT token')
    const { data: { user }, error: authError } = await Promise.race([
      admin.auth.getUser(token),
      new Promise<{ data: { user: User | null }, error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Auth verification timeout')), 5000)
      )
    ]).catch(error => {
      log('Auth verification failed', { error: error.message })
      throw error
    })

    if (authError || !user) {
      log('Authentication failed', {
        error: authError?.message,
        hasUser: !!user
      })
      return jsonResponse({
        error: 'unauthorized',
        message: 'Invalid or expired token',
        requestId
      }, 401)
    }

    log('User authenticated', { userId: user.id })

    // Parse request body with size limit
    log('Parsing request body')
    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > 1024 * 10) { // 10KB max
      return jsonResponse({
        error: 'request_too_large',
        message: 'Request body too large',
        requestId
      }, 413)
    }

    let body: RequestBody
    try {
      body = await req.json()
      log('Request body parsed', {
        hasOrgId: !!body.organizationId,
        hasNewName: !!body.newName
      })
    } catch (e) {
      log('Error parsing request body', { error: e.message })
      return jsonResponse({
        error: 'invalid_request',
        message: 'Invalid JSON body',
        requestId
      }, 400)
    }

    let { organizationId, newName } = body

    if (!newName) {
      log('Missing required fields', { organizationId, newName })
      return jsonResponse({
        error: 'invalid_request',
        message: 'Missing required field: newName is required',
        requestId
      }, 400)
    }

    // If no organizationId provided, find-or-create by name and attach caller
    if (!organizationId) {
      // Check if we should abort
      if (signal.aborted) {
        throw new Error('Operation aborted due to timeout')
      }
      log('No organizationId provided; attempting to find or create by name')
      const baseSlug = newName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'org'

      // Try by slug
      const { data: bySlug, error: slugErr } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', baseSlug)
        .maybeSingle()
      if (slugErr) {
        log('Find by slug failed', { error: slugErr.message })
        return jsonResponse({ error: 'org_lookup_failed', message: slugErr.message, requestId }, 500)
      }
      if (bySlug?.id) {
        organizationId = bySlug.id
      } else {
        // Try by name (case-insensitive)
        const { data: byName, error: nameErr } = await admin
          .from('organizations')
          .select('id')
          .ilike('name', newName)
          .maybeSingle()
        if (nameErr) {
          log('Find by name failed', { error: nameErr.message })
          return jsonResponse({ error: 'org_lookup_failed', message: nameErr.message, requestId }, 500)
        }
        if (byName?.id) {
          organizationId = byName.id
        } else {
          // Create new organization with slug retries
          const buildSlugVariant = (n: number) => (n <= 1 ? baseSlug : `${baseSlug}-${n}`)
          let createdId: string | null = null
          for (let attempt = 1; attempt <= 5; attempt++) {
            const slug = buildSlugVariant(attempt)
            const { data: created, error: createErr } = await admin
              .from('organizations')
              .insert({ name: newName, slug })
              .select('id')
              .single()
            if (!createErr && created?.id) {
              createdId = created.id
              break
            }
            const msg = (createErr?.message || '').toLowerCase()
            if (!msg.includes('duplicate key value') && !msg.includes('unique')) {
              log('Create organization failed', { error: createErr?.message })
              return jsonResponse({ error: 'org_create_failed', message: createErr?.message || 'Failed to create organization', requestId }, 500)
            }
          }
          if (!createdId) {
            return jsonResponse({ error: 'org_create_failed', message: 'Slug conflict creating organization', requestId }, 500)
          }
          organizationId = createdId
        }
      }

      // Ensure caller is a member of the organization
      const { data: memCheck, error: memCheckErr } = await admin
        .from('organization_members')
        .select('organization_id, user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (memCheckErr) {
        log('Membership check failed after org create', { error: memCheckErr.message })
        return jsonResponse({ error: 'membership_check_failed', message: memCheckErr.message, requestId }, 500)
      }
      if (!memCheck) {
        const { error: insMemErr } = await admin
          .from('organization_members')
          .insert({ organization_id: organizationId, user_id: user.id, role: 'member' })
        if (insMemErr) {
          log('Membership create failed', { error: insMemErr.message })
          return jsonResponse({ error: 'membership_create_failed', message: insMemErr.message, requestId }, 500)
        }
      }

      // Set profile primary_organization_id if not set
      const { data: prof, error: profErr } = await admin
        .from('profiles')
        .select('id, primary_organization_id')
        .eq('id', user.id)
        .single()
      if (!profErr && prof && !prof.primary_organization_id) {
        const { error: updProfErr } = await admin
          .from('profiles')
          .update({ primary_organization_id: organizationId })
          .eq('id', user.id)
        if (updProfErr) log('Failed to set primary_organization_id', { error: updProfErr.message })
      }
    }

    // Now check membership for the organization (any role)
    log('Checking membership', { organizationId })
    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('organization_id, user_id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      log('Membership check failed', { error: membershipError.message })
      return jsonResponse({
        error: 'membership_check_failed',
        message: 'Could not verify organization membership',
        detail: membershipError.message,
        requestId
      }, 500)
    }

    if (!membership) {
      log('User is not a member of organization', { userId: user.id, organizationId })
      return jsonResponse({
        error: 'forbidden',
        message: 'You are not a member of this organization',
        requestId
      }, 403)
    }

    // Build a slug from the new name and attempt to update name+slug with conflict retries
    const baseSlug = newName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org'

    const buildSlugVariant = (n: number) => (n <= 1 ? baseSlug : `${baseSlug}-${n}`)

    let updatedOrg: any = null
    let lastError: any = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      const slug = buildSlugVariant(attempt)
      log('Attempting update with slug', { attempt, slug })
      const { data, error } = await admin
        .from('organizations')
        .update({
          name: newName,
          slug,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single()
      if (!error) {
        updatedOrg = data
        break
      }
      lastError = error
      const msg = (error?.message || '').toLowerCase()
      if (!msg.includes('duplicate key value') && !msg.includes('unique')) {
        // Not a uniqueness conflict; fail fast
        break
      }
    }
    const updateError = updatedOrg ? null : lastError

    if (updateError) {
      log('Failed to update organization', {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint
      })
      return jsonResponse({
        error: 'update_failed',
        message: 'Failed to update organization',
        detail: updateError.message,
        requestId
      }, 500)
    }

    log('Organization updated successfully', { organizationId, newName })

    return jsonResponse({
      success: true,
      organization: updatedOrg,
      requestId
    } as SuccessResponse<{ organization: Organization }>, 200)
}
