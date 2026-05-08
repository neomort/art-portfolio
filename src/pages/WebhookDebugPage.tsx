import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Zap, ExternalLink, Copy, Settings, MessagesSquare, Send, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { sendNotification } from '../lib/notifications'; 
import TooltipDebugger from '../components/debug/TooltipDebugger';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateCalendarEvent } from '../lib/calendar';

const WebhookDebugPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [searchPaymentIntentId, setSearchPaymentIntentId] = useState('');
  const [foundBooking, setFoundBooking] = useState<any>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null); 
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [testBookingData, setTestBookingData] = useState({
    recipientEmail: '',
    recipientName: '',
    propertyTitle: 'Downtown Retail Space',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: '100.00',
    currency: 'USD',
    bookingId: 'test-booking-' + Date.now()
  });
  type TemplateType = 'message_received' | 'inquiry_response' | 'booking_confirmed' | 'payment_received' | 'new_inquiry';
  
  const [testMessageData, setTestMessageData] = useState({
    recipientEmail: '',
    senderName: '',
    recipientName: '',
    propertyTitle: '',
    messageContent: '',
    templateType: 'message_received' as TemplateType
  });

  // Validate environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const hasValidConfig = supabaseUrl && supabaseUrl !== 'undefined' && supabaseUrl.startsWith('http');

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadBookings();
    loadInquiries();
  }, [user]);

  useEffect(() => {
    // Show configuration warning if environment variables are missing
    if (!hasValidConfig) {
      setSyncResults(prev => [{
        bookingId: 'config-error',
        success: false,
        message: `❌ Configuration Error: VITE_SUPABASE_URL is not properly configured. Current value: "${supabaseUrl}". Please check your .env file.`,
        timestamp: new Date(),
      }, ...prev]);
    }
  }, [hasValidConfig, supabaseUrl]);

  // Add function to find booking by payment intent ID
  const findBookingByPaymentIntent = async (paymentIntentId: string) => {
    try {
      console.log('Searching for booking with payment intent ID:', paymentIntentId);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

      if (error) {
        console.error('Search error:', error);
        setFoundBooking(null);
        return null;
      }
      
      console.log('Found booking:', data);
      setFoundBooking(data);
      return data;
    } catch (err) {
      console.error('Error searching booking:', err);
      setFoundBooking(null);
      return null;
    }
  };

  const loadBookings = async () => {
    try {
      console.log('Current user ID:', user?.id);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          property:properties(title)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Bookings query error:', error);
        throw error;
      }
      console.log('Raw bookings data:', data);
      setBookings(data || []);
      console.log('Loaded bookings:', data); // Debug log to see actual statuses
    } catch (err) {
      console.error('Error loading bookings:', err);
    }
  };

  const loadInquiries = async () => {
    try {
      // Get properties owned by user
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('venue_id', user!.id);

      const propertyIds = properties?.map(p => p.id) || [];

      // Get inquiries for these properties or made by the user
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          property:properties(title),
          user:profiles!inquiries_user_id_fkey(full_name, email)
        `)
        .or(`user_id.eq.${user!.id}${propertyIds.length ? `,property_id.in.(${propertyIds.join(',')})` : ''}`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setInquiries(data || []);
    } catch (err) {
      console.error('Error loading inquiries:', err);
    }
  };

  const validateEnvironment = () => {
    if (!hasValidConfig) {
      throw new Error('Environment not properly configured. Please check your .env file.');
    }
  };

  const sendTestMessage = async () => {
    setLoading(true);
    setNotificationError(null);
    try {
      // More detailed environment validation
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set in environment variables');
      }
      if (!supabaseUrl.startsWith('http')) {
        throw new Error(`Invalid VITE_SUPABASE_URL format: "${supabaseUrl}"`);
      }
      if (supabaseUrl.includes('undefined') || supabaseUrl.includes('your-project')) {
        throw new Error(`VITE_SUPABASE_URL appears to be a placeholder: "${supabaseUrl}"`);
      }
      
      const result = await sendNotification(
        testMessageData.templateType,
        {
          email: testMessageData.recipientEmail,
          name: testMessageData.recipientName,
        },
        {
          senderName: testMessageData.senderName,
          propertyTitle: testMessageData.propertyTitle,
          messageContent: testMessageData.messageContent,
          dashboardUrl: `${window.location.origin}/dashboard`,
          replyLink: `${window.location.origin}/dashboard`
        }
      );
      
      console.log('Test message result:', result);
      
      setSyncResults(prev => [{
        bookingId: 'test-message',
        success: true,
        message: `✅ Test ${testMessageData.templateType} email sent to ${testMessageData.recipientEmail}`,
        timestamp: new Date(),
      }, ...prev]);
    } catch (err) {
      console.error('Test message error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setNotificationError(errorMessage);
      setSyncResults(prev => [{
        bookingId: 'test-message',
        success: false,
        message: `❌ Failed to send test message: ${errorMessage}`,
        timestamp: new Date(),
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const sendTestBookingConfirmation = async () => {
    setLoading(true);
    setNotificationError(null);
    try {
      // More detailed environment validation
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set in environment variables');
      }
      if (!supabaseUrl.startsWith('http')) {
        throw new Error(`Invalid VITE_SUPABASE_URL format: "${supabaseUrl}"`);
      }
      if (supabaseUrl.includes('undefined') || supabaseUrl.includes('your-project')) {
        throw new Error(`VITE_SUPABASE_URL appears to be a placeholder: "${supabaseUrl}"`);
      }
      
      // Generate ICS file content
      const startDate = new Date(testBookingData.startDate);
      const endDate = new Date(testBookingData.endDate);
      const eventTitle = `Test Booking: ${testBookingData.propertyTitle}`;
      const location = "123 Test Street, Test City, Test State";
      const description = `Your test booking confirmation from SplitSpace.\nBooking ID: ${testBookingData.bookingId}\nAmount: ${testBookingData.amount} ${testBookingData.currency}\nThis is a test email.`;
      
      // Use the calendar utility to generate ICS content
      const icsContent = generateCalendarEvent(
        eventTitle,
        startDate,
        endDate,
        location,
        description,
        'ics',
        true // Set to true for all-day event
      );
      
      // Base64 encode the ICS content for email attachment
      let icsBase64;
      let icsAttachment;
      try {
        // Ensure icsContent is a string
        const icsString = typeof icsContent === 'string' ? icsContent : new TextDecoder().decode(icsContent);
        
        // Use btoa directly for base64 encoding
        icsBase64 = btoa(unescape(encodeURIComponent(icsString)));
        
        // Create the attachment object
        icsAttachment = {
          content: icsBase64,
          name: `booking-${testBookingData.bookingId.substring(0, 8)}.ics`,
          contentType: 'text/calendar'
        };
        
        console.log('Created ICS attachment:', {
          name: icsAttachment.name,
          contentType: icsAttachment.contentType,
          contentLength: icsAttachment.content.length
        });
      } catch (e) {
        console.error('Error encoding ICS content:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setNotificationError('Error encoding ICS content: ' + errorMessage);
        throw e;
      }

      try {
        // Use the notification helper
        console.log('Sending test booking confirmation with ICS attachment');
        
        // Validate dates
        const startDateObj = new Date(testBookingData.startDate);
        const endDateObj = new Date(testBookingData.endDate);
        
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
          throw new Error('Invalid date format. Please use YYYY-MM-DD format for dates.');
        }
        
        const result = await sendNotification(
          'booking_confirmed',
          {
            email: testBookingData.recipientEmail,
            name: testBookingData.recipientName,
          },
          {
            senderName: 'SplitSpace',
            propertyTitle: testBookingData.propertyTitle,
            amount: testBookingData.amount,
            currency: testBookingData.currency,
            bookingId: testBookingData.bookingId,
            venueOwner: 'Test Venue Owner',
            timestamp: new Date().toLocaleDateString(), 
            // Add dates for calendar
            startDate: testBookingData.startDate,
            endDate: testBookingData.endDate,
            // Add location
            location: location,
            dashboardUrl: `${window.location.origin}/dashboard`,
            replyLink: `${window.location.origin}/dashboard`,
            attachments: [icsAttachment]
          },
          [icsAttachment]
        );
        
        console.log('Test booking confirmation result:', result);
        
        setSyncResults(prev => [{
          bookingId: 'test-booking-confirmation',
          success: true,
          message: `✅ Test booking confirmation email with ICS attachment sent to ${testBookingData.recipientEmail}`,
          timestamp: new Date(),
        }, ...prev]);
      } catch (notificationError) {
        console.error('Notification service error:', notificationError);
        const errorMessage = notificationError instanceof Error ? notificationError.message : 'Unknown error';
        setNotificationError(errorMessage);
        
        // Add the error to sync results for better visibility
        setSyncResults(prev => [{
          bookingId: 'test-booking-confirmation',
          success: false,
          message: `❌ Failed to send test booking confirmation: ${errorMessage}`,
          timestamp: new Date(),
        }, ...prev]);
        
        throw notificationError;
      }
    } catch (err) {
      console.error('Test booking confirmation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Only set notification error if it wasn't already set
      if (!notificationError) {
        setNotificationError(errorMessage);
      }
      
      // Only add to sync results if it wasn't already added
      if (!syncResults.some(result => result.bookingId === 'test-booking-confirmation' && !result.success)) {
        setSyncResults(prev => [{
          bookingId: 'test-booking-confirmation',
          success: false,
          message: `❌ Failed to send test booking confirmation: ${errorMessage}`,
          timestamp: new Date(),
        }, ...prev]);
      }
    } finally {
      setLoading(false);
    }
  };


  const sendMessageBetweenUsers = async (inquiryId: string) => {
    setLoading(true);
    try {
      const testMessage = "This is a test message to verify the notification system is working correctly.";
      
      const { error } = await supabase
        .from('messages')
        .insert({
          inquiry_id: inquiryId,
          sender_id: user!.id,
          content: testMessage,
        });

      if (error) throw error;

      setSyncResults(prev => [{
        bookingId: 'real-message',
        success: true,
        message: `✅ Real message sent for inquiry ${inquiryId.slice(0, 8)}... - Check recipient's email!`,
        timestamp: new Date(),
      }, ...prev]);
    } catch (err) {
      console.error('Real message error:', err);
      setSyncResults(prev => [{
        bookingId: 'real-message',
        success: false,
        message: `❌ Failed to send real message: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setLoading(true);
    try {
      validateEnvironment();

      const functionUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;
      
      // Create a test webhook call to see if our function is reachable
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true }),
      });

      const result = await response.json();
      console.log('Test webhook response:', result);
      
      setWebhookTestResult(result);
      
      if (response.status === 200 && result.received) {
        setSyncResults(prev => [{
          bookingId: 'webhook-test',
          success: true,
          message: `✅ Webhook endpoint is working! Environment check: ${JSON.stringify(result.environment)}`,
          timestamp: new Date(),
        }, ...prev]);
      } else {
        setSyncResults(prev => [{
          bookingId: 'webhook-test',
          success: false,
          message: `❌ Webhook configuration issue: ${JSON.stringify(result)}`,
          timestamp: new Date(),
        }, ...prev]);
      }
    } catch (err) {
      console.error('Webhook test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setWebhookTestResult({ error: errorMessage });
      setSyncResults(prev => [{
        bookingId: 'webhook-test',
        success: false,
        message: `❌ Webhook test failed: ${errorMessage}`,
        timestamp: new Date(),
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const syncPaymentStatus = async (bookingId: string, paymentIntentId: string) => {
    setLoading(true);
    try {
      validateEnvironment();

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const functionUrl = `${supabaseUrl}/functions/v1/sync-payment-status`;

      // Call our edge function to check Stripe status
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          paymentIntentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: HTTP ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Sync result:', result);
      
      // Reload bookings to see updated status
      await loadBookings();
      
      setSyncResults(prev => [...prev, {
        bookingId,
        success: true,
        message: result.updated 
          ? `✅ Synced: ${result.oldStatus} → ${result.newStatus}` 
          : `✅ Already up to date (${result.newStatus})`,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncResults(prev => [...prev, {
        bookingId,
        success: false,
        message: `❌ ${err instanceof Error ? err.message : 'Sync failed'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const manualMarkPaid = async (bookingId: string) => {
    try {
     setLoading(true);
      const { error } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('user_id', user!.id);

      if (error) throw error;
     
     // Also update any related inquiry status
     const { data: booking } = await supabase
       .from('bookings')
       .select('proposal_id')
       .eq('id', bookingId)
       .single();
       
     if (booking?.proposal_id) {
       const { data: proposal } = await supabase
         .from('proposals')
         .select('inquiry_id')
         .eq('id', booking.proposal_id)
         .single();
         
       if (proposal?.inquiry_id) {
         await supabase
           .from('inquiries')
           .update({
             status: 'payment_completed',
             updated_at: new Date().toISOString(),
           })
           .eq('id', proposal.inquiry_id);
       }
     }
     
      await loadBookings();
      
      setSyncResults(prev => [...prev, {
        bookingId,
        success: true,
        message: '✅ Manually marked as paid',
        timestamp: new Date(),
      }]);
     setLoading(false);
    } catch (err) {
      console.error('Manual update error:', err);
      setSyncResults(prev => [...prev, {
        bookingId,
        success: false,
        message: `❌ ${err instanceof Error ? err.message : 'Update failed'}`,
        timestamp: new Date(),
      }]);
     setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    if (!hasValidConfig) {
      setSyncResults(prev => [{
        bookingId: 'copy',
        success: false,
        message: '❌ Cannot copy webhook URL: VITE_SUPABASE_URL is not configured',
        timestamp: new Date(),
      }, ...prev]);
      return;
    }

    const url = `${supabaseUrl}/functions/v1/stripe-webhook`;
    navigator.clipboard.writeText(url);
    setSyncResults(prev => [{
      bookingId: 'copy',
      success: true,
      message: '✅ Webhook URL copied to clipboard',
      timestamp: new Date(),
    }, ...prev]);
  };

  const webhookUrl = hasValidConfig ? `${supabaseUrl}/functions/v1/stripe-webhook` : 'CONFIGURATION_ERROR';

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-maroon-800 mb-2">
            Debug & Testing Center
          </h1>
          <p className="text-maroon-600">
            Test webhook configuration, payment statuses, and email notifications
          </p>
        </div>

        {/* Configuration Error Alert */}
        {!hasValidConfig && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center text-red-800">
                <XCircle className="mr-2 h-5 w-5" />
                Configuration Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-red-700">
                  <strong>VITE_SUPABASE_URL</strong> environment variable is not properly configured.
                </p>
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Current value:</strong> "{supabaseUrl || 'undefined'}"
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-sm text-red-800 mb-2"><strong>To fix this:</strong></p>
                  <ol className="text-sm text-red-700 space-y-1 list-decimal list-inside">
                    <li>Check your <code>.env</code> file in the project root</li>
                    <li>Ensure it contains: <code>VITE_SUPABASE_URL=https://your-project.supabase.co</code></li>
                    <li>Replace "your-project" with your actual Supabase project reference</li>
                    <li>Restart the development server after making changes</li>
                    <li>Verify the send-notification edge function is deployed in your Supabase Dashboard</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Find Booking by Payment Intent ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="pi_3Sj2KOP5CLuRNQ4d1vkbjjxD"
                  value={searchPaymentIntentId}
                  onChange={(e) => setSearchPaymentIntentId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => findBookingByPaymentIntent(searchPaymentIntentId)}
                  disabled={!searchPaymentIntentId || loading}
                >
                  Search
                </Button>
              </div>
              
              {foundBooking && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Found Booking:</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>ID:</strong> {foundBooking.id}</p>
                    <p><strong>User ID:</strong> {foundBooking.user_id}</p>
                    <p><strong>Payment Status:</strong> {foundBooking.payment_status}</p>
                    <p><strong>Amount:</strong> ${foundBooking.price_total}</p>
                    <p><strong>Created:</strong> {new Date(foundBooking.created_at).toLocaleString()}</p>
                  </div>
                  {foundBooking.payment_status !== 'paid' && (
                    <Button
                      size="sm"
                      onClick={() => syncPaymentStatus(foundBooking.id, foundBooking.stripe_payment_intent_id)}
                      disabled={loading || !hasValidConfig}
                      className="mt-3"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Sync from Stripe
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Error Display */}
        {notificationError && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center text-red-800">
                <XCircle className="mr-2 h-5 w-5" />
                Notification Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-sm text-red-800 whitespace-pre-wrap">{notificationError}</p>
                </div>
                
                {notificationError.includes('send-notification edge function') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Edge Function Deployment Check:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Go to your <strong>Supabase Dashboard</strong></li>
                      <li>Navigate to <strong>Edge Functions</strong> in the sidebar</li>
                      <li>Look for the <code>send-notification</code> function</li>
                      <li>If it's not there, deploy it from your local project using: <code>supabase functions deploy send-notification</code></li>
                      <li>If it is there, check the logs for any deployment errors</li>
                    </ol>
                  </div>
                )}
                
                <Button 
                  onClick={() => setNotificationError(null)}
                  variant="outline"
                  size="sm"
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Message Testing Section */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <MessagesSquare className="mr-2 h-5 w-5" />
              Email Notification Testing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-blue-700 mb-4">
                Test the email notification system by sending test emails:
              </p>
              
              {/* Test Email Form */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-3">Send Test Email</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Recipient Email (required)"
                    type="email"
                    value={testMessageData.recipientEmail}
                    onChange={(e) => setTestMessageData({...testMessageData, recipientEmail: e.target.value})}
                    placeholder="test@example.com"
                    required
                  />
                  <Input
                    label="Recipient Name (required)"
                    value={testMessageData.recipientName}
                    onChange={(e) => setTestMessageData({...testMessageData, recipientName: e.target.value})}
                    placeholder="John Doe"
                    required
                  />
                  <Input
                    label="Sender Name (required)"
                    value={testMessageData.senderName}
                    onChange={(e) => setTestMessageData({...testMessageData, senderName: e.target.value})}
                    placeholder="Jane Smith"
                    required
                  />
                  <Input
                    label="Property Title (required)"
                    value={testMessageData.propertyTitle}
                    onChange={(e) => setTestMessageData({...testMessageData, propertyTitle: e.target.value})}
                    placeholder="Downtown Retail Space"
                    required
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-maroon-700 mb-2">Message Content (required)</label>
                  <textarea
                    value={testMessageData.messageContent}
                    onChange={(e) => setTestMessageData({...testMessageData, messageContent: e.target.value})}
                    placeholder="This is a test message to check if email notifications are working properly."
                    className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    rows={3}
                    required
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-maroon-700 mb-2">Email Template</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={testMessageData.templateType}
                    onChange={(e) => {
                      const value = e.target.value as TemplateType;
                      setTestMessageData({...testMessageData, templateType: value});
                    }}
                  >
                    <option value="message_received">Message Received</option>
                    <option value="inquiry_response">Inquiry Response</option>
                    <option value="booking_confirmed">Booking Confirmed</option>
                    <option value="payment_received">Payment Received</option>
                    <option value="new_inquiry">New Inquiry</option>
                  </select>
                </div>
                
                <Button
                  onClick={sendTestMessage}
                  isLoading={loading}
                  disabled={!hasValidConfig || !testMessageData.recipientEmail || !testMessageData.recipientName || 
                           !testMessageData.senderName || !testMessageData.propertyTitle || !testMessageData.messageContent}
                  className="mt-4"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
              </div>

              {/* Test Booking Confirmation Email with ICS */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-3">Test Booking Confirmation Email with ICS Attachment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Recipient Email (required)"
                    type="email"
                    value={testBookingData.recipientEmail}
                    onChange={(e) => setTestBookingData({...testBookingData, recipientEmail: e.target.value})}
                    placeholder="test@example.com"
                    required
                  />
                  <Input
                    label="Recipient Name (required)"
                    value={testBookingData.recipientName}
                    onChange={(e) => setTestBookingData({...testBookingData, recipientName: e.target.value})}
                    placeholder="John Doe"
                    required
                  />
                  <Input
                    label="Property Title"
                    value={testBookingData.propertyTitle}
                    onChange={(e) => setTestBookingData({...testBookingData, propertyTitle: e.target.value})}
                    placeholder="Downtown Retail Space"
                  />
                  <Input
                    label="Amount"
                    value={testBookingData.amount}
                    onChange={(e) => setTestBookingData({...testBookingData, amount: e.target.value})}
                    placeholder="100.00"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-maroon-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={testBookingData.startDate}
                      onChange={(e) => setTestBookingData({...testBookingData, startDate: e.target.value})}
                      className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-maroon-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={testBookingData.endDate}
                      onChange={(e) => setTestBookingData({...testBookingData, endDate: e.target.value})}
                      className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={sendTestBookingConfirmation}
                  isLoading={loading}
                  disabled={loading || !hasValidConfig || !testBookingData.recipientEmail || !testBookingData.recipientName}
                  className="mt-4"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Booking Confirmation with ICS
                </Button>
              </div>

              {/* Real Message Testing */}
              {inquiries.length > 0 && (
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-800 mb-3">Send Real Message (Triggers Actual Notifications)</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Send an actual message in existing conversations to test the full notification flow:
                    <span className="block mt-2 text-blue-600 font-medium">
                      Note: This will send a real notification email to the recipient
                    </span>
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {inquiries.slice(0, 5).map((inquiry) => (
                      <div key={inquiry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{inquiry.property.title}</p>
                          <p className="text-xs text-gray-500">
                            {inquiry.user.full_name} ({inquiry.user.email})
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendMessageBetweenUsers(inquiry.id)}
                          disabled={loading}
                        >
                          <MessageSquare className="mr-1 h-3 w-3" />
                          Send Test Message
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center text-green-800">
              <Zap className="mr-2 h-5 w-5" />
              Quick Fix Your Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700 mb-4">
              If your payments are showing as "pending" but were successful in Stripe:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={testWebhook} 
                isLoading={loading} 
                disabled={!hasValidConfig}
                className="bg-green-600 hover:bg-green-700"
              >
                <Settings className="mr-2 h-4 w-4" />
                1. Test Webhook
              </Button>
              <Button variant="outline" onClick={loadBookings}>
                <RefreshCw className="mr-2 h-4 w-4" />
                2. Refresh Bookings
              </Button>
              <span className="text-green-700 flex items-center px-3 py-2 bg-green-100 rounded">
                3. Use "Sync" or "Mark Paid" buttons below
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {webhookTestResult && (
          <Card className={`mb-6 ${webhookTestResult.received ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardHeader>
              <CardTitle className={`flex items-center ${webhookTestResult.received ? 'text-green-800' : 'text-red-800'}`}>
                {webhookTestResult.received ? <CheckCircle className="mr-2 h-5 w-5" /> : <XCircle className="mr-2 h-5 w-5" />}
                Webhook Test Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className={`p-3 rounded ${webhookTestResult.received ? 'bg-green-100' : 'bg-red-100'}`}>
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(webhookTestResult, null, 2)}
                  </pre>
                </div>
                
                {webhookTestResult.environment && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Environment Check:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`p-2 rounded ${webhookTestResult.environment.stripeSecretKey ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Stripe Secret Key: {webhookTestResult.environment.stripeSecretKey ? '✅' : '❌'}
                      </div>
                      <div className={`p-2 rounded ${webhookTestResult.environment.webhookSecret ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Webhook Secret: {webhookTestResult.environment.webhookSecret ? '✅' : '❌'}
                      </div>
                      <div className={`p-2 rounded ${webhookTestResult.environment.supabaseUrl ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Supabase URL: {webhookTestResult.environment.supabaseUrl ? '✅' : '❌'}
                      </div>
                      <div className={`p-2 rounded ${webhookTestResult.environment.supabaseServiceKey ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Service Key: {webhookTestResult.environment.supabaseServiceKey ? '✅' : '❌'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
              Webhook Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Your Webhook URL:</p>
                <div className="flex items-center gap-2">
                  <code className={`px-3 py-2 rounded text-sm flex-1 font-mono ${
                    hasValidConfig ? 'bg-gray-100' : 'bg-red-100 text-red-700'
                  }`}>
                    {webhookUrl}
                  </code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyWebhookUrl}
                    disabled={!hasValidConfig}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Next Steps if Webhook Test Failed:</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to <strong>Supabase Dashboard</strong> → Settings → Environment Variables</li>
                  <li>Verify <code>STRIPE_WEBHOOK_SECRET</code> is set correctly</li>
                  <li>Go to <strong>Stripe Dashboard</strong> → Developers → Webhooks</li>
                  <li>Verify endpoint URL and enabled events (payment_intent.succeeded, payment_intent.payment_failed)</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => window.open('https://dashboard.stripe.com/webhooks', '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Stripe Dashboard
                </Button>
                <Button 
                  onClick={() => {
                    if (hasValidConfig) {
                      const projectId = supabaseUrl.split('//')[1].split('.')[0];
                      window.open(`https://supabase.com/dashboard/project/${projectId}/settings/environment-variables`, '_blank');
                    }
                  }}
                  variant="outline"
                  size="sm"
                  disabled={!hasValidConfig}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Supabase Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Your Bookings</CardTitle>
              <Button variant="outline" size="sm" onClick={loadBookings}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{booking.property?.title}</h3>
                      <p className="text-sm text-gray-600">
                        Booking ID: {booking.id.slice(0, 8)}...
                      </p>
                      <p className="text-sm text-gray-600">
                        Amount: ${booking.price_total}
                      </p>
                      {booking.stripe_payment_intent_id && (
                        <p className="text-sm text-gray-600">
                          Payment Intent: {booking.stripe_payment_intent_id.slice(0, 20)}...
                        </p>
                      )}
                      <div className="flex items-center mt-2">
                        <span className="text-sm font-medium">Status: </span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          booking.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-700'
                            : booking.payment_status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {booking.payment_status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Show sync button for any booking with stripe_payment_intent_id */}
                      {booking.stripe_payment_intent_id && booking.payment_status !== 'paid' && (
                        <Button
                          size="sm"
                          onClick={() => syncPaymentStatus(booking.id, booking.stripe_payment_intent_id)}
                          disabled={loading || !hasValidConfig}
                          className="w-full"
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Sync from Stripe
                        </Button>
                      )}
                      
                      {booking.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => manualMarkPaid(booking.id)}
                          disabled={loading}
                          className="w-full"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}

                      {booking.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/payment/${booking.id}`)}
                          className="w-full text-xs"
                        >
                          Retry Payment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {bookings.length === 0 && (
                <p className="text-gray-500 text-center py-8">No bookings found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        {syncResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Activity Log</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSyncResults([])}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {syncResults.map((result, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <span className="text-gray-400 min-w-[60px]">
                      {result.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="flex-1">
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Tooltip Debugger */}
        <TooltipDebugger />
      </div>
    </div>
  );
};

export default WebhookDebugPage;