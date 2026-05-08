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
  let log = createLogger({ correlationId, function: 'cancel-booking' })
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
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`)
    }
    log = log.child({ userId: user.id })

    // Parse request body
    const { bookingId, reason } = await req.json()
    
    // Validate required fields
    if (!bookingId) {
      throw new Error('Missing required field: bookingId')
    }
    log = log.child({ bookingId })
    log.info('Processing cancellation request')
    
    // Get booking details
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
            full_name,
            email
          )
        ),
        customer:profiles!bookings_user_id_fkey(
          id,
          full_name,
          email
        ),
        proposal:proposals(
          id,
          inquiry_id
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      throw new Error(`Failed to fetch booking: ${bookingError.message}`)
    }

    if (!booking) {
      throw new Error('Booking not found')
    }
    log = log.child({ venueId: booking.property?.venue_id, propertyId: booking.property?.id })

    // Determine if user is the customer or venue owner
    const isCustomer = booking.user_id === user.id
    const isVenueOwner = booking.property.venue_id === user.id
    
    if (!isCustomer && !isVenueOwner) {
      throw new Error('Unauthorized: Only the customer or venue owner can cancel a booking')
    }

    // Check if booking is already canceled
    if (booking.status === 'canceled') {
      throw new Error('This booking has already been canceled')
    }

    // Check if booking is already completed (past end date)
    const currentDate = new Date()
    const bookingEndDate = new Date(booking.end_date)
    const bookingStartDate = new Date(booking.start_date)
    const isPastEndDate = currentDate > bookingEndDate
    const isPastStartDate = currentDate > bookingStartDate
    
    // If customer is canceling, they can only do so before the start date
    if (isCustomer && isPastStartDate) {
      throw new Error('Booking cannot be canceled after the start date')
    }

    // Calculate refund amount
    let refundAmount = 0
    let refundType = 'none'

    // Only process refund if payment status is 'paid'
    if (booking.payment_status === 'paid') {
      if (isCustomer && !isPastStartDate) {
        // Customer canceling before start date - full refund
        refundAmount = booking.price_total
        refundType = 'full'
      } else if (isVenueOwner) {
        if (!isPastStartDate) {
          // Venue owner canceling before start date - full refund
          refundAmount = booking.price_total
          refundType = 'full'
        } else if (isPastStartDate && !isPastEndDate) {
          // Venue owner canceling during booking period - prorated refund
          const totalBookingDays = Math.ceil((bookingEndDate.getTime() - bookingStartDate.getTime()) / (1000 * 60 * 60 * 24))
          const remainingDays = Math.ceil((bookingEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
          const remainingRatio = remainingDays / totalBookingDays
          
          // Calculate prorated refund amount
          refundAmount = Math.round(booking.price_total * remainingRatio)
          refundType = 'prorated'
        } else {
          // Venue owner canceling after end date - no refund
          refundAmount = 0
          refundType = 'none'
        }
      }
    }

    // Process refund if needed
    let refundId = null
    if (refundAmount > 0 && booking.stripe_payment_intent_id) {
      // Initialize Stripe
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeSecretKey) {
        throw new Error('Stripe secret key not configured')
      }
      
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-04-10',
        typescript: true,
      })

      try {
        // Create refund
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            booking_id: bookingId,
            refund_type: refundType,
            canceled_by: isCustomer ? 'customer' : 'venue_owner',
            reason: reason || 'No reason provided'
          }
        })
        
        refundId = refund.id
        log.info('Created refund', { refundId, refundAmount, refundType })
      } catch (stripeError) {
        log.error('Stripe refund error', { error: stripeError?.message || String(stripeError) })
        throw new Error(`Failed to process refund: ${stripeError.message}`)
      }
    }

    // Update booking status
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        status: 'canceled',
        payment_status: refundAmount > 0 ? 'refunded' : booking.payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) {
      throw new Error(`Failed to update booking status: ${updateError.message}`)
    }

    // Update inquiry status if there is one
    if (booking.proposal?.inquiry_id) {
      const { error: inquiryUpdateError } = await supabaseClient
        .from('inquiries')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.proposal.inquiry_id)

      if (inquiryUpdateError) {
        log.warn('Error updating inquiry status', { error: inquiryUpdateError.message, code: inquiryUpdateError.code })
        // Don't throw error here - we don't want to fail the whole process if inquiry update fails
      }
    }

    // Send cancellation notifications to both parties
    try {
      // Get frontend URL for links
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'
      
      // Determine who canceled
      const canceledBy = isCustomer ? booking.customer.full_name : (booking.property.profiles.full_name)
      
      // Construct refund details message
      let refundDetails = '';
      if (refundType === 'full') {
        refundDetails = `A full refund of ${refundAmount.toFixed(2)} ${booking.currency} has been issued.`;
      } else if (refundType === 'prorated') {
        refundDetails = `A prorated refund of ${refundAmount.toFixed(2)} ${booking.currency} has been issued for the unused portion of the booking.`;
      } else {
        refundDetails = 'No refund was issued for this cancellation.';
      }
      
      // Create cancellation message for the inquiry thread if it exists
      if (booking.proposal?.inquiry_id) {
        const cancellationMessage = `Booking has been canceled by ${canceledBy}.\nReason: ${reason || 'No reason provided'}\n${refundDetails}`
        
        await supabaseClient
          .from('messages')
          .insert({
            inquiry_id: booking.proposal.inquiry_id,
            sender_id: user.id,
            content: cancellationMessage,
          })
      }

      // Generate unique notification IDs
      const customerNotificationId = `booking_cancel_customer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const ownerNotificationId = `booking_cancel_owner_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

      // Send notification to customer
      if (booking.customer.email && booking.customer.email !== user.email) {
        const customerNotificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`,
            'x-correlation-id': correlationId,
          },
          body: JSON.stringify({
            type: 'booking_cancellation',
            recipient: {
              email: booking.customer.email,
              name: booking.customer.full_name || 'Customer'
            },
            sender: {
              email: 'support@splitspace.com'
            },
            data: {
              requestId: customerNotificationId,
              propertyTitle: booking.property.title,
              bookingId: bookingId,
              startDate: booking.start_date,
              endDate: booking.end_date,
              senderName: isCustomer ? 'You' : (booking.property.profiles.full_name),
              messageContent: `${booking.property.title} canceled the booking.\nReason: ${reason || 'No reason provided'}\n\n${refundDetails}`,
              refundType: refundType,
              refundAmount: refundAmount > 0 ? refundAmount.toFixed(2) : '0.00',
              currency: booking.currency,
              reason: reason || 'No reason provided',
              dashboardUrl: `${frontendUrl}/dashboard`
            }
          }),
        })
        
        if (!customerNotificationResponse.ok) {
          log.warn('Error sending customer notification', { responseText: await customerNotificationResponse.text() })
        }
      }

      // Send notification to venue owner
      if (booking.property.profiles.email && booking.property.profiles.email !== user.email) {
        const ownerNotificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`,
            'x-correlation-id': correlationId,
          },
          body: JSON.stringify({
            type: 'booking_cancellation',
            recipient: {
              email: booking.property.profiles.email,
              name: booking.property.profiles.full_name || 'Property Owner'
            },
            sender: {
              email: 'support@splitspace.com'
            },
            data: {
              requestId: ownerNotificationId,
              propertyTitle: booking.property.title,
              bookingId: bookingId,
              startDate: booking.start_date,
              endDate: booking.end_date,
              senderName: isCustomer ? booking.customer.full_name : 'You',
              messageContent: `${isCustomer ? booking.customer.full_name : 'You'} canceled the booking.\nReason: ${reason || 'No reason provided'}\n\n${refundDetails}`,
              refundType: refundType,
              refundAmount: refundAmount > 0 ? refundAmount.toFixed(2) : '0.00',
              currency: booking.currency,
              reason: reason || 'No reason provided',
              dashboardUrl: `${frontendUrl}/dashboard`
            }
          }),
        })
        
        if (!ownerNotificationResponse.ok) {
          log.warn('Error sending owner notification', { responseText: await ownerNotificationResponse.text() })
        }
      }
    } catch (notificationError) {
      log.warn('Error sending cancellation notifications', { error: notificationError?.message || String(notificationError) })
      // Don't throw error here - we don't want to fail the whole process if notifications fail
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Booking canceled successfully',
        data: {
          bookingId,
          status: 'canceled',
          refundAmount,
          refundType,
          refundId
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    log.error('Error canceling booking', { error: error?.message || String(error) })
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})