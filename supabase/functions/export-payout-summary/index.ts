// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { z } from 'npm:zod'
import { createLogger } from '../_shared/logger.ts'

const MAX_STRIPE_PIS = 200

const formatDate = (input: string | null | undefined) => {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

Deno.serve({ permissions: { net: ['*.supabase.co', 'api.stripe.com'] } }, async (req) => {
  const origin = req.headers.get('Origin') || req.headers.get('origin') || ''
  const allowlist = (Deno.env.get('FRONTEND_URLS') || Deno.env.get('FRONTEND_URL') || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')
  const isAllowed = (origin && allowlist.includes(origin)) || isLocalhost
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowlist[0] || 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  }

  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'export-payout-summary' })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { headers: corsHeaders, status: 405 })
  }

  try {
    let supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!supabaseUrl) {
      const u = new URL(req.url)
      supabaseUrl = `${u.protocol}//${u.host}`
    }
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server not configured', details: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured', details: 'Missing STRIPE_SECRET_KEY' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: authError?.message || 'No user found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }
    log = log.child({ userId: user.id })

    const BodySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })

    let parsedBody
    try {
      parsedBody = BodySchema.parse(await req.json())
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: error instanceof Error ? error.message : String(error) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const startDate = formatDate(parsedBody.startDate)
    const endDate = formatDate(parsedBody.endDate)

    const { data: membershipRows, error: membershipError } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)

    if (membershipError) {
      throw new Error(`Unable to load organization memberships: ${membershipError.message}`)
    }

    const organizationIds = new Set((membershipRows || []).map((row: any) => row.organization_id).filter(Boolean))

    let bookingQuery = supabaseClient
      .from('bookings')
      .select(`
        id,
        user_id,
        start_date,
        end_date,
        created_at,
        status,
        payment_status,
        price_total,
        currency,
        stripe_payment_intent_id,
        property:properties(
          id,
          title,
          venue_id,
          organization_id
        )
      `)
      .not('stripe_payment_intent_id', 'is', null)
      .order('start_date', { ascending: true })

    if (startDate) {
      bookingQuery = bookingQuery.gte('start_date', startDate)
    }
    if (endDate) {
      bookingQuery = bookingQuery.lte('end_date', endDate)
    }

    const { data: bookingRows, error: bookingsError } = await bookingQuery
    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
    }

    const accessibleBookings = (bookingRows || []).filter((booking: any) => {
      const isBooker = booking.user_id === user.id
      const isVenueOwner = booking.property?.venue_id === user.id
      const isOrgMember = booking.property?.organization_id && organizationIds.has(booking.property.organization_id)
      return isBooker || isVenueOwner || isOrgMember
    })

    if (accessibleBookings.length === 0) {
      return new Response(
        JSON.stringify({ payouts: [], transactions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const paymentIntentIds = Array.from(
      new Set(
        accessibleBookings
          .map((booking: any) => booking.stripe_payment_intent_id)
          .filter((id: string | null) => typeof id === 'string' && id.length > 0)
      )
    )

    if (paymentIntentIds.length > MAX_STRIPE_PIS) {
      throw new Error(`Too many payment intents requested (${paymentIntentIds.length}). Narrow the date range.`)
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10', typescript: true })

    const bookingByPaymentIntent = new Map(paymentIntentIds.map((id) => [id, null]))
    accessibleBookings.forEach((booking: any) => {
      if (booking.stripe_payment_intent_id) {
        bookingByPaymentIntent.set(booking.stripe_payment_intent_id, booking)
      }
    })

    const payoutMap = new Map()
    const transactionRows: any[] = []

    for (const paymentIntentId of paymentIntentIds) {
      let paymentIntent
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['latest_charge.balance_transaction', 'latest_charge.invoice', 'charges.data.balance_transaction'],
        })
      } catch (error) {
        log.warn('Failed to retrieve payment intent', { paymentIntentId, error: error instanceof Error ? error.message : String(error) })
        continue
      }

      const booking = bookingByPaymentIntent.get(paymentIntentId)
      if (!booking) continue

      const charge = paymentIntent.latest_charge || paymentIntent.charges?.data?.[0]
      const balanceTransaction: any = charge && typeof charge === 'object' ? charge.balance_transaction : null
      if (!balanceTransaction) {
        log.warn('Missing balance transaction for payment intent', { paymentIntentId })
        continue
      }

      const amountCents = typeof balanceTransaction.amount === 'number'
        ? balanceTransaction.amount
        : Math.round((booking.price_total ?? 0) * 100)

      const stripeFeeCents = typeof balanceTransaction.fee === 'number'
        ? balanceTransaction.fee
        : Array.isArray(balanceTransaction.fee_details)
          ? balanceTransaction.fee_details.reduce((sum: number, fd: any) => sum + (typeof fd.amount === 'number' ? fd.amount : 0), 0)
          : 0

      const meta = (paymentIntent as any).metadata || {}
      const applicationFeeCents = typeof paymentIntent.application_fee_amount === 'number'
        ? paymentIntent.application_fee_amount
        : meta?.original_application_fee_amount
          ? Number(meta.original_application_fee_amount)
          : 0

      const totalFeeCents = Math.max(0, stripeFeeCents + applicationFeeCents)
      const netCents = amountCents - totalFeeCents
      const payoutId = balanceTransaction.payout || null

      if (payoutId) {
        if (!payoutMap.has(payoutId)) {
          payoutMap.set(payoutId, { id: payoutId, arrival_date: null, amount: null, currency: paymentIntent.currency || booking.currency || 'usd' })
        }
      }

      transactionRows.push({
        payout_id: payoutId,
        payout_arrival_date: null,
        transaction_date: formatDate(booking.start_date) ?? formatDate(booking.created_at),
        gross_sale: amountCents / 100,
        total_fee: totalFeeCents / 100,
        net_payout_value: netCents / 100,
        customer_reference: booking.id,
        description: `${booking.property?.title ?? 'Booking'} ${booking.id?.slice(0, 8) ?? ''}`.trim(),
        stripe_payment_intent: paymentIntentId,
        currency: paymentIntent.currency || booking.currency || 'usd',
      })
    }

    const payoutIds = Array.from(payoutMap.keys())
    for (const payoutId of payoutIds) {
      try {
        const payout = await stripe.payouts.retrieve(payoutId)
        payoutMap.set(payoutId, {
          id: payout.id,
          arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10) : null,
          amount: typeof payout.amount === 'number' ? payout.amount / 100 : null,
          currency: payout.currency || 'usd',
        })
      } catch (error) {
        log.warn('Failed to retrieve payout', { payoutId, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const payoutInfo = payoutMap.size > 0 ? Object.fromEntries(payoutMap.entries()) : {}
    transactionRows.forEach((row) => {
      if (row.payout_id && payoutInfo[row.payout_id]) {
        row.payout_arrival_date = payoutInfo[row.payout_id].arrival_date
      }
    })

    const responsePayload = {
      payouts: Object.values(payoutInfo),
      transactions: transactionRows,
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    log.error('export-payout-summary error', { error: error?.message || String(error) })
    return new Response(
      JSON.stringify({ error: error?.message || 'Unexpected error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
