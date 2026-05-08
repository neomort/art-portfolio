import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ProposalData {
  id: string;
  inquiry_id: string;
  property_id?: string;
  property?: {
    title: string;
    address: string;
    images?: string[];
  };
  start_date?: string;
  end_date?: string;
  price_total: number;
  currency: string;
  status: string;
  expires_at: string;
  message?: string;
  created_at?: string;
  updated_at?: string;
  request_id?: string | null;
}

const ProposalFinalizePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('No proposal ID provided');
      setLoading(false);
      return;
    }

    fetchProposal();
    if (user) {
      fetchUserProfile();
    }
  }, [id, user]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          inquiry:inquiries(start_date, end_date),
          property:properties(id, title, address_street, address_city, address_state, address_postal_code, address_country, images)
        `)
        .eq('id', id)
        .single();

      if (proposalError) {
        throw proposalError;
      }

      if (!proposalData) {
        throw new Error('Proposal not found');
      }

      // Combine proposal data with inquiry dates and property info
      const combinedProposal = {
        ...proposalData,
        start_date: proposalData.inquiry?.start_date,
        end_date: proposalData.inquiry?.end_date,
        property: proposalData.property?.[0] ? {
          title: proposalData.property[0].title,
          address: `${proposalData.property[0].address_street}, ${proposalData.property[0].address_city}, ${proposalData.property[0].address_state} ${proposalData.property[0].address_postal_code}`,
          images: proposalData.property[0].images
        } : null
      };

      // Check if proposal is expired
      const expiresAt = new Date(combinedProposal.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        setLinkExpired(true);
      }

      setProposal(combinedProposal as ProposalData);
    } catch (err) {
      console.error('Error fetching proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proposal');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('password_set')
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
        return;
      }
      
      setUserProfile(profileData);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const handleResendLink = async () => {
    if (!proposal || !user?.email) return;

    try {
      setResending(true);
      
      // Generate new magic link
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/proposal/${proposal.id}/finalize`
        }
      });

      if (otpError) {
        throw otpError;
      }

      // Send new email notification
      const { sendNotification } = await import('../lib/notifications');
      await sendNotification(
        'payment_request',
        {
          email: user.email!,
          name: user.email?.split('@')[0] || 'Guest'
        },
        {
          propertyTitle: proposal.property?.title || 'Property',
          messageContent: proposal.message || '',
          amount: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: proposal.currency || 'USD'
          }).format(proposal.price_total),
          currency: proposal.currency || 'USD',
          startDate: proposal.start_date || '',
          endDate: proposal.end_date || '',
          dashboardUrl: `${window.location.origin}/messages?inquiry=${id}`,
          bookingDetailsUrl: `${window.location.origin}/messages?inquiry=${id}`,
          magicLinkUrl: `${window.location.origin}/proposal/${proposal.id}/finalize`,
          isNewUser: true,
        }
      );

      setLinkExpired(false);
    } catch (err) {
      console.error('Error resending link:', err);
      setError('Failed to resend link. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleProceedToPayment = () => {
    // Navigate to payment page or open payment modal
    navigate(`/proposal/${id}/payment`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  if (error && !linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-900 mb-2">Link Expired</h2>
            <p className="text-yellow-700 mb-4">
              Your booking link has expired. Request a new link below to continue with your booking.
            </p>
            <button 
              onClick={handleResendLink}
              disabled={resending}
              className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {resending ? 'Sending...' : 'Send New Link'}
            </button>
            <p className="text-sm text-yellow-600 mt-3">
              We'll send a new link to your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Proposal Not Found</h2>
          <p className="text-gray-600 mb-4">The proposal you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#620E28] mb-2">Finalize Your Booking</h1>
          <p className="text-gray-600">Review your booking details and proceed to payment.</p>
        </div>

        {/* Show profile completion banner for temporary users (no auth account) */}
        {user && userProfile?.password_set === false && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Complete Your Profile</h3>
                <p className="text-blue-700 text-sm">
                  Create a password to secure your account and access all features.
                </p>
              </div>
              <button 
                onClick={() => navigate('/set-password')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Set Password
              </button>
            </div>
          </div>
        )}

        {/* Property Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{proposal.property?.title}</h3>
              <p className="text-gray-600 mb-4">{proposal.property?.address}</p>
              
              {proposal.message && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Message from Host</h4>
                  <p className="text-gray-700">{proposal.message}</p>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Booking Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-in:</span>
                  <span className="font-medium">{proposal.start_date ? new Date(proposal.start_date).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-out:</span>
                  <span className="font-medium">{proposal.end_date ? new Date(proposal.end_date).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-bold text-lg">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: proposal.currency || 'USD'
                    }).format(proposal.price_total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleProceedToPayment}
            className="flex-1 bg-[#620E28] text-white px-6 py-3 rounded-lg hover:bg-[#4a0a1f] transition-colors font-semibold"
          >
            Proceed to Payment
          </button>
          <button
            onClick={() => navigate(`/messages?inquiry=${id}`)}
            className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            Ask a Question
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposalFinalizePage;
