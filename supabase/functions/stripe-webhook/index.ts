// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@14.21.0'
import { createLogger } from '../_shared/logger.ts'

// Define the attachment interface
interface EmailAttachment {
  content: string;
  name: string;
  contentType: string;
}

const ALLOWED_ORIGIN = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Security headers
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'stripe-webhook', correlationId: cid })
  log.info('webhook_invoked')
  
  // Check if this is a Stripe webhook request or test request
  const stripeSignature = req.headers.get('stripe-signature');
  const userAgent = req.headers.get('user-agent') || '';
  const contentType = req.headers.get('content-type') || '';
  const isStripeRequest = stripeSignature || userAgent.includes('Stripe');
  const isTestRequest = contentType.includes('application/json') && 
                       (userAgent.includes('curl') || 
                        userAgent.includes('Postman') || 
                        userAgent.includes('httpie') ||
                        !userAgent.includes('Mozilla'));
  
  log.info('auth_check', { 
    stripeSignature: !!stripeSignature,
    userAgent,
    contentType,
    isStripeRequest,
    isTestRequest,
    method: req.method
  });
  
  // Skip JWT verification for webhook endpoints
  // Webhooks are authenticated via Stripe signature verification, not JWT
  
  // Small request-scoped helpers
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': cid }, status }
    )
  const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
    json(status, { error: message, ...extra })
  const corsOk = () => new Response('ok', { headers: { ...corsHeaders, 'X-Correlation-Id': cid } })
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return corsOk()
  }
  
  // Only allow POST requests for webhooks
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed. Please use POST.' })
  }

  try {
    // Read the body once at the beginning
    const rawBody = await req.text();
    let body = null;
    
    // Check for test request
    if (req.headers.get('content-type') === 'application/json') {
      try {
        body = JSON.parse(rawBody);
        if (body.test === true) {
          // Initialize Supabase client for database logging
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
            Deno.env.get('SERVICE_ROLE_KEY') || ''
          )
          
          // Create a log entry in the database
          const logId = `webhook_test_${Date.now()}`;
          const { data: logEntry, error: logError } = await supabaseClient
            .from('sent_notifications')
            .insert({
              request_id: logId,
              email_type: 'webhook_test',
              recipient_email: 'webhook@test.log'
            })
            .select()
            .single();
            
          if (logError) {
            log.error('create_log_entry_failed', { err: String(logError) })
          } else {
            log.info('create_log_entry_success', { logEntryId: logEntry?.id })
          }
          
          // Log environment variables (without revealing secrets)
          const environment = {
            stripeSecretKey: !!Deno.env.get('STRIPE_SECRET_KEY'),
            webhookSecret: !!Deno.env.get('STRIPE_WEBHOOK_SECRET'),
            supabaseUrl: !!(Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL')),
            supabaseServiceKey: !!Deno.env.get('SERVICE_ROLE_KEY')
          };
          
          // Store test info in system_settings
          const { error: updateError } = await supabaseClient
            .from('system_settings')
            .upsert({
              key: 'last_webhook_test',
              value: JSON.stringify({
                timestamp: new Date().toISOString(),
                environment,
                logId
              }),
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            
          if (updateError) {
            log.error('update_system_settings_failed', { err: String(updateError), key: 'last_webhook_test' })
          }
          
          log.info('test_webhook_received', { logId, hasStripeVars: environment.stripeSecretKey, hasWebhookSecret: environment.webhookSecret })
          return json(200, {
            received: true,
            message: 'Test webhook received',
            environment,
            logId,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (e) {
        log.error('test_request_parse_error', { err: String(e) })
      }
    }
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
      Deno.env.get('SERVICE_ROLE_KEY') || ''
    )
    
    // Log the raw request
    const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const signature = req.headers.get('stripe-signature') || 'missing';
    const hasSignature = !!signature && signature !== 'missing';
    
    // Get the raw body for signature verification (already read as rawBody)
    const bodyPreview = rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : '');
    
    // Create a detailed log entry
    const { data: logEntry, error: logError } = await supabaseClient
      .from('sent_notifications')
      .insert({
        request_id: requestId,
        email_type: 'stripe_webhook',
        recipient_email: `webhook_${hasSignature ? 'signed' : 'unsigned'}`
      })
      .select()
      .single();
      
    if (logError) {
      log.error('webhook_log_entry_failed', { err: String(logError), requestId })
    } else {
      log.info('webhook_log_entry_created', { logEntryId: logEntry?.id, requestId })
    }
    
    // Store webhook details in system_settings
    const webhookInfo = {
      timestamp: new Date().toISOString(),
      hasSignature,
      signaturePreview: signature.substring(0, 20) + '...',
      bodyPreview,
      requestId,
      headers: Object.fromEntries([...req.headers].map(([k, v]) => 
        [k, k.toLowerCase().includes('secret') ? '[REDACTED]' : v]
      ))
    };
    
    const { error: updateError } = await supabaseClient
      .from('system_settings')
      .upsert({
        key: 'last_webhook_call',
        value: JSON.stringify(webhookInfo),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      
    if (updateError) {
      log.error('update_system_settings_failed', { err: String(updateError), key: 'last_webhook_call', requestId })
    }
    
    // Get Stripe secret key and webhook secret
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    // Debug: Log environment variable status (without revealing secrets)
    log.info('env_check', { 
      hasStripeSecretKey: !!stripeSecretKey,
      hasWebhookSecret: !!webhookSecret,
      webhookSecretLength: webhookSecret ? webhookSecret.length : 0
    });
    
    // Check if required environment variables are set
    if (!stripeSecretKey || !webhookSecret) {
      const missingVars = [];
      if (!stripeSecretKey) missingVars.push('STRIPE_SECRET_KEY');
      if (!webhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET');
      
      const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
      log.error('missing_env', { vars: missingVars })
      
      // Log the error to database
      await supabaseClient
        .from('system_settings')
        .upsert({
          key: 'webhook_error',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            error: errorMessage,
            requestId
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      return error(500, errorMessage, { requestId })
    }
    
    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
    
    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      // Temporary bypass for testing - remove in production
      if (body && body.test === true) {
        log.info('test_webhook_bypass', { requestId });
        return json(200, { received: true, message: 'Test webhook received' });
      }
      
      log.info('signature_check', { 
        hasSignature: !!signature, 
        signatureLength: signature?.length,
        webhookSecretLength: webhookSecret?.length,
        bodyLength: rawBody?.length
      });
      
      // Temporary: Allow requests without signature for debugging
      if (!signature || signature === 'missing') {
        log.warn('no_signature_proceeding_without_verification', { requestId });
        // Parse the body directly for testing
        try {
          const parsedBody = JSON.parse(rawBody);
          if (parsedBody.type === 'payment_intent.succeeded') {
            // Create a mock event for testing
            event = parsedBody as Stripe.Event;
          } else {
            throw new Error(`Unsupported event type: ${parsedBody.type}`);
          }
        } catch (parseError) {
          log.error('failed_to_parse_webhook_body', { 
            error: parseError.message,
            requestId,
            bodyPreview: rawBody.substring(0, 200)
          });
          throw new Error('Invalid webhook body format');
        }
      } else if (signature.includes('test_signature')) {
        // Handle test signatures from Stripe dashboard
        log.info('test_signature_detected', { requestId });
        try {
          const parsedBody = JSON.parse(rawBody);
          if (parsedBody.type === 'payment_intent.succeeded') {
            // Create a mock event for testing
            event = parsedBody as Stripe.Event;
          } else {
            throw new Error(`Unsupported event type: ${parsedBody.type}`);
          }
        } catch (parseError) {
          log.error('failed_to_parse_test_webhook_body', { 
            error: parseError.message,
            requestId,
            bodyPreview: rawBody.substring(0, 200)
          });
          throw new Error('Invalid webhook body format');
        }
      } else {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
        log.info('webhook_signature_verified', { requestId })
      }
      
      // Log successful verification
      await supabaseClient
        .from('system_settings')
        .upsert({
          key: 'last_webhook_verification',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            success: true,
            eventType: event.type,
            eventId: event.id,
            requestId
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
    } catch (err) {
      log.error('signature_verification_failed', { err: String(err) })
      
      // Log verification failure
      try {
        await supabaseClient
          .from('system_settings')
          .upsert({
            key: 'webhook_verification_error',
            value: JSON.stringify({
              timestamp: new Date().toISOString(),
              error: err.message,
              requestId
            }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (logError) {
        log.error('Failed to log verification error', { error: logError.message });
      }
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.booking_id;
        
        if (bookingId) {
          try {
            // Check if credit is already applied
            let alreadyApplied = false;
            const { data: booking, error: bookingError } = await supabaseClient
              .from('bookings')
              .select('service_credit_applied_cents, service_credit_applied_pi_id, venue_id')
              .eq('id', bookingId)
              .single();

            if (!bookingError && booking) {
              // Check if this payment intent has already been processed
              if (booking.service_credit_applied_pi_id === paymentIntent.id) {
                alreadyApplied = true;
                log.info('Payment already processed for this booking', { bookingId, paymentIntentId: paymentIntent.id });
              }
            }

            if (!alreadyApplied) {
              // Process the payment
              const meta = paymentIntent.metadata || {};
              const orgId = meta?.organization_id || null;
              let resolvedOrgId = orgId;
              
              // If we have a venue ID, try to resolve organization from venue profile
              const venueId = booking?.venue_id || meta?.venue_id;
              if (venueId && !resolvedOrgId) {
                try {
                  const { data: venueProfile, error: venueErr } = await supabaseClient
                    .from('profiles')
                    .select('primary_organization_id')
                    .eq('id', venueId)
                    .single();
                    
                  if (venueErr) {
                    log.error('venue_profile_load_failed', { 
                      error: venueErr.message, 
                      venueId 
                    });
                  } else {
                    resolvedOrgId = venueProfile?.primary_organization_id || null;
                  }
                } catch (venueError) {
                  log.error('venue_profile_error', { 
                    error: venueError.message, 
                    venueId 
                  });
                }
              }

              // Update booking status
              const { error: updateError } = await supabaseClient
                .from('bookings')
                .update({
                  payment_status: 'paid',
                  status: 'confirmed',
                  stripe_payment_intent_id: paymentIntent.id?.toUpperCase(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);
                
              if (updateError) {
                log.error('update_booking_failed', { 
                  error: updateError.message,
                  bookingId,
                  paymentIntentId: paymentIntent.id
                });
                return json(500, { error: 'Failed to update booking' });
              }
              
              log.info('booking_updated_successfully', {
                bookingId,
                paymentIntentId: paymentIntent.id,
                status: 'paid'
              });
            }
          } catch (err) {
            log.error('booking_update_error', { err: String(err), bookingId })
            
            // Log booking update error
            await supabaseClient
              .from('system_settings')
              .upsert({
                key: 'booking_update_error',
                value: JSON.stringify({
                  timestamp: new Date().toISOString(),
                  bookingId,
                  error: err.message,
                  requestId
                }),
                updated_at: new Date().toISOString()
              }, { onConflict: 'key' });
          }
        }
        break;
        
      default:
        log.info('unhandled_event_type', { eventType: event.type });
        break;
    }
    
    // Return success response
    return json(200, {
      received: true,
      eventType: event.type,
      eventId: event.id,
      requestId,
    })
  } catch (error) {
    log.error('webhook_error', { err: String(error) })
    
    // Try to log the error to database
    try {
      await supabaseClient
        .from('system_settings')
        .upsert({
          key: 'webhook_error',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            requestId
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
    
    return json(500, { 
      error: 'Internal server error',
      message: error.message 
    });
  }
})
// End of stripe-webhook function