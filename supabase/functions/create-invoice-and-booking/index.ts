// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { createLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'create-invoice-and-booking' })
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase clients - one for auth, one for database operations
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the session/user from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`)
    }
    log = log.child({ userId: user.id })

    // Parse request body
    const { 
      inquiryId, 
      totalPrice, 
      approvalForm, 
      requestId 
    } = await req.json()
    
    // Validate required fields
    if (!inquiryId) throw new Error('Missing required field: inquiryId')
    if (!totalPrice) throw new Error('Missing required field: totalPrice')
    if (!approvalForm) throw new Error('Missing required field: approvalForm')
    if (!requestId) throw new Error('Missing required field: requestId')
    log = log.child({ inquiryId, requestId, totalPrice })
    log.info('Processing invoice creation request')
    
    // Idempotency check - see if a proposal with this requestId already exists
    const { data: existingProposal, error: checkError } = await supabaseClient
      .from('proposals')
      .select('id, inquiry_id')
      .eq('request_id', requestId)
      .maybeSingle()
    
    if (checkError) {
      log.warn('Error checking for existing proposal', { error: checkError.message, code: checkError.code })
      // Continue processing - better to risk duplicate than fail
    } else if (existingProposal) {
      log.info('Proposal already exists for requestId, returning existing data')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Proposal already exists',
          data: existingProposal,
          isExisting: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
    
    // Get inquiry details first
    log.info('Fetching inquiry details', { inquiryId })
    
    const { data: inquiry, error: inquiryError } = await supabaseClient
      .from('inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single()
    
    if (inquiryError || !inquiry) {
      throw new Error(`Failed to fetch inquiry: ${inquiryError?.message || 'Inquiry not found'}`)
    }
    
    log.info('Inquiry fetched, now fetching property', { inquiryId, propertyId: inquiry.property_id })
    
    // Get property details separately
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select(`
        id,
        title,
        venue_id,
        organization_id,
        tax_rate,
        fee_type,
        fee_value,
        fee_description
      `)
      .eq('id', inquiry.property_id)
      .single()
    
    if (propertyError || !property) {
      throw new Error(`Failed to fetch property: ${propertyError?.message || 'Property not found'}`)
    }
    
    log.info('Property fetched successfully', { propertyId: property.id, title: property.title })
    log = log.child({ propertyId: property.id, venueId: property.venue_id })
    
    // Verify the user is the venue owner
    if (property.venue_id !== user.id) {
      throw new Error('Unauthorized: Only the venue owner can create a proposal')
    }
    
    // Instead of using transactions, we'll use the unique constraint on request_id
    // to ensure idempotency and perform operations sequentially
    
    // 1. Create proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from('proposals')
      .insert({
        inquiry_id: inquiryId,
        price_total: totalPrice,
        currency: 'USD',
        message: `Booking approved for ${approvalForm.startDate} to ${approvalForm.endDate}`,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        request_id: requestId // Store the requestId for idempotency
      })
      .select()
      .single()
    
    if (proposalError) {
      throw new Error(`Failed to create proposal: ${proposalError.message}`)
    }
    
    // 2. Create booking record (hourly if startAt/endAt provided)
    const hasHourlyTimes = !!(approvalForm.startAt && approvalForm.endAt);
    const bookingData: any = {
      property_id: property.id,
      user_id: inquiry.user_id,
      proposal_id: proposal.id,
      price_total: totalPrice,
      currency: 'USD',
      status: 'confirmed',
      payment_status: 'pending',
    };
    if (hasHourlyTimes) {
      // Hourly: write precise timestamps and keep date parts for back-compat
      bookingData.kind = 'hourly';
      bookingData.start_at = new Date(approvalForm.startAt).toISOString();
      bookingData.end_at = new Date(approvalForm.endAt).toISOString();
      bookingData.start_date = new Date(approvalForm.startAt).toISOString().split('T')[0];
      bookingData.end_date = new Date(approvalForm.endAt).toISOString().split('T')[0];
    } else {
      // Daily: original behavior
      bookingData.kind = 'daily';
      bookingData.start_date = approvalForm.startDate;
      bookingData.end_date = approvalForm.endDate;
    }
    
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert(bookingData)
      .select()
      .single()
    
    if (bookingError) {
      throw new Error(`Failed to create booking: ${bookingError.message}`)
    }
    
    // 3. Update inquiry status
    const { error: inquiryUpdateError } = await supabaseClient
      .from('inquiries')
      .update({
        status: 'converted_to_proposal',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiryId)
    
    if (inquiryUpdateError) {
      throw new Error(`Failed to update inquiry status: ${inquiryUpdateError.message}`)
    }
    
    // 4. Construct invoice message
    // Fetch venue owner's profile explicitly to avoid implicit selection of removed columns
    let venueProfile: any = null
    if (property.venue_id) {
      const { data: vp, error: vpErr } = await supabaseClient
        .from('profiles')
        .select('id, full_name, phone, email, primary_organization_id')
        .eq('id', property.venue_id)
        .single()
      if (vpErr) {
        log.warn('venue_profile_fetch_failed', { err: String(vpErr), venueId: property.venue_id })
      } else {
        venueProfile = vp
      }
    }
    // Fetch organization to prefer org name in invoice header
    let organizationName: string | null = null
    try {
      const orgId = property.organization_id || venueProfile?.primary_organization_id || null
      if (orgId) {
        const { data: org, error: orgErr } = await supabaseClient
          .from('organizations')
          .select('id, name')
          .eq('id', orgId)
          .single()
        if (!orgErr && org?.name) {
          organizationName = org.name
        }
      }
    } catch (_) {}
    const userProfile = inquiry.user
    
    // Build invoice message with conditional tax and fee lines
    let invoiceMessage = `${organizationName || venueProfile?.full_name || 'Venue Owner'}
${venueProfile?.phone || 'No phone provided'}
${venueProfile?.email || 'No email provided'}

Invoice date: ${new Date().toISOString().split('T')[0]}
Due date: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

Bill to:
${userProfile?.full_name}

Booking: ${property.title}
${hasHourlyTimes 
      ? `${new Date(approvalForm.startAt).toLocaleString()} to ${new Date(approvalForm.endAt).toLocaleString()}` 
      : `${approvalForm.startDate} to ${approvalForm.endDate}`}

Base Price: $${Number(approvalForm.basePrice || 0).toFixed(2)}`

    // Include each adjustment line (discounts/surcharges)
    try {
      const adjs: Array<{ id?: string; label?: string; amount?: number }> = Array.isArray(approvalForm?.adjustments) ? approvalForm.adjustments : []
      for (const line of adjs) {
        const label = (line?.label || 'Adjustment') as string
        const amt = Number(line?.amount || 0)
        const sign = amt < 0 ? '-' : ''
        invoiceMessage += `
${label}: ${sign}$${Math.abs(amt).toFixed(2)}`
      }
    } catch {}

    // Only include fees line if greater than 0 (show custom fee label if provided)
    if (Number(approvalForm.fees || 0) > 0) {
      const feeLabel = approvalForm.feeLabel || property.fee_description || 'Fees'
      invoiceMessage += `
${feeLabel}: $${Number(approvalForm.fees || 0).toFixed(2)}`
    }

    // Only include taxes line if greater than 0 and annotate with percent if known
    if (Number(approvalForm.taxes || 0) > 0) {
      const rate = typeof approvalForm.taxRate === 'number' && approvalForm.taxRate > 0
        ? ` (${approvalForm.taxRate}%)`
        : (property.tax_rate ? ` (${property.tax_rate}%)` : '')
      invoiceMessage += `
Tax${rate}: $${Number(approvalForm.taxes || 0).toFixed(2)}`
    }

    invoiceMessage += `

Total Amount Due: $${totalPrice.toFixed(2)}

Please proceed with payment to confirm your booking.`
    
    // 5. Insert invoice message
    const { error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        inquiry_id: inquiryId,
        sender_id: user.id,
        content: invoiceMessage,
      })
    
    if (messageError) {
      throw new Error(`Failed to create invoice message: ${messageError.message}`)
    }
    
    // 6. Send notification email to the customer
    try {
      if (userProfile?.email) {
        // Generate unique notification IDs based on the requestId
        const notificationRequestId = `payment_request_${requestId}`
        
        // Call the send-notification edge function
        const notificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`,
            'x-correlation-id': correlationId,
          },
          body: JSON.stringify({
            type: 'payment_request',
            recipient: {
              email: userProfile.email,
              name: userProfile.full_name || 'Customer'
            },
            sender: {
              email: 'support@splitspace.com'
            },
            data: {
              requestId: notificationRequestId,
              senderName: venueProfile?.full_name || 'Property Owner',
              propertyTitle: property.title,
              messageContent: `Your booking request for ${property.title} has been approved. Please complete payment to confirm your booking.`,
              startDate: approvalForm.startDate,
              endDate: approvalForm.endDate,
              amount: totalPrice.toString(),
              currency: 'USD',
              dashboardUrl: `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard`, 
              bookingDetailsUrl: `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/messages?inquiry=${inquiryId}`,
              replyLink: `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/messages?inquiry=${inquiryId}`,
              bookingDateRange: `${new Date(approvalForm.startDate).toLocaleDateString()} - ${new Date(approvalForm.endDate).toLocaleDateString()}`,
              formattedAmount: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
              }).format(totalPrice)
            }
          }),
        })
        
        if (!notificationResponse.ok) {
          const errorData = await notificationResponse.json()
          log.warn('Error sending notification', { error: errorData })
          // Don't throw error here - we don't want to fail the whole process if notification fails
        } else {
          const responseData = await notificationResponse.json()
          log.info('Payment request notification sent successfully', { response: responseData })
        }
      }
    } catch (notificationError) {
      log.warn('Error sending notification', { error: notificationError?.message || String(notificationError) })
      // Don't throw error here - we don't want to fail the whole process if notification fails
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice and booking created successfully',
        data: {
          proposalId: proposal.id,
          bookingId: booking.id,
          inquiryId: inquiryId,
          requestId: requestId
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    log.error('Error creating invoice and booking', { error: error?.message || String(error) })
    
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