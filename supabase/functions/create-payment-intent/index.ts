// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { z } from 'npm:zod'
import { createLogger } from '../_shared/logger.ts'
import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'create-payment-intent' })
  
  // Basic request logging
  console.log(`[${correlationId}] Request received: ${req.method} ${req.url}`)
  
  const methods = 'POST, OPTIONS'
  const origin = req.headers.get('origin')
  const baseCors = buildCorsHeaders(origin, methods)
  // Handle CORS preflight requests
  const pre = handleOptions(req, methods)
  if (pre) return pre

  try {
    console.log(`[${correlationId}] Processing request...`)
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Get the session/user from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    log.debug('Authorization token received', { present: Boolean(token) })

    // Verify the user token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError) {
      log.error('Authentication error', { error: authError?.message, name: authError?.name, status: authError?.status })
      throw new Error(`Authentication failed: ${authError.message}`)
    }

    if (!user) {
      throw new Error('No user found')
    }

    log = log.child({ userId: user.id })
    log.info('Authenticated user')

    // Validate input body with Zod
    const BodySchema = z.object({
      bookingId: z.string().min(1),
      userId: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().length(3),
    })
    let parsed
    try {
      parsed = BodySchema.parse(await req.json())
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Server not configured', details: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }),
        { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const { bookingId, userId, amount, currency } = parsed
    log = log.child({ bookingId, requestUserId: userId, currency, amount })

    // Verify the user ID matches the authenticated user
    if (userId !== user.id) {
      throw new Error('User ID mismatch')
    }

    log.info('Creating payment intent', { stage: 'start' })

    // Verify the booking exists and belongs to the user
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        property:properties(
          id,
          title,
          venue_id,
          profiles:profiles!properties_venue_id_fkey(
            id,
            email,
            full_name,
            primary_organization_id
          )
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single()

    if (bookingError) {
      log.error('Booking query error', { error: bookingError.message, code: bookingError.code, details: bookingError.details })
      throw new Error(`Booking not found: ${bookingError.message}`)
    }

    if (!booking) {
      throw new Error('Booking not found or unauthorized')
    }

    log = log.child({ propertyId: booking.property?.id, venueId: booking.property?.venue_id })
    log.info('Found booking')

    // Check property owner's organization and its Stripe Connect setup
    const propertyOwner = booking.property.profiles
    let ownerOrg: any = null
    
    if (!propertyOwner?.primary_organization_id) {
      // Try to find or create a default organization for the property owner
      log.warn('Property owner missing primary organization, attempting to find/create one', { 
        ownerId: propertyOwner.id, 
        ownerEmail: propertyOwner.email 
      })
      
      // Look for any organization this user belongs to
      const { data: userOrgs, error: userOrgsError } = await supabaseClient
        .from('organization_members')
        .select(`
          organization_id,
          organizations(
            id,
            name,
            stripe_account_id,
            charges_enabled,
            payouts_enabled,
            service_credit
          )
        `)
        .eq('user_id', propertyOwner.id)
        .limit(1)
      
      if (userOrgsError) {
        log.error('Error checking user organizations', { error: userOrgsError.message })
        throw new Error('Property owner is missing a primary organization. Please contact support.')
      }
      
      if (!userOrgs || userOrgs.length === 0) {
        throw new Error('Property owner is missing a primary organization. Please contact support.')
      }
      
      // Use the first organization found
      ownerOrg = userOrgs[0].organizations
      log.info('Using fallback organization for property owner', { 
        organizationId: ownerOrg.id,
        organizationName: ownerOrg.name
      })
      
      if (!ownerOrg?.stripe_account_id) {
        throw new Error('Property owner organization has not set up Stripe Connect. Please contact the property owner.')
      }
      
      if (!ownerOrg.charges_enabled) {
        throw new Error('Property owner organization\'s Stripe account is not enabled for charges. Please contact the property owner.')
      }
      
      // Continue with the found organization
    } else {
      // Original logic for when primary_organization_id is set
      const { data: orgData, error: ownerOrgError } = await supabaseClient
        .from('organizations')
        .select('id, name, stripe_account_id, charges_enabled, payouts_enabled, service_credit')
        .eq('id', propertyOwner.primary_organization_id)
        .single()

      if (ownerOrgError) {
        log.error('Owner organization query error', { error: ownerOrgError.message, code: ownerOrgError.code, details: ownerOrgError.details })
        throw new Error('Unable to load property owner organization')
      }

      ownerOrg = orgData

      if (!ownerOrg?.stripe_account_id) {
        throw new Error('Property owner organization has not set up Stripe Connect. Please contact the property owner.')
      }

      if (!ownerOrg.charges_enabled) {
        throw new Error('Property owner organization\'s Stripe account is not enabled for charges. Please contact the property owner.')
      }
    }

    // Get Stripe secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured')
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Tiered commission logic based on booking duration
    // Determine booking duration in days (UTC)
    const start = new Date(booking.start_date)
    const end = new Date(booking.end_date)
    const msPerDay = 1000 * 60 * 60 * 24
    const durationDays = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / msPerDay))

    // Read tiered fee configuration from environment
    const baseEnv = Deno.env.get('PLATFORM_FEE_BASE_PERCENT') ?? '15'
    const longPctEnv = Deno.env.get('PLATFORM_FEE_LONG_TERM_PERCENT') ?? '5'
    const thresholdEnv = Deno.env.get('PLATFORM_FEE_LONG_TERM_THRESHOLD_DAYS') ?? '365'

    let basePercent = Number(baseEnv)
    if (!Number.isFinite(basePercent) || basePercent < 0) basePercent = 15
    if (basePercent > 100) basePercent = 100

    let longTermPercent = Number(longPctEnv)
    if (!Number.isFinite(longTermPercent) || longTermPercent < 0) longTermPercent = 5
    if (longTermPercent > 100) longTermPercent = 100

    let thresholdDays = Number(thresholdEnv)
    if (!Number.isFinite(thresholdDays) || thresholdDays < 1) thresholdDays = 365

    const feeRule = durationDays >= thresholdDays ? 'long_term' : 'base'
    const platformFeePercent = feeRule === 'long_term' ? longTermPercent : basePercent
    const originalApplicationFeeCents = Math.round(amount * 100 * (platformFeePercent / 100)) // fee in cents

    // Read service credit for the owner organization (in dollars). Default 0 if missing.
    let serviceCreditDollars = 0
    if (ownerOrg && ownerOrg.service_credit != null) {
      const scNum = Number(ownerOrg.service_credit)
      if (Number.isFinite(scNum)) {
        serviceCreditDollars = Math.max(0, scNum)
      }
    }

    const serviceCreditCents = Math.round(serviceCreditDollars * 100)
    const creditAppliedCents = Math.min(serviceCreditCents, originalApplicationFeeCents)
    const effectiveApplicationFeeCents = Math.max(0, originalApplicationFeeCents - creditAppliedCents)

    log.info('Computed fee breakdown', {
      durationDays,
      feeRule,
      platformFeePercent,
      originalApplicationFeeCents,
    });

    // Check for existing payment intent to reuse
    let paymentIntent: any = null

    try {
        // Create payment intent with Stripe Connect (restored)
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          application_fee_amount: effectiveApplicationFeeCents,
          transfer_data: {
            destination: ownerOrg.stripe_account_id,
          },
          metadata: {
            booking_id: bookingId,
            user_id: userId,
            property_id: booking.property.id,
            venue_id: booking.property.venue_id,
            organization_id: ownerOrg.id,
            platform_fee_percent: String(platformFeePercent),
            fee_rule: feeRule,
            duration_days: String(durationDays),
            original_application_fee_amount: String(originalApplicationFeeCents),
            service_credit_applied: String(creditAppliedCents),
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });
        
        log.info('Payment intent created with Connect features', { 
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          applicationFee: effectiveApplicationFeeCents,
          destination: ownerOrg.stripe_account_id
        });
        
      } catch (stripeError: any) {
        log.error('Simple Stripe payment intent creation failed', {
          error: stripeError.message,
          type: stripeError.type,
          code: stripeError.code,
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase()
        });
        throw stripeError;
      }

    log = log.child({ paymentIntentId: paymentIntent.id })
    log.info('Created payment intent')

    // Update booking with payment intent details
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_client_secret: paymentIntent.client_secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) {
      log.error('Error updating booking with payment intent', { error: updateError.message, code: updateError.code, details: updateError.details })
      throw new Error(`Failed to update booking: ${updateError.message}`)
    }

    log.info('Updated booking with payment intent')

    // Note: Service credit is decremented on webhook (payment_intent.succeeded) to ensure idempotency

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        applicationFee: effectiveApplicationFeeCents / 100, // dollars
        platformFeePercent,
        feeRule,
        durationDays,
        originalApplicationFee: originalApplicationFeeCents / 100,
        serviceCreditApplied: creditAppliedCents / 100,
      }),
      {
        headers: { ...baseCors, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    log.error('Create payment intent error', { error: error?.message || String(error) })
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check server logs for more information'
      }),
      {
        headers: { ...baseCors, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})