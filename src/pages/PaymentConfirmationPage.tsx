import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Calendar, MapPin, Clock } from 'lucide-react';
import { formatCityState } from '../lib/formatAddress';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate, formatCurrency } from '../lib/utils';

const PaymentConfirmationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'processing' | 'succeeded' | 'failed'>('processing');
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    // Capture all URL parameters for debugging
    const urlParams = Object.fromEntries(searchParams.entries());
    setDebugInfo(urlParams);

    // Check various Stripe redirect parameters
    const paymentIntent = searchParams.get('payment_intent');
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
    const redirectStatus = searchParams.get('redirect_status');
    const setupIntent = searchParams.get('setup_intent');
    const setupIntentClientSecret = searchParams.get('setup_intent_client_secret');

    console.log('Payment confirmation URL params:', {
      paymentIntent,
      paymentIntentClientSecret,
      redirectStatus,
      setupIntent,
      setupIntentClientSecret,
      allParams: urlParams
    });

    // Determine payment status from URL parameters
    if (redirectStatus === 'succeeded') {
      setPaymentStatus('succeeded');
    } else if (redirectStatus === 'failed') {
      setPaymentStatus('failed');
    } else if (paymentIntent) {
      // If we have a payment intent but no redirect status, check the booking status
      setPaymentStatus('processing');
    }

    loadBookingData();
  }, [id, user, searchParams]);

  const loadBookingData = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          property:properties(title, address_city, address_state, images),
          user:profiles!user_id(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data.user_id !== user?.id) {
        throw new Error('Unauthorized');
      }

      setBooking(data);

      // If payment status is still processing, check the actual booking status
      if (paymentStatus === 'processing') {
        if (data.payment_status === 'paid') {
          setPaymentStatus('succeeded');
        } else if (data.payment_status === 'failed') {
          setPaymentStatus('failed');
        }
      }

      // Also update payment status if we find it was successful
      if (data.payment_status === 'paid' && paymentStatus !== 'succeeded') {
        setPaymentStatus('succeeded');
      }
    } catch (err) {
      console.error('Error loading booking:', err);
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh the booking status for a few seconds to catch webhook updates
  useEffect(() => {
    if (paymentStatus === 'processing' && booking) {
      const interval = setInterval(async () => {
        try {
          const { data } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', id)
            .single();
          
          if (data?.payment_status === 'paid') {
            setPaymentStatus('succeeded');
            clearInterval(interval);
          } else if (data?.payment_status === 'failed') {
            setPaymentStatus('failed');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
        }
      }, 2000);

      // Stop checking after 30 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [paymentStatus, booking, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600 mx-auto mb-4"></div>
          <p className="text-maroon-600">Loading confirmation...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
        <div className="max-w-lg mx-auto">
          <Card className="p-6 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-maroon-800 mb-4">Error</h2>
            <p className="text-maroon-600 mb-6">{error || 'Booking not found'}</p>
            <Button onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusContent = () => {
    switch (paymentStatus) {
      case 'succeeded':
        return {
          icon: <CheckCircle className="h-16 w-16 text-green-500" />,
          title: 'Payment Successful!',
          description: 'Your booking has been confirmed and payment processed successfully.',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'failed':
        return {
          icon: <XCircle className="h-16 w-16 text-red-500" />,
          title: 'Payment Failed',
          description: 'There was an issue processing your payment. Please try again.',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: <Clock className="h-16 w-16 text-amber-500" />,
          title: 'Processing Payment...',
          description: 'Please wait while we confirm your payment. This may take a few moments.',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200'
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Debug Info (only show if processing or failed) */}
        {(paymentStatus === 'processing' || paymentStatus === 'failed') && Object.keys(debugInfo).length > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Debug Information</h3>
            <div className="text-xs text-blue-600 space-y-1">
              <p>Booking Status: {booking.payment_status}</p>
              <p>Payment Intent: {debugInfo.payment_intent || 'None'}</p>
              <p>Redirect Status: {debugInfo.redirect_status || 'None'}</p>
              {Object.keys(debugInfo).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer">All URL Parameters</summary>
                  <pre className="mt-1 text-xs bg-blue-100 p-2 rounded">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </Card>
        )}

        {/* Main content grid: Status + Booking Details */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Card */}
          <Card className={`p-8 text-center ${statusContent.bgColor} ${statusContent.borderColor}`}>
            <div className="flex justify-center mb-6">
              {statusContent.icon}
            </div>
            <h1 className={`text-3xl font-bold mb-4 ${statusContent.color} font-display`}>
              {statusContent.title}
            </h1>
            <p className={`text-lg ${statusContent.color} mb-6`}>
              {statusContent.description}
            </p>
            
            {paymentStatus === 'succeeded' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 border border-green-200">
                  <p className="text-green-700 font-medium">
                    Booking Confirmation: #{booking.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    You will receive a confirmation email shortly
                  </p>
                </div>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <p className="text-amber-700 font-medium">
                  Checking payment status...
                </p>
                <p className="text-amber-600 text-sm mt-1">
                  This page will automatically update when your payment is confirmed
                </p>
              </div>
            )}
          </Card>

          {/* Booking Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-maroon-800">Booking Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="w-24 h-24 flex-shrink-0">
                  <img
                    src={booking.property.images[0]}
                    alt={booking.property.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-maroon-800 mb-2">
                    {booking.property.title}
                  </h3>
                  <div className="flex items-center text-maroon-600 mb-2">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{formatCityState(booking.property)}</span>
                  </div>
                  <div className="flex items-center text-maroon-600 mb-4">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>
                      {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-maroon-800">
                    {formatCurrency(booking.price_total, booking.currency)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {paymentStatus === 'succeeded' && (
            <>
              <Button
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center w-full sm:w-auto"
              >
                View My Bookings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/properties')}
                className="flex items-center justify-center w-full sm:w-auto"
              >
                Browse More Properties
              </Button>
            </>
          )}
          
          {paymentStatus === 'failed' && (
            <>
              <Button
                onClick={() => navigate(`/payment/${booking.id}`)}
                className="flex items-center justify-center w-full sm:w-auto"
              >
                Try Payment Again
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center w-full sm:w-auto"
              >
                Return to Dashboard
              </Button>
            </>
          )}
          
          {paymentStatus === 'processing' && (
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex items-center justify-center w-full sm:w-auto"
            >
              Refresh Status
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationPage;