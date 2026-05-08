// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { z } from 'npm:zod'
import { createLogger } from '../_shared/logger.ts'

// CORS: Allow dynamic origin for local dev and a configurable allowlist via FRONTEND_URLS or FRONTEND_URL
// FRONTEND_URLS can be a comma-separated list of allowed origins

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com"] } }, async (req) => {
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
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  }

  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'booking-payout-breakdown' })
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Resolve Supabase URL from env or request origin as fallback
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured', details: 'Missing STRIPE_SECRET_KEY' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabaseClient = createClient(
      supabaseUrl,
      serviceKey
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`)
    log = log.child({ userId: user.id })

    // Validate input body
    const BodySchema = z.object({ bookingId: z.string().min(1) })
    let parsed
    try {
      parsed = BodySchema.parse(await req.json())
    } catch (e) {
      log.warn('Invalid request body for payout breakdown', { error: e instanceof Error ? e.message : String(e) })
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: e instanceof Error ? e.message : e }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const { bookingId } = parsed
    log = log.child({ bookingId })

    // Load booking with property owner for auth and payment info
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        user_id,
        property_id,
        price_total,
        currency,
        start_date,
        end_date,
        status,
        payment_status,
        stripe_payment_intent_id,
        property:properties(
          id,
          venue_id,
          organization_id,
          title,
          profiles:profiles!properties_venue_id_fkey(
            id,
            full_name,
            email,
            primary_organization_id
          )
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      log.warn('Booking not found for payout breakdown', { error: bookingError.message })
      return new Response(
        JSON.stringify({ error: `Booking not found: ${bookingError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    if (!booking) {
      log.warn('Booking not found for payout breakdown: null data')
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const isVenueOwner = booking.property?.venue_id === user.id
    let isOrgMember = false
    try {
      const ownerOrgId = booking?.property?.organization_id || booking?.property?.profiles?.primary_organization_id
      if (ownerOrgId) {
        const { data: memRows, error: memErr } = await supabaseClient
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', ownerOrgId)
          .eq('user_id', user.id)
          .limit(1)
        if (!memErr) isOrgMember = (memRows || []).length > 0
      }
    } catch (_) {
      // ignore, leave isOrgMember as false
    }
    const isResponderLike = isVenueOwner || isOrgMember
    log = log.child({ propertyId: booking.property_id, venueId: booking.property?.venue_id, isVenueOwner, isOrgMember, isResponderLike })
    if (!isResponderLike) {
      log.warn('Unauthorized payout breakdown access attempt')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only the venue owner or organization members can view payout breakdown' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    if (!booking.stripe_payment_intent_id) {
      log.info('No Stripe payment intent yet for this booking')
      return new Response(
        JSON.stringify({
          bookingId,
          currency: booking.currency || 'usd',
          commissionAmount: 0,
          stripeProcessingFee: 0,
          payoutAmount: 0,
          available: false,
          reason: 'No Stripe payment intent yet for this booking',
          platformFeePercent: null,
          feeRule: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10', typescript: true })

    // Robustly extract/normalize to a Payment Intent ID
    const rawIdentifier = String(booking.stripe_payment_intent_id || '')
    const extractPaymentIntentId = (value: string): string => {
      let v = value.trim()
      if (!v) return ''
      // Stripe IDs are lowercase (pi_, cs_). Normalize common accidental uppercase prefixes.
      // Keep this conservative: only normalize if the prefix is a known Stripe prefix.
      const vLower = v.toLowerCase()
      if (v.startsWith('PI_') || v.startsWith('CS_')) {
        v = vLower
      }
      // Try URL-decode if looks encoded
      try { v = decodeURIComponent(v) } catch (_) {}
      // If value is a full URL, take its query part
      if (/^https?:\/\//i.test(v)) {
        try { const u = new URL(v); v = u.search || v } catch (_) {}
      }
      // Handle query-string-like forms e.g., payment_intent_client_secret=pi_..._secret_...&payment_intent=pi_...
      if (v.includes('payment_intent_client_secret=')) {
        const m = v.match(/payment_intent_client_secret=([^&]+)/)
        if (m?.[1]) return m[1].split('_secret_')[0]
      }
      if (v.includes('payment_intent=')) {
        const m = v.match(/payment_intent=([^&]+)/)
        if (m?.[1]) return m[1]
      }
      // Generic client_secret param (fallback)
      if (v.includes('client_secret=')) {
        const m = v.match(/client_secret=([^&]+)/)
        if (m?.[1]) {
          const secret = m[1]
          if (secret.startsWith('pi_')) return secret.split('_secret_')[0]
          // setup intent client secret not supported for payout lookup; return empty to trigger graceful handling
          return ''
        }
      }
      // Direct client_secret string
      if (v.startsWith('pi_') && v.includes('_secret_')) return v.split('_secret_')[0]
      // Already a PI id
      if (v.startsWith('pi_')) return v
      // Checkout Session id will be handled by caller
      return v
    }

    let paymentIntentId = extractPaymentIntentId(rawIdentifier)
    if (paymentIntentId && paymentIntentId.includes('_secret_')) {
      const original = paymentIntentId
      paymentIntentId = paymentIntentId.split('_secret_')[0]
      log.info('Stripped client_secret suffix from paymentIntentId', { original, normalized: paymentIntentId })
    }
    // If it looks like a Checkout Session ID, resolve to Payment Intent
    if (paymentIntentId?.startsWith('cs_')) {
      try {
        const session = await stripe.checkout.sessions.retrieve(paymentIntentId, { expand: ['payment_intent'] })
        const si = session.payment_intent as any
        if (!si) throw new Error('Checkout Session does not have a payment_intent yet')
        paymentIntentId = typeof si === 'string' ? si : si.id
      } catch (e: any) {
        log.error('Failed to resolve payment intent from Checkout Session', { rawIdentifier, error: e?.message || String(e) })
        throw e
      }
    }

    // Retrieve the Payment Intent with expanded latest charge and balance transaction
    let pi
    try {
      pi = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge.balance_transaction'] }
      )
    } catch (e: any) {
      const msg = e?.message || String(e)
      log.error('Stripe paymentIntents.retrieve failed', { rawIdentifier, paymentIntentId, error: msg })
      // If the Payment Intent doesn't exist (stale/incorrect ID stored), return a graceful non-error payload.
      if (/No such payment_intent/i.test(msg)) {
        return new Response(
          JSON.stringify({
            bookingId,
            currency: booking.currency || 'usd',
            commissionAmount: 0,
            stripeProcessingFee: 0,
            payoutAmount: 0,
            available: false,
            reason: 'Stripe Payment Intent not found for this booking. The stored payment_intent_id may be stale or incorrect.',
            platformFeePercent: null,
            feeRule: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      // If the identifier appears to be a client_secret-only or missing, return a graceful non-error payload
      if (/Missing required param: client_secret/i.test(msg) || !paymentIntentId) {
        return new Response(
          JSON.stringify({
            bookingId,
            currency: booking.currency || 'usd',
            commissionAmount: 0,
            stripeProcessingFee: 0,
            payoutAmount: 0,
            available: false,
            reason: 'Payment Intent not retrievable yet (client_secret-only reference or incomplete payment). Try again later.',
            platformFeePercent: null,
            feeRule: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      throw e
    }
    log = log.child({ rawIdentifier, paymentIntentId, stripeStatus: pi.status })

    const amountCents = typeof pi.amount === 'number' ? pi.amount : Math.round((booking.price_total || 0) * 100)
    const applicationFeeAmountCents = typeof pi.application_fee_amount === 'number' ? pi.application_fee_amount : 0
    const meta = (pi as any)?.metadata || {}
    const originalCommissionCents = meta?.original_application_fee_amount ? Number(meta.original_application_fee_amount) : applicationFeeAmountCents
    const serviceCreditAppliedCents = meta?.service_credit_applied ? Number(meta.service_credit_applied) : 0
    const platformFeePercent = (pi as any)?.metadata?.platform_fee_percent
      ? Number((pi as any).metadata.platform_fee_percent)
      : null
    const feeRule = (pi as any)?.metadata?.fee_rule || null

    // Get Stripe processing fee from the latest charge balance transaction
    let stripeProcessingFeeCents = 0
    let stripeFeePending = false
    const latestCharge: any = (pi as any).latest_charge
    if (latestCharge?.balance_transaction?.fee_details?.length) {
      // Sum all fee details amounts (they are in cents)
      stripeProcessingFeeCents = latestCharge.balance_transaction.fee_details
        .reduce((sum: number, fd: any) => sum + (typeof fd.amount === 'number' ? fd.amount : 0), 0)
      stripeFeePending = false
    } else {
      // Estimate fee if BT not yet available
      const percentStr = Deno.env.get('STRIPE_CARD_FEE_PERCENT') ?? '2.9'
      const fixedStr = Deno.env.get('STRIPE_CARD_FEE_FIXED') ?? '0.30'
      const percent = Number(percentStr)
      const fixed = Number(fixedStr)
      const estimated = Math.round((amountCents * (isFinite(percent) ? percent : 2.9)) / 100) + Math.round((isFinite(fixed) ? fixed : 0.3) * 100)
      stripeProcessingFeeCents = estimated
      stripeFeePending = true
    }

    // Compute payout to destination after fees
    const payoutCents = Math.max(amountCents - applicationFeeAmountCents - stripeProcessingFeeCents, 0)
    log.info('Computed payout breakdown', {
      amountCents,
      applicationFeeAmountCents,
      stripeProcessingFeeCents,
      payoutCents,
      stripeFeePending,
      platformFeePercent,
      feeRule,
    })

    return new Response(
      JSON.stringify({
        bookingId,
        currency: pi.currency || (booking.currency || 'usd'),
        amount: amountCents / 100,
        commissionAmount: applicationFeeAmountCents / 100,
        originalCommissionAmount: originalCommissionCents / 100,
        serviceCreditApplied: serviceCreditAppliedCents / 100,
        stripeProcessingFee: stripeProcessingFeeCents / 100,
        payoutAmount: payoutCents / 100,
        available: true,
        stripeFeePending,
        platformFeePercent,
        feeRule
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    log.error('booking-payout-breakdown error', { error: error?.message || String(error) })
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
