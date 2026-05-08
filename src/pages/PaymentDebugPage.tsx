import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Settings, CreditCard, TestTube, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { buildBookingInsert } from '../lib/booking';

const PaymentDebugPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [environmentCheck, setEnvironmentCheck] = useState<any>(null);

  // Validate environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  const hasValidConfig = supabaseUrl && stripePublicKey && 
    supabaseUrl !== 'undefined' && stripePublicKey !== 'undefined' &&
    supabaseUrl.startsWith('http') && stripePublicKey.startsWith('pk_');

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadBookings();
    runEnvironmentCheck();
  }, [user]);

  const addTestResult = (test: string, success: boolean, data: any) => {
    setTestResults(prev => [...prev, {
      test,
      success,
      data,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const runEnvironmentCheck = () => {
    const envCheck = {
      supabaseUrl: {
        value: supabaseUrl,
        valid: !!(supabaseUrl && supabaseUrl.startsWith('http')),
        message: supabaseUrl ? 'Set' : 'Missing'
      },
      stripePublicKey: {
        value: stripePublicKey ? `${stripePublicKey.substring(0, 20)}...` : 'Missing',
        valid: !!(stripePublicKey && stripePublicKey.startsWith('pk_')),
        message: stripePublicKey ? 'Set' : 'Missing'
      },
      overallValid: hasValidConfig
    };
    setEnvironmentCheck(envCheck);
  };

  const loadBookings = async () => {
    try {
      const sb: any = supabase;
      const { data, error } = await sb
        .from('bookings')
        .select(`
          *,
          property:properties(
            title,
            venue_id,
            profiles:profiles!properties_venue_id_fkey(
              primary_organization_id,
              full_name
            )
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const bookingsAny: any[] = (data || []) as any[];

      // Collect owner org IDs
      const orgIds = Array.from(new Set(
        bookingsAny
          .map(b => (b?.property?.profiles as any)?.primary_organization_id)
          .filter(Boolean)
      ));

      let orgMap: Record<string, any> = {};
      if (orgIds.length > 0) {
        const { data: orgs, error: orgErr } = await sb
          .from('organizations')
          .select('id, name, stripe_account_id, charges_enabled, payouts_enabled')
          .in('id', orgIds);
        if (!orgErr && orgs) {
          orgMap = Object.fromEntries(orgs.map((o: any) => [o.id, o]));
        }
      }

      // Attach ownerOrg to each booking for UI/testing
      const augmented = bookingsAny.map(b => {
        const owner = (b?.property?.profiles as any) || {};
        const org = owner?.primary_organization_id ? orgMap[owner.primary_organization_id] : null;
        return { ...b, ownerOrg: org || null };
      });

      setBookings(augmented);
    } catch (err) {
      console.error('Error loading bookings:', err);
      const message = err instanceof Error ? err.message : 'Failed to load bookings';
      addTestResult('Load Bookings', false, { error: message });
    }
  };

  const testStripeConfiguration = async () => {
    setLoading(true);
    addTestResult('Environment Check', hasValidConfig, environmentCheck);

    if (!hasValidConfig) {
      setLoading(false);
      return;
    }

    try {
      // Test 1: Check if we can get a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      addTestResult('Session Check', !sessionError && !!session, {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        error: sessionError?.message
      });

      if (!session) {
        setLoading(false);
        return;
      }

      // Test 2: Test payment intent creation with a test booking
      const testBooking = bookings.find(b => b.payment_status === 'pending');
      if (testBooking) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              bookingId: testBooking.id,
              userId: user!.id,
              amount: testBooking.price_total,
              currency: testBooking.currency,
            }),
          });

          const responseData = await response.json();
          
          addTestResult('Payment Intent Creation', response.ok, {
            status: response.status,
            statusText: response.statusText,
            hasClientSecret: !!responseData.clientSecret,
            clientSecretFormat: responseData.clientSecret ? 
              (responseData.clientSecret.startsWith('pi_') && responseData.clientSecret.includes('_secret_')) : false,
            error: responseData.error || responseData.message,
            bookingId: testBooking.id,
            ownerOrganizationStripeSetup: {
              hasStripeAccount: !!testBooking.ownerOrg?.stripe_account_id,
              chargesEnabled: !!testBooking.ownerOrg?.charges_enabled,
              payoutsEnabled: !!testBooking.ownerOrg?.payouts_enabled,
              organizationId: testBooking.ownerOrg?.id || null
            }
          });

        } catch (err) {
          addTestResult('Payment Intent Creation', false, {
            error: err instanceof Error ? err.message : 'Unknown error',
            type: 'Network/Fetch Error'
          });
        }
      } else {
        addTestResult('Payment Intent Creation', false, {
          error: 'No pending bookings found to test with',
          availableBookings: bookings.length
        });
      }

    } catch (err) {
      addTestResult('Stripe Configuration Test', false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const reconcileBooking = async (bookingId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const { data, error } = await (supabase as any).functions.invoke('reconcile-booking-payment', {
        body: { booking_id: bookingId },
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      addTestResult('Reconcile Booking', !error, {
        bookingId,
        ...(data ? { data } : {}),
        ...(error ? { error } : {}),
      });

      await loadBookings();
    } catch (err) {
      addTestResult('Reconcile Booking', false, {
        bookingId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const testPaymentFlow = async (bookingId: string) => {
    setLoading(true);
    try {
      // Navigate to payment page and see what happens
      const paymentUrl = `/payment/${bookingId}`;
      addTestResult('Payment Flow Test', true, {
        action: 'Navigating to payment page',
        url: paymentUrl,
        bookingId
      });
      
      // Open in new tab for testing
      window.open(paymentUrl, '_blank');
      
    } catch (err) {
      addTestResult('Payment Flow Test', false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const createTestBooking = async () => {
    setLoading(true);
    try {
      // Find a property to create a test booking with
      const sb: any = supabase;
      const { data: properties, error: propertiesError } = await sb
        .from('properties')
        .select('id, title, price_per_day, price_per_hour')
        .limit(1);

      if (propertiesError || !properties?.length) {
        throw new Error('No properties found to create test booking');
      }

      const property: any = (properties as any[])[0];
      // If the property supports hourly, create a 2-hour hourly booking next week at 10:00.
      // Otherwise, create a 2-day daily booking as before.
      const supportsHourly = property.price_per_hour && Number(property.price_per_hour) > 0;
      let bookingInsert: any;
      if (supportsHourly) {
        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 7);
        startAt.setHours(10, 0, 0, 0);
        const endAt = new Date(startAt);
        endAt.setHours(endAt.getHours() + 2);
        bookingInsert = buildBookingInsert({
          mode: 'hourly',
          propertyId: property.id,
          userId: user!.id,
          priceTotal: Number(property.price_per_hour) * 2,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
      } else {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 2);
        bookingInsert = buildBookingInsert({
          mode: 'daily',
          propertyId: property.id,
          userId: user!.id,
          priceTotal: property.price_per_day ? Number(property.price_per_day) * 2 : 100,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });
      }

      const { data: booking, error: bookingError } = await sb
        .from('bookings')
        .insert(bookingInsert)
        .select()
        .single();

      if (bookingError) throw bookingError;

      addTestResult('Create Test Booking', true, {
        bookingId: (booking as any).id,
        propertyTitle: property.title,
        amount: (booking as any).price_total
      });

      await loadBookings();

    } catch (err) {
      addTestResult('Create Test Booking', false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPropertyOwnerSetup = async (propertyId: string) => {
    try {
      const sb: any = supabase;
      const { data: property, error } = await sb
        .from('properties')
        .select(`
          id,
          title,
          venue_id,
          profiles:profiles!properties_venue_id_fkey(
            primary_organization_id,
            full_name
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      // Normalize owner profiles and fetch org
      const ownerRaw = (property as any).profiles;
      const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
      const ownerOrgId = owner?.primary_organization_id;
      let ownerOrg: any = null;
      if (ownerOrgId) {
        const { data: org, error: orgErr } = await sb
          .from('organizations')
          .select('id, name, stripe_account_id, charges_enabled, payouts_enabled')
          .eq('id', ownerOrgId)
          .maybeSingle();
        if (!orgErr) ownerOrg = org;
      }
      const isSetupComplete = !!(ownerOrg?.stripe_account_id && ownerOrg?.charges_enabled);

      addTestResult('Property Owner Setup Check', isSetupComplete, {
        propertyTitle: property.title,
        ownerName: owner?.full_name,
        organizationId: ownerOrg?.id || null,
        hasStripeAccount: !!ownerOrg?.stripe_account_id,
        chargesEnabled: ownerOrg?.charges_enabled,
        payoutsEnabled: ownerOrg?.payouts_enabled,
        setupComplete: isSetupComplete
      });

    } catch (err) {
      addTestResult('Property Owner Setup Check', false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const goToPaymentPage = async (bookingId: string) => {
    setLoading(true);
    try {
      // First, create a payment intent to get the client secret
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('No active session found');
      }

      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          userId: user!.id,
          amount: booking.price_total,
          currency: booking.currency,
        }),
      });

      const responseData = await response.json();
      if (response.ok && responseData.clientSecret) {
        navigate(`/payment/${bookingId}?client_secret=${responseData.clientSecret}`);
      } else {
        throw new Error(responseData.error || 'Failed to create payment intent');
      }
    } catch (err) {
      addTestResult('Go to Payment Page', false, {
        error: err instanceof Error ? err.message : 'Unknown error',
        bookingId
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-maroon-800 mb-2">
            Payment System Debug & Testing
          </h1>
          <p className="text-maroon-600">
            Comprehensive testing tools to diagnose payment flow issues
          </p>
        </div>

        {/* Environment Status */}
        <Card className={`mb-6 ${hasValidConfig ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center ${hasValidConfig ? 'text-green-800' : 'text-red-800'}`}>
              {hasValidConfig ? <CheckCircle className="mr-2 h-5 w-5" /> : <XCircle className="mr-2 h-5 w-5" />}
              Environment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {environmentCheck && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded ${environmentCheck.supabaseUrl.valid ? 'bg-green-100' : 'bg-red-100'}`}>
                    <p className="font-medium">Supabase URL</p>
                    <p className="text-sm">{environmentCheck.supabaseUrl.message}</p>
                  </div>
                  <div className={`p-3 rounded ${environmentCheck.stripePublicKey.valid ? 'bg-green-100' : 'bg-red-100'}`}>
                    <p className="font-medium">Stripe Public Key</p>
                    <p className="text-sm">{environmentCheck.stripePublicKey.message}</p>
                  </div>
                </div>
                {!hasValidConfig && (
                  <div className="bg-red-100 p-3 rounded">
                    <p className="text-red-800 font-medium">Configuration Issues Detected</p>
                    <p className="text-red-700 text-sm">Please check your environment variables in .env file</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-maroon-800">
              <TestTube className="mr-2 h-5 w-5" />
              Quick Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={testStripeConfiguration} 
                isLoading={loading} 
                disabled={!hasValidConfig || loading}
              >
                <Settings className="mr-2 h-4 w-4" />
                Test Stripe Config
              </Button>
              <Button 
                onClick={createTestBooking} 
                isLoading={loading}
                disabled={loading}
                variant="outline"
              >
                <Play className="mr-2 h-4 w-4" />
                Create Test Booking
              </Button>
              <Button variant="outline" onClick={loadBookings}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Bookings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List with Testing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Bookings & Payment Tests</CardTitle>
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
                        Amount: ${booking.price_total} {booking.currency}
                      </p>
                      <div className="flex items-center mt-2">
                        <span className="text-sm font-medium">Payment Status: </span>
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
                      
                      {/* Property Owner Organization Status */}
                      <div className="mt-2 text-xs">
                        <p className="font-medium">Owner Organization Setup:</p>
                        <div className="flex space-x-4">
                          <span className={booking.ownerOrg?.stripe_account_id ? 'text-green-600' : 'text-red-600'}>
                            Stripe: {booking.ownerOrg?.stripe_account_id ? '✅' : '❌'}
                          </span>
                          <span className={booking.ownerOrg?.charges_enabled ? 'text-green-600' : 'text-red-600'}>
                            Charges: {booking.ownerOrg?.charges_enabled ? '✅' : '❌'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        onClick={() => testPaymentFlow(booking.id)}
                        disabled={loading}
                        className="w-full"
                      >
                        <CreditCard className="mr-1 h-3 w-3" />
                        Test Payment Flow
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkPropertyOwnerSetup(booking.property_id)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Settings className="mr-1 h-3 w-3" />
                        Check Owner Setup
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reconcileBooking(booking.id)}
                        disabled={loading}
                        className="w-full"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Verify/Sync Payment
                      </Button>

                      {booking.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => goToPaymentPage(booking.id)}
                          className="w-full text-xs"
                        >
                          Go to Payment Page
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {bookings.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No bookings found</p>
                  <Button onClick={createTestBooking} isLoading={loading}>
                    Create Test Booking
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Test Results</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setTestResults([])}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl border-2 ${
                      result.success 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${
                        result.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.success ? '✅' : '❌'} {result.test}
                      </h3>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Details
                      </summary>
                      <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Common Issues & Solutions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium text-blue-800">Environment Variables Missing</p>
                <p className="text-blue-700">Check your .env file contains VITE_STRIPE_PUBLIC_KEY and VITE_SUPABASE_URL</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-medium text-yellow-800">Property Owner Not Set Up</p>
                <p className="text-yellow-700">Property owners must complete Stripe Connect onboarding to receive payments</p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="font-medium text-purple-800">Payment Intent Creation Fails</p>
                <p className="text-purple-700">Check Supabase edge function logs and ensure Stripe secret key is configured</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentDebugPage;