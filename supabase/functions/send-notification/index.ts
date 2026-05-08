import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { createLogger } from '../_shared/logger.ts'

// Define the attachment interface
interface EmailAttachment {
  content: string;
  name: string;
  contentType: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Brevo email templates
const BREVO_TEMPLATES = {
  message_received: 1, // Template #1
  inquiry_response: 2, // Template #2
  booking_confirmed: 3, // Template #3
  payment_confirmation: 4, // Template #4
  payment_received: 5, // Template #5
  payment_request: 6, // Template #6
  new_inquiry: 7, // Template #7
  booking_cancellation: 8, // Template #8
  review_reminder: 11, // Template #11
}

Deno.serve({ 
  permissions: {
    net: ["api.brevo.com", "*.supabase.co"]
  }
}, async (req) => {
  const hdrCorrelation = req.headers.get('x-correlation-id') || req.headers.get('x-request-id') || undefined
  // Some callers pass requestId in body; we will also read after parsing. For now, seed if header exists.
  let correlationId = hdrCorrelation
  const baseLog = createLogger({ function: 'send-notification', correlationId })
  const log = baseLog.child({})
  log.info('function_started')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    log.info('request_received', { ts: new Date().toISOString() })
    
    // Initialize Supabase client first, before any database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
      Deno.env.get('SERVICE_ROLE_KEY') || ''
    )
    
    // Parse request body
    let requestBody: any;
    try {
      const text = await req.text();
      try {
        requestBody = JSON.parse(text);
      } catch (parseError) {
        log.error('json_parse_error', { err: String(parseError), rawPreview: text.substring(0, 200) + (text.length > 200 ? '...' : '') })
        throw new Error('Invalid JSON in request body: ' + parseError.message);
      }
    } catch (e) {
      log.error('request_body_parse_error', { err: String(e) })
      throw new Error('Invalid request body: ' + e.message);
    }
    
    const { type, recipient, sender, data } = requestBody;
    const requestId = data?.requestId || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    // Now that we have body, finalize correlationId
    correlationId = correlationId || requestId
    const reqLog = baseLog.child({ correlationId, requestId })
    const log2 = reqLog.child({})
    // From here on, use log2
    
    // Extract and validate attachments
    const attachments = requestBody.attachments || [];
    const hasAttachments = attachments.length > 0;
    
    log2.info('processing_notification_request', { type, recipientEmail: recipient?.email, senderEmail: sender?.email || 'default', hasAttachments: !!data?.attachments })
    
    if (hasAttachments) {
      log2.info('attachments_found', { count: attachments.length })
      attachments.forEach((attachment: any, index: number) => {
        if (!attachment.content || !attachment.name || !attachment.contentType) {
          log2.warn('attachment_missing_fields', { index })
        } else {
          log2.info('attachment_valid', { index, name: attachment.name, contentType: attachment.contentType, contentLength: attachment.content.length })
        }
      });
    }
    
    // Check if this notification has already been sent (idempotency check)
    try {
      const { data: existingNotification, error: checkError } = await supabaseClient
        .from('sent_notifications')
        .select('id, created_at')
        .eq('request_id', requestId)
        .maybeSingle();
      
      if (checkError) {
        log2.warn('idempotency_check_error', { err: String(checkError) })
        // Continue processing even if check fails - better to risk duplicate than missing notification
      } else if (existingNotification) {
        log2.info('notification_already_sent', { sentAt: existingNotification.created_at })
        return new Response(
          JSON.stringify({ 
            success: true, 
            alreadySent: true,
            originalSentAt: existingNotification.created_at,
            requestId: requestId,
            message: 'Notification already sent'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    } catch (e) {
      log2.error('idempotency_check_exception', { err: String(e) })
      // Continue processing even if check fails
    }

    // Get the session/user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log2.warn('missing_authorization_header')
      // Don't throw error - continue processing as this might be a system-triggered notification
    }

    let user = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError) {
        log2.warn('auth_error_but_continuing', { err: authError.message })
      } else if (userData?.user) {
        user = userData.user;
        if (user) {
          log2.info('authenticated_user', { userId: user.id })
        }
      }
    } else {
      log2.info('no_auth_header_system_notification')
    }
    
    // Get sender information
    let senderEmail = 'support@splitspace.com'; // Default fallback

    // Use sender from request if provided
    if (sender && sender.email) {
      senderEmail = sender.email;
      log2.info('using_sender_email_from_request', { senderEmail })
    }
    
    // Validate required fields
    const validationErrors: string[] = [];
    if (!type) {
      validationErrors.push('type');
    }
    if (!recipient || !recipient.email) {
      validationErrors.push('recipient.email');
    }
    if (!recipient || !recipient.name) {
      validationErrors.push('recipient.name');
    }
    if (!data) {
      validationErrors.push('data');
    }
    
    if (validationErrors.length > 0) {
      const errorMessage = `Missing required fields: ${validationErrors.join(', ')}`;
      log2.error('validation_error', { errorMessage })
      
      // Log validation error to database
      try {
        await supabaseClient
          .from('webhook_notification_log')
          .insert({
            payment_intent_id: data?.paymentIntentId || null,
            booking_id: data?.bookingId || null,
            notification_type: type || 'unknown',
            recipient_email: recipient?.email || 'missing_email',
            recipient_name: recipient?.name || 'missing_name',
            status: 'validation_error',
            error: errorMessage,
            response_data: { requestBody: JSON.stringify(requestBody) }
          });
      } catch (logError) {
        log2.error('validation_error_log_failed', { err: String(logError) })
      }
      
      throw new Error(errorMessage);
    }
    
    // Get Brevo API key from environment variables
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      log2.error('brevo_api_key_missing')
      
      // Log API key error to database
      try {
        await supabaseClient
          .from('webhook_notification_log')
          .insert({
            payment_intent_id: data?.paymentIntentId || null,
            booking_id: data?.bookingId || null,
            notification_type: type,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            status: 'config_error',
            error: 'Brevo API key not configured. Please set BREVO_API_KEY in Supabase project environment variables.',
            response_data: null
          });
      } catch (logError) {
        log2.error('api_key_error_log_failed', { err: String(logError) })
      }
      
      throw new Error('Email service not configured. Please set BREVO_API_KEY in your Supabase project environment variables.');
    }

    // Get template ID
    const templateId = BREVO_TEMPLATES[type as keyof typeof BREVO_TEMPLATES];
    if (!templateId) {
      log2.error('unknown_template_type', { type, available: Object.keys(BREVO_TEMPLATES) })
      
      // Log template error to database
      try {
        await supabaseClient
          .from('webhook_notification_log')
          .insert({
            payment_intent_id: data?.paymentIntentId || null,
            booking_id: data?.bookingId || null,
            notification_type: type,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            status: 'template_error',
            error: `Unknown template type: ${type}. Available types: ${Object.keys(BREVO_TEMPLATES).join(', ')}`,
            response_data: null
          });
      } catch (logError) {
        log2.error('template_error_log_failed', { err: String(logError) })
      }
      
      throw new Error(`Unknown template type: ${type}. Available types: ${Object.keys(BREVO_TEMPLATES).join(', ')}`);
    } else {
      log2.info('template_selected', { templateId, type })
    }

    // Prepare email data with comprehensive variable mapping
    const templateParams = {
      // Standard naming conventions
      // Date formatting for display
      START_DATE: data.startDate ? new Date(data.startDate).toLocaleDateString() : '',
      END_DATE: data.endDate ? new Date(data.endDate).toLocaleDateString() : '', 
      BOOKING_DATE_RANGE: data.startDate && data.endDate ? 
        `${new Date(data.startDate).toLocaleDateString()} - ${new Date(data.endDate).toLocaleDateString()}` : '',
      FORMATTED_AMOUNT: data.amount && data.currency ? 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(Number(data.amount)) : '',
      
      RECIPIENT_NAME: recipient.name,
      SENDER_NAME: data.senderName || 'SplitSpace User',
      PROPERTY_TITLE: data.propertyTitle || 'Your Property',
      MESSAGE_CONTENT: (data.MESSAGE_CONTENT || data.messageContent || '').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
      TIMESTAMP: data.timestamp || new Date().toLocaleString(),
      REPLY_LINK: data.replyLink || '#',
      REVIEW_LINK: data.reviewLink || data.review_link || data.action_link || '#',
      ACTION_LINK: data.action_link || data.reviewLink || data.review_link || '#',

      
      // Alternative naming (camelCase)
      recipientName: recipient.name,
      senderName: data.senderName || 'SplitSpace User',
      startDate: data.startDate ? new Date(data.startDate).toLocaleDateString() : '',
      endDate: data.endDate ? new Date(data.endDate).toLocaleDateString() : '',
      bookingDateRange: data.startDate && data.endDate ? 
        `${new Date(data.startDate).toLocaleDateString()} - ${new Date(data.endDate).toLocaleDateString()}` : '',
      formattedAmount: data.amount && data.currency ? 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(Number(data.amount)) : '',
      propertyTitle: data.propertyTitle || 'Your Property',
      messageContent: (data.MESSAGE_CONTENT || data.messageContent || '').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
      timestamp: data.timestamp || new Date().toLocaleString(),
      replyLink: data.replyLink || '#',
      reviewLink: data.reviewLink || data.review_link || data.action_link || '#',
      actionLink: data.action_link || data.reviewLink || data.review_link || '#',

      
      // Alternative naming (snake_case)
      recipient_name: recipient.name,
      sender_name: data.senderName || 'SplitSpace User',
      start_date: data.startDate ? new Date(data.startDate).toLocaleDateString() : '',
      end_date: data.endDate ? new Date(data.endDate).toLocaleDateString() : '',
      booking_date_range: data.startDate && data.endDate ? 
        `${new Date(data.startDate).toLocaleDateString()} - ${new Date(data.endDate).toLocaleDateString()}` : '',
      formatted_amount: data.amount && data.currency ? 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(Number(data.amount)) : '',
      property_title: data.propertyTitle || 'Your Property',
      message_content: (data.MESSAGE_CONTENT || data.messageContent || '').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
      reply_link: data.replyLink || '#',
      review_link: data.review_link || data.reviewLink || data.action_link || '#',
      action_link: data.action_link || data.reviewLink || data.review_link || '#',
      
      // Additional useful variables
      PLATFORM_NAME: 'SplitSpace',
      SUPPORT_EMAIL: 'support@splitspace.com',
      WEBSITE_URL: Deno.env.get('FRONTEND_URL') || 'https://splitspace.com',
      DASHBOARD_URL: data.dashboardUrl || `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard`,
      BOOKING_DETAILS_URL: data.bookingId ? 
        `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard?booking=${data.bookingId}` : 
        `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard`,
      
      // Payment-specific variables
      AMOUNT: data.amount || '',
      CURRENCY: data.currency || 'USD',
      BOOKING_ID: data.bookingId || '',
      CUSTOMER_NAME: data.customerName || '',
      VENUE_OWNER: data.venueOwner || '',
      LOCATION: data.location || '',
      
      // Alternative naming for payment variables
      amount: data.amount || '',
      currency: data.currency || 'USD',
      bookingId: data.bookingId || '',
      dashboardUrl: data.dashboardUrl || `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard`,
      bookingDetailsUrl: data.bookingId ? 
        `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard?booking=${data.bookingId}` : 
        `${Deno.env.get('FRONTEND_URL') || 'https://splitspace.com'}/dashboard`,
      customerName: data.customerName || '',
      venueOwner: data.venueOwner || '',
      location: data.location || ''
    };

    log2.info('template_parameters_prepared', { count: Object.keys(templateParams).length })
    
    // Record the sent notification in the database for idempotency BEFORE sending
    // This ensures we don't send duplicates even if the function is called multiple times
    try {
      const { error: insertError } = await supabaseClient
        .from('sent_notifications')
        .upsert({
          request_id: requestId,
          email_type: type,
          recipient_email: recipient.email,
          has_attachments: !!data.attachments
        }, { onConflict: 'request_id' });
      
      if (insertError) {
        // Check if this is a duplicate key error (code 23505)
        if (insertError.code === '23505') {
          log2.info('notification_record_exists_race_condition')
          return new Response(
            JSON.stringify({ 
              success: true, 
              alreadySent: true,
              requestId: requestId,
              message: 'Notification already recorded (concurrent request)'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        } else {
          log2.error('sent_notification_record_error', { err: String(insertError) })
          // Continue with sending - better to risk a duplicate than miss a notification
        }
      } else {
        log2.info('sent_notification_recorded_before_send')
      }
    } catch (e) {
      log2.error('sent_notification_insert_exception', { err: String(e) })
      // Continue with sending - better to risk a duplicate than miss a notification
    }
    
    // Prepare the email data with sender information
    let emailPayload: any = {
      to: [
        { 
          email: recipient.email,
          name: recipient.name
        }
      ],
      templateId: templateId,
      params: templateParams,
      sender: {
        email: senderEmail,
        name: 'SplitSpace'
      }
    };
    
    // Handle attachments if provided
    if (data.attachments && Array.isArray(data.attachments)) {
      log2.info('processing_attachments_from_request_data', { count: data.attachments.length })
      try {
        // Validate each attachment
        const validAttachments = data.attachments.filter((attachment: EmailAttachment) => 
          attachment && attachment.content && attachment.name && attachment.contentType
        );
        
        if (validAttachments.length > 0) {
          log2.info('attachments_added_to_email', { count: validAttachments.length })
          emailPayload.attachment = validAttachments;
          
          // Log attachment details for debugging
          validAttachments.forEach((attachment: EmailAttachment, index: number) => {
            log2.info('attachment_detail', { index: index + 1, name: attachment.name, contentType: attachment.contentType, contentLength: attachment.content ? attachment.content.length : 0 })
          });
        } else {
          log2.info('no_valid_attachments_in_request')
        }
      } catch (attachmentError) {
        log2.error('attachments_processing_error', { err: String(attachmentError) })
      }
    } else if (attachments && Array.isArray(attachments)) {
      log2.info('processing_attachments_from_direct_param', { count: attachments.length })
      try {
        // Validate each attachment
        const validAttachments = attachments.filter((attachment: EmailAttachment) => 
          attachment && attachment.content && attachment.name && attachment.contentType
        );
        
        if (validAttachments.length > 0) {
          log2.info('attachments_added_from_direct_param', { count: validAttachments.length })
          emailPayload.attachment = validAttachments;
          
          // Log attachment details for debugging
          validAttachments.forEach((attachment: EmailAttachment, index: number) => {
            log2.info('attachment_detail', { index: index + 1, name: attachment.name, contentType: attachment.contentType, contentLength: attachment.content ? attachment.content.length : 0 })
          });
        } else {
          log2.info('no_valid_attachments_in_direct_param')
        }
      } catch (attachmentError) {
        log2.error('attachments_direct_processing_error', { err: String(attachmentError) })
      }
    }
    
    log2.info('sender_email_effective', { senderEmail })

    // Send email via Brevo
    let brevoResponse;
    try {
      log2.info('brevo_send_request')
      
      // Log the payload structure (without the actual content for security)
      const payloadSummary = {
        to: emailPayload.to,
        templateId: emailPayload.templateId,
        paramKeys: Object.keys(emailPayload.params || {}),
        sender: emailPayload.sender,
        hasAttachments: !!emailPayload.attachment,
        attachmentCount: emailPayload.attachment ? emailPayload.attachment.length : 0,
        attachmentDetails: emailPayload.attachment ? emailPayload.attachment.map((a: any) => ({
          name: a.name,
          contentType: a.contentType,
          contentLength: a.content ? a.content.length : 0
        })) : []
      };
      log2.info('email_payload_summary', payloadSummary)
      
      brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', 
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify(emailPayload)
      });
      
      if (!brevoResponse.ok) {
        let errorText = '';
        let errorJson = null;
        
        try {
          const responseText = await brevoResponse.text();
          errorText = responseText;
          
          try {
            errorJson = JSON.parse(responseText);
          } catch (jsonError) {
            // Not JSON, keep as text
          }
        } catch (e) {
          errorText = `Could not read error response: ${e.message}`;
        }
        
        log2.error('brevo_api_error_response', { status: brevoResponse.status, errorText })
        
        // Log API error to database
        try {
          await supabaseClient
            .from('webhook_notification_log')
            .insert({
              payment_intent_id: data?.paymentIntentId || null,
              booking_id: data?.bookingId || null,
              notification_type: type,
              recipient_email: recipient.email || 'unknown',
              recipient_name: recipient.name,
              status: 'api_error',
              error: `Brevo API error: ${brevoResponse.status} - ${errorText ? errorText.substring(0, 200) : 'No error text'}`,
              response_data: errorJson,
              has_attachments: !!emailPayload.attachment
            });
        } catch (logError) {
          log2.error('api_error_log_failed', { err: String(logError) })
        }
        
        throw new Error(`Brevo API error: ${brevoResponse.status} - ${errorText.substring(0, 200)}`);
      }
      
      log2.info('brevo_api_response_status', { status: brevoResponse.status })
    } catch (e) {
      log2.error('brevo_network_error', { err: String(e) })
      
      // Log network error to database
      try {
        await supabaseClient
          .from('webhook_notification_log')
          .insert({
            payment_intent_id: data?.paymentIntentId || null,
            booking_id: data?.bookingId || null,
            notification_type: type,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            status: 'network_error', 
            error: `Failed to connect to Brevo API: ${e.message}`,
            response_data: null,
            has_attachments: !!emailPayload.attachment
          });
      } catch (logError) {
        log2.error('network_error_log_failed', { err: String(logError) })
      }
      
      throw new Error('Failed to connect to Brevo API: ' + e.message);
    }

    let result;
    let messageId;
    try {
      result = await brevoResponse.json();
      messageId = result.messageId;
      
      log2.info('brevo_response_success', { messageId })
      
      // Log successful notification to database
      try {
        const logData = {
          payment_intent_id: data?.paymentIntentId || null,
          booking_id: data?.bookingId || null,
          notification_type: type,
          recipient_email: recipient.email, 
          recipient_name: recipient.name,
          status: 'success', 
          error: null,
          response_data: { messageId },
          has_attachments: !!emailPayload.attachment
        };
        
        log2.info('logging_successful_notification', { type, recipient: recipient.email, messageId, hasAttachments: !!emailPayload.attachment })
        
        await supabaseClient
          .from('webhook_notification_log')
          .insert(logData);
      } catch (logError) {
        log2.error('success_log_failed', { err: String(logError) })
      }
    } catch (e) {
      log2.error('brevo_response_parse_error', { err: String(e) })
      
      // Log parsing error to database
      try {
        await supabaseClient
          .from('webhook_notification_log')
          .insert({
            payment_intent_id: data?.paymentIntentId || null,
            booking_id: data?.bookingId || null,
            notification_type: type,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            status: 'parse_error', 
            error: `Invalid response from Brevo API: ${e.message}`,
            response_data: null,
            has_attachments: !!emailPayload.attachment
          });
      } catch (logError) {
        log2.error('parse_error_log_failed', { err: String(logError) })
      }
      
      throw new Error('Invalid response from Brevo API');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: messageId,
        timestamp: new Date().toISOString(),
        templateUsed: templateId,
        requestId: requestId,
        recipient: recipient.email, 
        sender: senderEmail, 
        parametersSent: Object.keys(templateParams),
        hasAttachments: !!emailPayload.attachment,
        debug: {
          templateId,
          recipientEmail: recipient.email,
          senderEmail: senderEmail,
          requestId: requestId, 
          parameterCount: Object.keys(templateParams).length,
          attachmentCount: emailPayload.attachment ? emailPayload.attachment.length : 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    baseLog.error('send_notification_error', { err: errMsg, correlationId })
    
    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});