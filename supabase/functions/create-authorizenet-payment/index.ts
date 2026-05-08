// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { z } from 'npm:zod'
import { createLogger } from '../_shared/logger.ts'
import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'

Deno.serve({ permissions: { net: ["*.supabase.co", "api.authorize.net"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'create-authorizenet-payment' })
  
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
        JSON.stringify({ error: 'Invalid request body', details: 'Missing required fields' }),
        { headers: { ...baseCors, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const { bookingId, userId, amount, currency } = parsed
    log = log.child({ bookingId, requestUserId: userId, currency, amount })

    // Verify the user ID matches the authenticated user
    if (userId !== user.id) {
      throw new Error('User ID mismatch')
    }

    log.info('Creating Authorize.net payment', { stage: 'start' })

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

    // Check property owner's organization and its Authorize.net setup
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
            payment_provider,
            authorizenet_api_login_id,
            authorizenet_transaction_key,
            authorizenet_sandbox_mode,
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
      
      if (ownerOrg.payment_provider !== 'authorizenet') {
        throw new Error('Property owner organization is not configured for Authorize.net payments.')
      }
      
      if (!ownerOrg.authorizenet_api_login_id || !ownerOrg.authorizenet_transaction_key) {
        throw new Error('Property owner organization has incomplete Authorize.net configuration. Please contact the property owner.')
      }
      
      // Continue with the found organization
    } else {
      // Original logic for when primary_organization_id is set
      const { data: orgData, error: ownerOrgError } = await supabaseClient
        .from('organizations')
        .select('id, name, payment_provider, authorizenet_api_login_id, authorizenet_transaction_key, authorizenet_sandbox_mode, service_credit')
        .eq('id', propertyOwner.primary_organization_id)
        .single()

      if (ownerOrgError) {
        log.error('Owner organization query error', { error: ownerOrgError.message, code: ownerOrgError.code, details: ownerOrgError.details })
        throw new Error('Unable to load property owner organization')
      }

      ownerOrg = orgData

      if (ownerOrg.payment_provider !== 'authorizenet') {
        throw new Error('Property owner organization is not configured for Authorize.net payments.')
      }

      if (!ownerOrg.authorizenet_api_login_id || !ownerOrg.authorizenet_transaction_key) {
        throw new Error('Property owner organization has incomplete Authorize.net configuration. Please contact the property owner.')
      }
    }

    // Determine Authorize.net endpoint
    const isSandbox = ownerOrg.authorizenet_sandbox_mode !== false
    const apiUrl = isSandbox 
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api'

    log.info('Using Authorize.net endpoint', { isSandbox, apiUrl })

    // Generate unique transaction ID
    const transactionId = `txn_${bookingId}_${Date.now()}`

    // Create the payment request
    const paymentRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: ownerOrg.authorizenet_api_login_id,
          transactionKey: ownerOrg.authorizenet_transaction_key,
        },
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: amount.toString(),
          payment: {
            creditCard: {
              cardNumber: '4111111111111111', // This should come from the frontend
              expirationDate: '1225', // This should come from the frontend
              cardCode: '123', // This should come from the frontend
            },
          },
          order: {
            invoiceNumber: bookingId,
            description: `Payment for booking: ${booking.property.title}`,
          },
          customer: {
            id: userId,
            email: user.email,
          },
          billTo: {
            firstName: user.user_metadata?.first_name || 'Guest',
            lastName: user.user_metadata?.last_name || 'User',
            address: '123 Main St', // This should come from the frontend
            city: 'Anytown', // This should come from the frontend
            state: 'CA', // This should come from the frontend
            zip: '12345', // This should come from the frontend
            country: 'USA',
          },
          transactionSettings: {
            setting: {
              settingName: 'emailCustomer',
              settingValue: 'false',
            },
          },
          userFields: {
            userField: [
              {
                name: 'booking_id',
                value: bookingId,
              },
              {
                name: 'property_id',
                value: booking.property.id,
              },
              {
                name: 'organization_id',
                value: ownerOrg.id,
              },
            ],
          },
        },
      },
    }

    // Make the API request to Authorize.net
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error('Authorize.net API error', { status: response.status, errorText })
      throw new Error(`Authorize.net API error: ${response.status}`)
    }

    const result = await response.json()
    log.info('Authorize.net response received', { result })

    // Check if the transaction was successful
    const transactionResponse = result.createTransactionResponse?.transactionResponse
    if (!transactionResponse || transactionResponse.responseCode !== '1') {
      const errorMessage = transactionResponse?.messages?.[0]?.description || 'Transaction failed'
      log.error('Transaction failed', { errorMessage, transactionResponse })
      throw new Error(`Payment failed: ${errorMessage}`)
    }

    log.info('Transaction successful', { 
      transactionId: transactionResponse.transId,
      authCode: transactionResponse.authCode,
      amount: transactionResponse.amount
    })

    // Update booking with payment details
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        authorizenet_transaction_id: transactionResponse.transId,
        authorizenet_auth_code: transactionResponse.authCode,
        payment_provider: 'authorizenet',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) {
      log.error('Error updating booking with payment details', { error: updateError.message, code: updateError.code, details: updateError.details })
      throw new Error(`Failed to update booking: ${updateError.message}`)
    }

    log.info('Updated booking with Authorize.net payment details')

    return new Response(
      JSON.stringify({ 
        success: true,
        transactionId: transactionResponse.transId,
        authCode: transactionResponse.authCode,
        amount: transactionResponse.amount,
        message: 'Payment processed successfully',
      }),
      {
        headers: { ...baseCors, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    log.error('Create Authorize.net payment error', { error: error?.message || String(error) })
    
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
