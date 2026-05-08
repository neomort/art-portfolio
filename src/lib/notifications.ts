import { supabase } from './supabase';
import { env } from './env';

// Define the attachment interface
interface EmailAttachment {
  content: string;
  name: string;
  contentType: string;
}

// Default sender email if not configured in the database
const DEFAULT_SENDER_EMAIL = 'support@splitspace.com';

/**
 * Get the configured sender email from system settings
 * Falls back to the default if not found
 */
export async function getSenderEmail(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'email_sender')
      .maybeSingle();
    
    if (error || !data) {
      console.warn('Could not retrieve sender email from database:', error?.message);
      return DEFAULT_SENDER_EMAIL;
    }
    
    return data.value;
  } catch (err) {
    console.error('Error getting sender email:', err);
    return DEFAULT_SENDER_EMAIL;
  }
}

/**
 * Generate a deterministic request ID based on entity type and ID
 * This ensures idempotency even if the function is called multiple times
 */
export function generateRequestId(type: string, entityId: string): string {
  return `${type}_${entityId}`;
}

/**
 * Send a notification email using the Brevo integration
 * 
 * @param type - The type of notification (corresponds to Brevo template)
 * @param recipient - The recipient's email and name
 * @param data - The data to include in the email template
 * @returns Promise with the result of the notification attempt
 */
export async function sendNotification(
  type: 'message_received' | 'inquiry_response' | 'booking_confirmed' | 'payment_received' | 'payment_requested' | 'new_inquiry',
  recipient: { email: string; name: string },
  data: {
    senderName?: string;
    propertyTitle?: string;
    messageContent?: string;
    timestamp?: string;
    replyLink?: string;
    startDate?: string;
    endDate?: string;
    amount?: string;
    currency?: string; 
    bookingId?: string;
    customerName?: string;
    venueOwner?: string;
    location?: string;
    bookingDateRange?: string;
    bookingDetailsUrl?: string;
    attachments?: EmailAttachment[];
    dashboardUrl?: string;
    requestId?: string; // Optional request ID for tracing
    [key: string]: any; // Allow additional custom parameters
  } = {},
  attachments?: { content: string; name: string; contentType: string }[]
) {
  try {
    // Validate environment configuration first
    const supabaseUrl = env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is not set. Please check your .env file and restart the dev server.');
    }
    
    if (!supabaseUrl.startsWith('http')) {
      throw new Error(`Invalid VITE_SUPABASE_URL format: "${supabaseUrl}". It should start with https:// - please check your .env file and restart the dev server.`);
    }
    
    if (supabaseUrl.includes('undefined') || supabaseUrl.includes('your-project')) {
      throw new Error(`VITE_SUPABASE_URL appears to be a placeholder: "${supabaseUrl}". Please set it to your actual Supabase project URL in your .env file and restart the dev server.`);
    }

    // Clone the data to avoid modifying the original object
    const messageData = { ...data };
    const hasAttachments = !!(messageData.attachments && Array.isArray(messageData.attachments) && messageData.attachments.length > 0);
    
    // Generate a request ID if not provided
    const requestId = messageData.requestId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`[${requestId}] Preparing to send notification: type=${type}, recipient=${recipient.email}, hasAttachments=${hasAttachments}`);
    console.log(`[${requestId}] Using Supabase URL: ${supabaseUrl}`);
    
    // Add formatted variables if not already present
    if (messageData.amount && messageData.currency && !messageData.formattedAmount) {
      try {
        messageData.formattedAmount = new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: messageData.currency 
        }).format(Number(messageData.amount));
        console.log(`[${requestId}] Added formatted amount: ${messageData.formattedAmount}`);
      } catch (e) {
        console.warn(`[${requestId}] Failed to format amount:`, e);
      }
    }
    
    // Add booking date range if not already present
    if (messageData.startDate && messageData.endDate && !messageData.bookingDateRange) {
      try {
        // Use the dateRange parameter if provided, otherwise create a simple one
        if (messageData.dateRange) {
          messageData.bookingDateRange = messageData.dateRange;
        } else {
          messageData.bookingDateRange = `${new Date(messageData.startDate).toLocaleDateString()} - ${new Date(messageData.endDate).toLocaleDateString()}`;
        }
        console.log(`[${requestId}] Added booking date range: ${messageData.bookingDateRange}`);
      } catch (e) {
        console.warn(`[${requestId}] Failed to create booking date range:`, e);
      }
    }
    
    // Add booking details URL if not already present
    if (messageData.bookingId && !messageData.bookingDetailsUrl) {
      const frontendUrl = (env as any).VITE_FRONTEND_URL || 'https://splitspace.com';
      messageData.bookingDetailsUrl = `${frontendUrl}/dashboard?booking=${messageData.bookingId}`;
      console.log(`[${requestId}] Added booking details URL: ${messageData.bookingDetailsUrl}`);
    }

    // Log attachment details if present
    if (attachments && attachments.length > 0) {
      console.log(`[${requestId}] Sending with ${attachments.length} attachments:`);
      attachments.forEach((attachment, index) => {
        console.log(`[${requestId}] Attachment ${index + 1}: ${attachment.name}, type: ${attachment.contentType}, content length: ${attachment.content.length} chars`);
      });
    }

    // Check if this notification has already been sent (idempotency check)
    try {
      const { data: existingNotification, error: checkError } = await supabase
        .from('sent_notifications')
        .select('id, created_at, has_attachments')
        .eq('request_id', requestId)
        .maybeSingle();
      
      if (checkError) {
        console.warn(`[${requestId}] Error checking for existing notification:`, checkError);
        // Continue processing even if check fails - better to risk duplicate than missing notification
      } else if (existingNotification) {
        console.log(`[${requestId}] Notification already sent at ${existingNotification.created_at}, skipping`);
        return {
          success: true,
          alreadySent: true,
          originalSentAt: existingNotification.created_at,
          requestId: requestId,
          message: 'Notification already sent'
        };
      }
    } catch (e) {
      console.error(`[${requestId}] Error during idempotency check:`, e);
      // Continue processing even if check fails
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User session not found');
    }
    
    // Get the configured sender email
    const senderEmail = await getSenderEmail();
    
    console.log(`[${requestId}] Using sender email: ${senderEmail}, template: ${type}, attachments: ${attachments?.length || 0}`);

    const functionUrl = `${supabaseUrl}/functions/v1/send-notification`; 
    console.log(`[${requestId}] Sending notification to: ${recipient.email}, type: ${type}`);
    console.log(`[${requestId}] Edge function URL: ${functionUrl}`);

    // Log the data being sent for debugging
    console.log(`[${requestId}] Notification data:`, {
      type,
      recipient,
      dataKeys: Object.keys(messageData),
      message_content: messageData.message_content,
      MESSAGE_CONTENT: messageData.MESSAGE_CONTENT,
      message_content_length: messageData.message_content?.length || 0,
      MESSAGE_CONTENT_length: messageData.MESSAGE_CONTENT?.length || 0,
      allData: messageData, // Log all data to see what's being sent
      requestId, 
      hasAttachments
    }); 
    
    if (attachments && attachments.length > 0) {
      console.log(`[${requestId}] Sending with ${attachments.length} attachments`);
    }

    // Test basic connectivity to Supabase first
    console.log(`[${requestId}] Testing connectivity to Supabase...`);
    try {
      const connectivityTest = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': env.VITE_SUPABASE_ANON_KEY || '',
        },
      });
      console.log(`[${requestId}] Connectivity test result: ${connectivityTest.status}`);
    } catch (connectivityError) {
      const connMsg = connectivityError instanceof Error ? connectivityError.message : String(connectivityError);
      console.error(`[${requestId}] Connectivity test failed:`, connectivityError);
      throw new Error(`Cannot connect to Supabase at ${supabaseUrl}. Please check your internet connection and Supabase URL configuration. Original error: ${connMsg}`);
    }
    let response;
    try {
      console.log(`[${requestId}] Calling edge function with session token...`);
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          recipient,
          sender: { email: senderEmail },
          data: {
            ...messageData,
            requestId, // Include the request ID in the data sent to the edge function
            timestamp: messageData.timestamp || new Date().toLocaleString(),
          }, 
          attachments
        }), 
      });
    } catch (fetchError) {
      const fetchMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error(`[${requestId}] Network error calling edge function:`, fetchError);
      
      // Provide more specific error messages based on the error type
      if (fetchMsg.includes('Failed to fetch')) {
        throw new Error(`Failed to connect to notification service at ${functionUrl}. This could be due to:
1. The send-notification edge function is not deployed in your Supabase project
2. Network connectivity issues
3. Incorrect Supabase URL configuration
4. CORS issues

Please check:
- Your Supabase Dashboard → Edge Functions to ensure 'send-notification' is deployed
- Your .env file has the correct VITE_SUPABASE_URL
- Your internet connection is working

Original error: ${fetchMsg}`);
      } else {
        throw new Error(`Network error calling edge function: ${fetchMsg}`);
      }
    }

    console.log(`[${requestId}] Edge function response status: ${response.status}`);
    
    if (!response.ok) {
      let errorMessage = `Failed to send notification: ${response.status} ${response.statusText}`;
      try {
        const responseText = await response.text();
        console.error(`[${requestId}] Edge function error response:`, responseText);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse the JSON, use the raw text
          errorMessage = `Failed to send notification: ${responseText.substring(0, 100)}`;
        }
      } catch (e) {
        // If we can't parse the JSON, just use the status text
      }
      
      // Add specific guidance for common HTTP errors
      if (response.status === 404) {
        errorMessage += `\n\nThe send-notification edge function was not found. Please ensure it is deployed in your Supabase project.`;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage += `\n\nAuthentication error. Please try signing out and signing back in.`;
      } else if (response.status >= 500) {
        errorMessage += `\n\nServer error in the edge function. Check the edge function logs in your Supabase Dashboard.`;
      }
      
      throw new Error(errorMessage);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const parseMsg = parseError instanceof Error ? parseError.message : String(parseError);
      console.error(`[${requestId}] Error parsing response:`, parseError);
      throw new Error(`Invalid response from notification service: ${parseMsg}`);
    }
    
    console.log(`[${requestId}] Notification sent successfully:`, result);
    
    return result;
  } catch (error) {
    console.error(`Error sending notification:`, error);
    throw error;
  }
}