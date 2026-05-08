import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatDate, formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

interface PaymentFormProps {
  booking: any;
  onSuccess: () => void;
  onError: (error: Error) => void;
  onStripeError?: (error: string) => void;
  paymentProvider?: 'stripe' | 'authorizenet';
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  booking,
  onSuccess,
  onError,
  onStripeError,
  paymentProvider = 'stripe',
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElementReady, setIsElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);

  // Authorize.net form state
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      if (paymentProvider === 'stripe') {
        if (!stripe || !elements || !isElementReady) {
          return;
        }

        const { error: submitError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/payment/${booking.id}/confirmation`,
          },
        });

        if (submitError) {
          throw submitError;
        }
      } else if (paymentProvider === 'authorizenet') {
        // Validate Authorize.net form fields
        if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
          throw new Error('Please fill in all card details');
        }

        // Call Authorize.net payment function
        const { data, error } = await supabase.functions.invoke('create-authorizenet-payment', {
          body: {
            bookingId: booking.id,
            userId: booking.user_id,
            amount: getPaymentAmount(),
            currency: getCurrency(),
            cardDetails: {
              cardNumber,
              expiryDate,
              cvv,
              cardholderName,
            },
          },
        });

        if (error) {
          throw new Error(error.message || 'Authorize.net payment failed');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Payment processing failed');
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Payment error:', err);
      const error = err instanceof Error ? err : new Error('Payment failed');
      setError(error.message);
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  // Safely get payment amount from booking or proposal
  const getPaymentAmount = () => {
    if (booking?.price_total) {
      return booking.price_total;
    }
    
    if (booking?.proposal?.price_total) {
      return booking.proposal.price_total;
    }
    
    return 0;
  };

  // Safely get currency from booking or proposal
  const getCurrency = () => {
    if (booking?.currency) {
      return booking.currency;
    }
    
    if (booking?.proposal?.currency) {
      return booking.proposal.currency;
    }
    
    return 'USD';
  };


  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-maroon-800 mb-6 font-display">
            Complete Payment
          </h2>

          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-medium text-maroon-800 mb-2">
                Booking Details
              </h3>
              <p className="text-maroon-600">{booking?.property?.title || 'Property'}</p>
              <p className="text-sm text-maroon-500">
                {formatDate(booking?.start_date)} to {formatDate(booking?.end_date)}
              </p>
              {booking?.property?.profiles && (
                <p className="text-xs text-gray-500 mt-2">
                  Property managed by: {booking.property.profiles.full_name || 'Owner'}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-maroon-800">Payment Details</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm text-blue-700">
                  <strong>Secure Payment:</strong> Your payment will be processed securely and transferred directly to the property owner. 
                </p>
              </div>
              
              {/* Payment Form Container */}
              <div className="min-h-[200px] relative">
                {paymentProvider === 'stripe' ? (
                  // Stripe Payment Element
                  !stripe || !elements ? (
                    <div className="flex items-center justify-center h-[200px] border-2 border-dashed border-gray-200 rounded-xl">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-maroon-600 mx-auto mb-4"></div>
                        <p className="text-maroon-600">Loading Stripe...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-gray-200 rounded-xl p-4">
                      <PaymentElement 
                        options={{
                          layout: 'tabs',
                          paymentMethodOrder: ['card'],
                          fields: {
                            billingDetails: 'auto'
                          }
                        }}
                        onReady={() => {
                          setIsElementReady(true);
                          setElementError(null);
                        }}
                        onLoadError={(_error) => {
                          const errorMessage = 'Failed to load payment form. Please refresh and try again.';
                          setElementError(errorMessage);
                          setError(errorMessage);
                          if (onStripeError) {
                            onStripeError(errorMessage);
                          }
                        }}
                        onChange={() => {
                          // Clear any prior inline error as user edits input
                          setElementError(null);
                        }}
                      />
                    </div>
                  )
                ) : (
                  // Authorize.net Payment Form
                  <div className="border-2 border-gray-200 rounded-xl p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-1">
                        Cardholder Name
                      </label>
                      <Input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-1">
                        Card Number
                      </label>
                      <Input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, ''))}
                        placeholder="4111 1111 1111 1111"
                        maxLength={19}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-maroon-700 mb-1">
                          Expiry Date
                        </label>
                        <Input
                          type="text"
                          value={expiryDate}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 4) {
                              const formatted = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
                              setExpiryDate(formatted);
                            }
                          }}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-maroon-700 mb-1">
                          CVV
                        </label>
                        <Input
                          type="text"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                          placeholder="123"
                          maxLength={4}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <p className="text-sm text-gray-600">
                        <strong>Authorize.net Payment:</strong> Your card details are securely processed through Authorize.net.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(error || elementError) && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                {error || elementError}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between text-lg font-semibold text-maroon-800">
                <span>Total Amount</span>
                <span>
                  {formatCurrency(
                    getPaymentAmount(),
                    getCurrency()
                  )}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              isLoading={loading}
              disabled={
                paymentProvider === 'stripe' 
                  ? (!stripe || !elements || loading || !isElementReady || !!elementError)
                  : (!cardNumber || !expiryDate || !cvv || !cardholderName || loading)
              }
            >
              {loading ? 'Processing...' : 
               paymentProvider === 'stripe' 
                 ? (!stripe || !elements ? 'Loading Stripe...' :
                    elementError ? 'Payment Form Error' :
                    !isElementReady ? 'Preparing Payment Form...' :
                    'Pay Now')
                 : 'Pay Now'}
            </Button>

            {/* Status indicators for debugging (DEV-only block removed to fix import.meta issues in tests) */}
          </div>

          <p className="mt-4 text-sm text-center text-gray-500">
            Payments are processed securely through {paymentProvider === 'stripe' ? 'Stripe' : 'Authorize.net'}
          </p>
        </div>
      </form>
    </div>
  );
};

export default PaymentForm;