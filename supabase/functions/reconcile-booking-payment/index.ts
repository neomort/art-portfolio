// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { createLogger } from '../_shared/logger.ts'
import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'reconcile-booking-payment' })
  const methods = 'POST, OPTIONS'
  const origin = req.headers.get('origin')
  const baseCors = buildCorsHeaders(origin, methods)

  const pre = handleOptions(req, methods)
  if (pre) return pre

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 })
    }
    const sb = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 })
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: userData, error: authError } = await sb.auth.getUser(token)
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 401 })
    }
    const user = userData.user
    log = log.child({ userId: user.id })

    const body = await req.json().catch(() => ({}))
    const bookingId = body?.booking_id || body?.bookingId
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Load booking
    const { data: booking, error: bookingErr } = await sb
      .from('bookings')
      .select('id, payment_status, status, stripe_payment_intent_id, property_id, proposal_id')
      .eq('id', bookingId)
      .single()
    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 404 })
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 })
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10', typescript: true })

    // Helper to update booking and inquiry
    async function markPaid(piId: string) {
      try {
        const { error: updErr } = await sb
          .from('bookings')
          .update({ payment_status: 'paid', stripe_payment_intent_id: piId, updated_at: new Date().toISOString() })
          .eq('id', bookingId)
        if (updErr) throw updErr
        log.info('booking_marked_paid', { bookingId, piId })
      } catch (e) {
        log.error('booking_update_exception', { err: String(e), bookingId })
        throw e
      }
      // Note: We intentionally skip updating inquiries.status here to avoid DB triggers that may reference deprecated columns.
    }

    // If booking already paid, return early
    if (booking.payment_status === 'paid') {
      return new Response(JSON.stringify({ reconciled: false, alreadyPaid: true }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Try current stored PI first
    let succeededPiId: string | null = null
    if (booking.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (pi.status === 'succeeded') {
          succeededPiId = pi.id
        }
      } catch (e) {
        log.warn('retrieve_stored_pi_failed', { err: String(e), pi: booking.stripe_payment_intent_id })
      }
    }

    // If not found, search by metadata booking_id (requires search to be enabled; generally available)
    if (!succeededPiId) {
      try {
        const search = await stripe.paymentIntents.search({ query: `metadata['booking_id']:"${bookingId}" AND status:'succeeded'`, limit: 1 })
        if (search?.data?.length) {
          succeededPiId = search.data[0].id
        }
      } catch (e) {
        log.warn('pi_search_failed', { err: String(e), bookingId })
      }
    }

    if (succeededPiId) {
      await markPaid(succeededPiId)
      return new Response(JSON.stringify({ reconciled: true, payment_intent_id: succeededPiId }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ reconciled: false, reason: 'No succeeded PaymentIntent found for booking' }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 })
  }
})
