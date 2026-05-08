import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3'

interface ReminderRow {
  reminder_id: string
  booking_id: string
  reminder_type: string
  scheduled_for: string
  property_id: string
  property_title: string
  start_date: string | null
  end_date: string | null
  guest_id: string
  guest_email: string
  guest_name: string | null
}

interface ProcessedResult {
  reminderId: string
  success: boolean
  message?: string
  emailRequestId?: string
}

const METHODS = 'POST, OPTIONS'

function corsHeaders(origin: string | null, methods: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  } as Record<string, string>
}

function handleOptions(req: Request, methods: string) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin')
    return new Response('ok', { headers: { ...corsHeaders(origin, methods) } })
  }
  return null
}

function getEnv(key: string) {
  const value = Deno.env.get(key)
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

function buildReviewLink(baseUrl: string, propertyId: string, reminderId: string) {
  const url = new URL(`/property/${propertyId}`, baseUrl)
  url.searchParams.set('section', 'reviews')
  url.searchParams.set('reminder', reminderId)
  return url.toString()
}

function buildRequestId(reminderId: string) {
  return `review_reminder_${reminderId}`
}
function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return ''
  const startStr = start ? new Date(start).toLocaleDateString() : ''
  const endStr = end ? new Date(end).toLocaleDateString() : ''
  if (startStr && endStr) return `${startStr} - ${endStr}`
  return startStr || endStr || ''
}

async function markSuccess(client: SupabaseClient, reminderId: string, requestId?: string) {
  await client
    .from('review_reminders')
    .update({
      sent_at: new Date().toISOString(),
      email_request_id: requestId || null,
      processing_started_at: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
}

async function markFailure(client: SupabaseClient, reminderId: string, error: string) {
  await client
    .from('review_reminders')
    .update({
      processing_started_at: null,
      error_message: error.substring(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
}

async function processReminder(
  admin: SupabaseClient,
  reminder: ReminderRow,
  baseUrl: string,
  frontendName: string,
  supabaseUrl: string,
  limitToTemplate: string,
  serviceRoleKey: string
): Promise<ProcessedResult> {
  const reminderId = reminder.reminder_id
  const email = reminder.guest_email
  const name = reminder.guest_name || 'there'

  if (!email) {
    await markFailure(admin, reminderId, 'Guest email missing')
    return { reminderId, success: false, message: 'Guest email missing' }
  }

  const reviewLink = buildReviewLink(baseUrl, reminder.property_id, reminderId)

  const { data: linkData, error: linkError } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: reviewLink },
  })

  if (linkError) {
    const msg = linkError?.message || 'Failed to generate magic link'
    await markFailure(admin, reminderId, msg)
    return { reminderId, success: false, message: msg }
  }

  let actionLink: string | null = null
  const emailOtp = (linkData as any)?.properties?.email_otp as string | null | undefined

  try {
    const reviewUrl = new URL(reviewLink)
    if (emailOtp) {
      const magicUrl = new URL('/auth/magic', baseUrl)
      magicUrl.searchParams.set('token', emailOtp)
      magicUrl.searchParams.set('email', email)
      magicUrl.searchParams.set('next', `${reviewUrl.pathname}${reviewUrl.search}`)
      actionLink = magicUrl.toString()
    }
  } catch (err) {
    console.warn('[send-review-reminders] failed to build first-party magic link', {
      reminderId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (!actionLink) {
    actionLink = (linkData?.properties?.action_link as string | undefined) || null
  }

  if (!actionLink) {
    await markFailure(admin, reminderId, 'Magic link generation returned empty action link')
    return { reminderId, success: false, message: 'Magic link generation returned empty action link' }
  }

  try {
    console.log('[send-review-reminders] magic link prepared', {
      reminderId,
      hasEmailOtp: !!emailOtp,
      usedFirstParty: actionLink ? actionLink.startsWith(baseUrl) : false,
    })
  } catch (_) {
    // noop logging guard
  }

  const bookingRange = formatDateRange(reminder.start_date, reminder.end_date)
  const requestId = buildRequestId(reminderId)

  const payload = {
    type: limitToTemplate,
    recipient: { email, name },
    data: {
      requestId,
      propertyTitle: reminder.property_title,
      PROPERTY_TITLE: reminder.property_title,
      bookingId: reminder.booking_id,
      startDate: reminder.start_date,
      endDate: reminder.end_date,
      bookingDateRange: bookingRange,
      BOOKING_DATE_RANGE: bookingRange,
      reviewLink: actionLink,
      review_link: actionLink,
      REVIEW_LINK: actionLink,
      action_link: actionLink,
      recipientName: name,
      RECIPIENT_NAME: name,
      platformName: frontendName,
      PLATFORM_NAME: frontendName,
    },
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    await markFailure(admin, reminderId, `send-notification: ${response.status} ${errorText}`)
    return { reminderId, success: false, message: `send-notification failed: ${response.status}` }
  }

  const result = await response.json().catch(() => ({ success: true }))
  const requestIdentifier = result?.requestId || requestId

  await markSuccess(admin, reminderId, requestIdentifier)

  return { reminderId, success: true, emailRequestId: requestIdentifier }
}

Deno.serve({
  permissions: { net: ['*.supabase.co'] },
}, async (req) => {
  const origin = req.headers.get('origin')
  const preflight = handleOptions(req, METHODS)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders(origin, METHODS), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Service role configuration missing')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await req.json().catch(() => ({}))
    const limit = typeof body?.limit === 'number' ? body.limit : 25

    const frontendBase = Deno.env.get('FRONTEND_BASE_URL') || Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'
    const platformName = Deno.env.get('PLATFORM_NAME') || 'SplitSpace'
    const templateKey = 'review_reminder'

    const { data: reminders, error } = await admin.rpc('dequeue_due_review_reminders', { p_limit: limit })
    if (error) {
      throw new Error(`Failed to dequeue reminders: ${error.message}`)
    }

    const rows = (reminders as ReminderRow[]) || []
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No due reminders' }),
        { status: 200, headers: { ...corsHeaders(origin, METHODS), 'Content-Type': 'application/json' } }
      )
    }

    const results: ProcessedResult[] = []
    for (const reminder of rows) {
      try {
        const result = await processReminder(admin, reminder, frontendBase, platformName, supabaseUrl, templateKey, serviceRoleKey)
        results.push(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await markFailure(admin, reminder.reminder_id, message)
        results.push({ reminderId: reminder.reminder_id, success: false, message })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return new Response(
      JSON.stringify({ processed: rows.length, succeeded: successCount, results }),
      { status: 200, headers: { ...corsHeaders(origin, METHODS), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(origin, METHODS), 'Content-Type': 'application/json' } }
    )
  }
})
