import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/payment/PaymentForm';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Stripe payment configuration - updated with correct account
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'authorizenet'>('stripe');
  const initialSetupDone = useRef(false);
  const [creatingPaymentIntent, setCreatingPaymentIntent] = useState(false);

  // Validate client secret format
  const validateClientSecret = useCallback((secret: string): boolean => {
    // Stripe client secrets should start with "pi_" and contain "_secret_"
    return secret.startsWith('pi_') && secret.includes('_secret_');
  }, []);

  // Handle Stripe errors
  const handleStripeError = useCallback((error: string) => {
    setStripeError(error);
  }, []);

  // Single useEffect for initial setup - runs only once
  useEffect(() => {
    if (initialSetupDone.current) return;
    
    const performInitialSetup = async () => {
      // Set the flag immediately to prevent re-runs
      initialSetupDone.current = true;

      if (!user) {
        navigate('/signin');
        return;
      }

      if (!id) {
        setError('Missing booking identifier');
        setLoading(false);
        return;
      }

      // Load booking data first (we always create fresh payment intents now)
      try {
        const sb: any = supabase;
        const { data, error: bookingError } = await sb
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
            ),
            proposal:proposals(price_total, currency)
          `)
          .eq('id', id as string)
          .single();

        if (bookingError) throw bookingError;
        const dataAny: any = data as any;
        if (dataAny.user_id !== user?.id) {
          throw new Error('Unauthorized');
        }

        // Check if property owner's organization has Stripe Connect set up
        const propertyOwner = dataAny.property.profiles as any;
        const ownerOrgId = propertyOwner?.primary_organization_id;
        if (!ownerOrgId) {
          setError('The property owner is missing a primary organization. Please contact support.');
          setLoading(false);
          return;
        }

        const { data: ownerOrg, error: ownerOrgError } = await sb
          .from('organizations')
          .select('id, payment_provider, stripe_account_id, charges_enabled, payouts_enabled, authorizenet_api_login_id, authorizenet_transaction_key, authorizenet_sandbox_mode')
          .eq('id', ownerOrgId)
          .single();

        if (ownerOrgError) {
          setError('Unable to verify the property owner\'s payment configuration. Please try again later.');
          setLoading(false);
          return;
        }

        // Set payment provider based on organization configuration
        const provider = (ownerOrg.payment_provider as 'stripe' | 'authorizenet') || 'stripe';
        setPaymentProvider(provider);

        // Validate payment provider configuration
        if (provider === 'stripe') {
          if (!ownerOrg?.stripe_account_id) {
            setError('The property owner has not set up Stripe payment processing. Please contact them directly.');
            setLoading(false);
            return;
          }

          if (!ownerOrg.charges_enabled) {
            setError('The property owner\'s Stripe account is not fully activated. Please contact them to complete their setup.');
            setLoading(false);
            return;
          }
        } else if (provider === 'authorizenet') {
          if (!ownerOrg?.authorizenet_api_login_id || !ownerOrg?.authorizenet_transaction_key) {
            setError('The property owner has incomplete Authorize.net configuration. Please contact them directly.');
            setLoading(false);
            return;
          }
        }

        setBooking(dataAny);
        
        // Only create payment intent for Stripe. Authorize.net doesn't need client secret
        if (provider === 'stripe') {
          console.log('Creating new payment intent to avoid expired payment intent issues');
          await createNewPaymentIntent(data);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading booking:', err);
        setError(err instanceof Error ? err.message : 'Failed to load booking');
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    performInitialSetup();
  }, [id, user, navigate, validateClientSecret]); // Include dependencies

  // Function to create a new payment intent
  const createNewPaymentIntent = async (bookingData: any) => {
    try {
      setCreatingPaymentIntent(true);
      setError(null);
      
      // Check if user session is still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
        navigate(`/signin?returnTo=${returnUrl}`, {
          state: { message: 'Your session has expired. Please sign in again to continue.' }
        });
        return;
      }
      
      console.log('Creating payment intent for booking:', bookingData.id);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: bookingData.id,
          userId: user!.id,
          amount: bookingData.price_total,
          currency: bookingData.currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const { clientSecret: newClientSecret } = await response.json();
      
      if (validateClientSecret(newClientSecret)) {
        setClientSecret(newClientSecret);
        
        // Update URL with new client secret and timestamp to prevent caching
        const timestamp = Date.now();
        const newUrl = window.location.pathname + '?client_secret=' + newClientSecret + '&t=' + timestamp;
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        // Debug: Log the payment intent ID to verify it's fresh
        const paymentIntentId = newClientSecret.split('_secret_')[0];
        console.log('PaymentPage: Using fresh payment intent:', paymentIntentId);
      } else {
        throw new Error('Received invalid client secret format from server');
      }
    } catch (err) {
      console.error('Error creating payment intent:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment intent');
    } finally {
      setCreatingPaymentIntent(false);
    }
  };

  const retryPayment = async () => {
    try {
      setLoading(true);
      setError(null);
      setStripeError(null);
      
      // Check if user session is still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
        navigate(`/signin?returnTo=${returnUrl}`, {
          state: { message: 'Your session has expired. Please sign in again to continue.' }
        });
        return;
      }
      
      // Refresh the session to get a fresh token
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedSession) {
        const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
        navigate(`/signin?returnTo=${returnUrl}`, {
          state: { message: 'Your session has expired. Please sign in again to continue.' }
        });
        return;
      }
      
      // Get current session to ensure consistent user ID
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user) throw new Error('No authenticated user found');
      
      // Create a new payment intent
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshedSession.access_token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          userId: currentSession.user.id,
          amount: booking.price_total,
          currency: booking.currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 
          errorData.message || 
          'Failed to create payment intent. Please try again later.'
        );
      }

      const { clientSecret: newClientSecret } = await response.json();
      
      if (validateClientSecret(newClientSecret)) {
        setClientSecret(newClientSecret);
        
        // Update URL with new client secret and timestamp to prevent caching
        const timestamp = Date.now();
        const newUrl = window.location.pathname + '?client_secret=' + newClientSecret + '&t=' + timestamp;
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        // Debug: Log the payment intent ID to verify it's fresh
        const paymentIntentId = newClientSecret.split('_secret_')[0];
        console.log('PaymentPage: Using fresh payment intent (retry):', paymentIntentId);
        
        setError(null); // Clear any previous errors
      } else {
        throw new Error('Received invalid client secret format from server');
      }
      
    } catch (err) {
      console.error('Error retrying payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry payment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600 mx-auto mb-4"></div>
          <p className="text-maroon-600">Loading payment page...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
        <div className="max-w-lg mx-auto space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-maroon-800 mb-4">Payment Error</h2>
            <p className="text-maroon-600 mb-6">{error || 'Booking not found'}</p>
            
            {error && error.includes("Missing payment information") && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl mb-6">
                <p className="font-medium">We need to create a new payment session.</p>
                <p className="text-sm mt-1">Click the button below to initialize the payment process.</p>
              </div>
            )}
            
            {booking ? (
              <Button onClick={retryPayment} isLoading={loading}>
                Retry Payment
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => navigate('/dashboard')}
              >
                Return to Dashboard
              </Button>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
        <div className="max-w-lg mx-auto space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-maroon-800 mb-4">Payment Setup</h2>
            
            {creatingPaymentIntent ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600 mx-auto mb-4"></div>
                <p className="text-maroon-600">Creating payment session...</p>
              </div>
            ) : (
              <>
                <p className="text-maroon-600 mb-6">
                  We need to create a new payment session for your booking.
                </p>
                
                <Button 
                  onClick={() => createNewPaymentIntent(booking)} 
                  isLoading={creatingPaymentIntent}
                  className="w-full"
                >
                  Initialize Payment
                </Button>
              </>
            )}
            
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                className="mt-4"
              >
                Return to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Error display for Stripe issues */}
        {stripeError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-red-800 mb-2">Payment Form Error</h3>
            <p className="text-red-700 text-sm">{stripeError}</p>
            <Button 
              onClick={retryPayment} 
              className="mt-3" 
              size="sm"
              isLoading={loading}
            >
              Retry Payment Setup
            </Button>
          </div>
        )}

        {paymentProvider === 'stripe' ? (
          <Elements 
            stripe={stripePromise} 
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#c13434',
                  borderRadius: '12px',
                  colorBackground: '#ffffff',
                  colorText: '#1a1a1a',
                  colorDanger: '#df1b41',
                  fontFamily: 'Space Grotesk, system-ui, sans-serif',
                },
              },
              loader: 'auto',
            }}
            key={clientSecret} // Force re-render when clientSecret changes
          >
            <PaymentForm
              booking={booking}
              paymentProvider={paymentProvider}
              onSuccess={() => {
                // Redirect to success page or booking confirmation
                navigate(`/payment/${booking.id}/confirmation`);
              }}
              onError={(error) => {
                setError(error.message);
                handleStripeError(error.message);
              }}
              onStripeError={handleStripeError}
            />
          </Elements>
        ) : (
          <PaymentForm
            booking={booking}
            paymentProvider={paymentProvider}
            onSuccess={() => {
              // Redirect to success page or booking confirmation
              navigate(`/payment/${booking.id}/confirmation`);
            }}
            onError={(error) => {
              setError(error.message);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PaymentPage;