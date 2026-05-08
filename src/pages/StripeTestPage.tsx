import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const StripeTestPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const addResult = (test: string, success: boolean, data: any) => {
    setResults(prev => [...prev, {
      test,
      success,
      data,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const testStripeConfig = async () => {
    setLoading(true);
    setResults([]);

    // Test 1: Check environment variables
    const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    addResult('Environment Variables', !!(stripePublicKey && supabaseUrl), {
      stripePublicKey: stripePublicKey ? 'Set' : 'Missing',
      stripeKeyLength: stripePublicKey?.length,
      supabaseUrl: supabaseUrl ? 'Set' : 'Missing'
    });

    if (!user) {
      addResult('User Authentication', false, 'No user logged in');
      setLoading(false);
      return;
    }

    addResult('User Authentication', true, {
      userId: user.id,
      email: user.email
    });

    // Test 2: Check session
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      addResult('Supabase Session', !error && !!session, {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        error: error?.message
      });

      if (!session) {
        setLoading(false);
        return;
      }

      // Test 3: Test payment intent creation
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            bookingId: 'test-booking-id',
            userId: user.id,
            amount: 100, // $1.00 test
            currency: 'USD',
          }),
        });

        const responseData = await response.json();
        
        addResult('Payment Intent Creation', response.ok, {
          status: response.status,
          statusText: response.statusText,
          hasClientSecret: !!responseData.clientSecret,
          clientSecretFormat: responseData.clientSecret ? 
            (responseData.clientSecret.startsWith('pi_') && responseData.clientSecret.includes('_secret_')) : false,
          error: responseData.error || responseData.message,
          responseData
        });

      } catch (err) {
        addResult('Payment Intent Creation', false, {
          error: err instanceof Error ? err.message : 'Unknown error',
          type: 'Network/Fetch Error'
        });
      }

    } catch (err) {
      addResult('Supabase Session', false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <h1 className="text-3xl font-bold text-maroon-800 mb-6">Stripe Configuration Test</h1>
          
          <div className="mb-6">
            <Button 
              onClick={testStripeConfig} 
              isLoading={loading}
              disabled={loading}
              size="lg"
            >
              Run Stripe Tests
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-maroon-800">Test Results</h2>
              
              {results.map((result, index) => (
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
          )}

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h3 className="font-semibold text-blue-800 mb-2">What This Tests:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Environment variables (Stripe public key, Supabase URL)</li>
              <li>• User authentication and session validity</li>
              <li>• Payment intent creation endpoint</li>
              <li>• Client secret format validation</li>
              <li>• Network connectivity to Supabase functions</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StripeTestPage;