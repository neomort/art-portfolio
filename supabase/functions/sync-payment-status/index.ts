// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { createLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'sync-payment-status' })
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }
    log = log.child({ userId: user.id })

    const { bookingId, paymentIntentId } = await req.json()
    log = log.child({ bookingId, paymentIntentId })
    log.info('Sync payment status request received')
    
    // Validate required fields
    if (!bookingId || !paymentIntentId) {
      throw new Error('Missing required fields: bookingId, paymentIntentId')
    }

    // Get Stripe secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured')
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      typescript: true,
    })

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      throw new Error(`Booking not found: ${bookingError.message}`)
    }

    // Verify the payment intent ID matches
    if (booking.stripe_payment_intent_id !== paymentIntentId) {
      throw new Error('Payment intent ID mismatch')
    }

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    log = log.child({ stripeStatus: paymentIntent.status })
    
    // Get current status
    const oldStatus = booking.payment_status
    let newStatus = oldStatus
    
    // Determine new status based on payment intent status
    if (paymentIntent.status === 'succeeded') {
      newStatus = 'paid'
    } else if (paymentIntent.status === 'canceled') {
      newStatus = 'failed'
    } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
      newStatus = 'pending'
    } else if (paymentIntent.status === 'processing') {
      newStatus = 'pending'
    }
    log.info('Computed new payment status', { oldStatus, newStatus })
    
    // Only update if status changed
    if (newStatus !== oldStatus) {
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({
          payment_status: newStatus,
          status: newStatus === 'paid' ? 'confirmed' : booking.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      if (updateError) {
        throw new Error(`Failed to update booking: ${updateError.message}`)
      }
      log.info('Booking payment status updated')
      
      return new Response(
        JSON.stringify({ 
          updated: true,
          oldStatus,
          newStatus,
          paymentIntentStatus: paymentIntent.status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      log.info('No booking status change required')
      return new Response(
        JSON.stringify({ 
          updated: false,
          oldStatus,
          newStatus,
          paymentIntentStatus: paymentIntent.status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
  } catch (error) {
    log.error('Sync payment status error', { error: error?.message || String(error) })
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        updated: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})