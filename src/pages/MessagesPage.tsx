import React, { useState, useEffect, useRef } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare, Archive, ArchiveRestore, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import MessageThread from '../components/messaging/MessageThread';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';

// Minimal thread type for this page's needs (avoid 'never' inference from complex selects)
type ThreadLite = {
  id: string;
  user_id: string;
  status?: string;
  initiator_deleted?: boolean;
  responder_deleted?: boolean;
  updated_at?: string;
  property?: { title?: string; organization_id?: string; organization?: { name?: string } };
  user?: { full_name?: string; organization_name?: string };
  messages?: Array<{ count: number }>;
  proposals?: Array<{
    id: string;
    price_total?: number;
    currency?: string;
    status?: string;
    bookings?: Array<{ id: string; payment_status?: string; status?: string }>;
  }>;
  // augmented
  booking_status?: string | null;
  booking_confirmed?: boolean;
  has_booking?: boolean;
};

const INQUIRY_SELECT = `
  *,
  property:properties(
    title,
    venue_id,
    organization_id,
    organization:organizations!properties_organization_id_fkey(
      id,
      name
    )
  ),
  user:profiles!inquiries_user_id_fkey(full_name),
  messages:messages!messages_inquiry_id_fkey(count)
`;

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let index = 0; index < arr.length; index += size) {
    chunks.push(arr.slice(index, index + size));
  }
  return chunks;
};

const MessagesPage: React.FC = () => {
  usePageHeaderTitle('Messages');
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const initialInquiryId = searchParams.get('inquiry');
  const [loading, setLoading] = useState(true);
  const [activeThreads, setActiveThreads] = useState<ThreadLite[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<ThreadLite[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(initialInquiryId);
  const [error, setError] = useState<string | null>(null);
  const [showArchivedView, setShowArchivedView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    loadThreads();
  }, [user]);

  const loadThreads = async () => {
    try {
      // First, determine organizations where the user is a member
      const { data: orgMemberships, error: orgErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id);
      if (orgErr) {
        console.warn('MessagesPage: org memberships fetch error', orgErr);
      }
      const orgIds: string[] = (orgMemberships || []).map((m: any) => m.organization_id);

      // Next, get property IDs where the user is the venue owner OR properties in orgs the user belongs to
      const [personalPropsRes, orgPropsRes] = await Promise.all([
        supabase.from('properties').select('id').eq('venue_id', user!.id),
        orgIds.length > 0
          ? supabase.from('properties').select('id').in('organization_id', orgIds)
          : Promise.resolve({ data: [] as any[], error: null } as any),
      ]);

      const personalProps = personalPropsRes.data || [];
      const orgProps = orgPropsRes.data || [];
      const propIdSet = new Set<string>([...personalProps, ...orgProps].map((p: any) => p.id));
      const propertyIds = Array.from(propIdSet);

      const userThreadsPromise = supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });

      const propertyThreads: ThreadLite[] = [];
      if (propertyIds.length > 0) {
        const propertyChunks = chunkArray(propertyIds, 50);
        const chunkResponses = await Promise.all(
          propertyChunks.map((chunk) =>
            supabase
              .from('inquiries')
              .select(INQUIRY_SELECT)
              .in('property_id', chunk)
              .order('updated_at', { ascending: false })
          )
        );

        for (const response of chunkResponses) {
          if (response.error) {
            throw response.error;
          }
          if (response.data) {
            propertyThreads.push(...(response.data as any));
          }
        }
      }

      const { data: userThreadsData, error: userThreadsError } = await userThreadsPromise;
      if (userThreadsError) throw userThreadsError;

      const combinedThreads: ThreadLite[] = [
        ...((userThreadsData as any[]) || []),
        ...propertyThreads,
      ];

      const dedupedMap = new Map<string, ThreadLite>();
      combinedThreads.forEach((thread) => {
        if (!dedupedMap.has(thread.id)) {
          dedupedMap.set(thread.id, thread);
        }
      });

      const deduped = Array.from(dedupedMap.values()).sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      });

      // Hydrate counterparty display fields (guest name/org) via RPC
      const inquiryIds = deduped.map((t) => t.id);
      let counterpartyByInquiryId: Record<string, { guest_full_name?: string | null; guest_organization_name?: string | null }> = {};
      if (inquiryIds.length > 0) {
        const { data: counterpartyData, error: counterpartyError } = await (supabase as any)
          .rpc('get_inquiry_counterparty_display', { inquiry_ids: inquiryIds });
        if (!counterpartyError && counterpartyData) {
          counterpartyByInquiryId = (counterpartyData as any[]).reduce((acc, row) => {
            acc[row.inquiry_id] = {
              guest_full_name: row.guest_full_name,
              guest_organization_name: row.guest_organization_name,
            };
            return acc;
          }, {} as Record<string, { guest_full_name?: string | null; guest_organization_name?: string | null }>);
        } else {
          console.warn('MessagesPage: counterparty RPC error', counterpartyError);
        }
      }

      const dedupedWithCounterparty = deduped.map((thread) => {
        const counterparty = counterpartyByInquiryId[thread.id];
        if (!counterparty) return thread;
        return {
          ...thread,
          user: {
            ...(thread.user || {}),
            full_name: counterparty.guest_full_name || thread.user?.full_name,
            organization_name: counterparty.guest_organization_name || (thread.user as any)?.organization_name,
          },
        };
      });

      // Separate active and archived threads
      const active: ThreadLite[] = [];
      const archived: ThreadLite[] = [];

      dedupedWithCounterparty.forEach((thread) => {
        // Check if thread is archived for this user
        const isInitiator = thread.user_id === user!.id;
        const isArchived = isInitiator ? thread.initiator_deleted : thread.responder_deleted;
        
        if (isArchived) {
          archived.push(thread);
        } else {
          active.push(thread);
        }
      });

      // Load booking status for each unique thread
      const processThreads = async (threads: ThreadLite[]) => {
        return await Promise.all(
          threads.map(async (thread): Promise<ThreadLite> => {
            // Check if there's a proposal with a booking for this inquiry
            const proposals = thread.proposals ?? [];
            const hasProposal = proposals.length > 0;
            const proposal = hasProposal ? proposals[0] : null;
            const bookings = proposal?.bookings ?? [];
            const hasBooking = bookings.length > 0;
            const booking = hasBooking ? bookings[0] : null;

            return {
              ...thread,
              booking_status: booking?.payment_status || null,
              booking_confirmed: booking?.status === 'confirmed' || false,
              has_booking: !!booking
            };
          })
        );
      };

      const activeThreadsWithBooking = await processThreads(active);
      const archivedThreadsWithBooking = await processThreads(archived);

      setActiveThreads(activeThreadsWithBooking);
      setArchivedThreads(archivedThreadsWithBooking);
    } catch (err) {
      console.error('Error loading threads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load message threads');
    } finally {
      setLoading(false);
    }
  };

  const handleThreadSelect = (threadId: string) => {
    setSelectedThread(threadId);
  };

  const handleBackToList = () => {
    setSelectedThread(null);
  };

  // Add callback to handle inquiry status changes
  const handleInquiryStatusChange = async () => {
    // Reload threads to reflect status changes
    await loadThreads();
  };

  const handleUnarchive = async (threadId: string) => {
    try {
      setLoading(true);
      
      // Get the thread to determine if user is initiator or responder
      const thread = archivedThreads.find((t) => t.id === threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }
      
      const isInitiator = thread.user_id === user!.id;
      const updateField = isInitiator ? 'initiator_deleted' : 'responder_deleted';
      
      // Update the thread's archive status
      const { error } = await (supabase as any)
        .from('inquiries')
        .update({
          [updateField]: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId);
        
      if (error) throw error;
      
      // Reload threads to reflect changes
      await loadThreads();
      
    } catch (err) {
      console.error('Error unarchiving thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to unarchive thread');
    } finally {
      setLoading(false);
    }
  };

  const getStatusMessage = (thread: any) => {
    // Priority 1: Check if payment is completed (inquiry status)
    if (thread.status === 'payment_completed') {
      return 'Payment completed';
    }
    
    // Priority 2: Check if there's a booking with payment status
    const hasProposal = thread.proposals && thread.proposals.length > 0;
    const proposal = hasProposal ? thread.proposals[0] : null;
    const hasBooking = proposal?.bookings && proposal.bookings.length > 0;
    const booking = hasBooking ? proposal.bookings[0] : null;
    const bookingStatus = booking?.payment_status;
    const bookingConfirmed = booking?.status === 'confirmed';

    // Priority 1: Check if there's a confirmed booking with paid status
    if (hasBooking) {
      if (bookingStatus === 'paid' && bookingConfirmed) {
        return 'Payment completed';
      }
      
      if (bookingStatus === 'pending') {
        return 'Payment pending';
      }
      
      if (bookingStatus === 'failed') {
        return 'Payment failed - Please retry';
      }
    }
    
    // Priority 2: Check if payment has been requested
    if (thread.status === 'converted_to_proposal') {
      return 'Payment pending';
    }
    
    // Priority 3: Fall back to inquiry status
    if (thread.status === 'closed') {
      return 'Inquiry closed';
    }
    
    if (thread.status === 'pending') {
      return 'New inquiry';
    }
    
    if (thread.status === 'responded') {
      return 'Inquiry in progress';
    }

    // Default fallback
    return 'Inquiry in progress';
  }

  const getStatusColor = (thread: any) => {
    // Priority 1: Check if payment is completed (inquiry status)
    if (thread.status === 'payment_completed') {
      return 'bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs';
    }
    
    // Priority 2: Check booking status
    // Check if there's a booking with payment status
    const hasProposal = thread.proposals && thread.proposals.length > 0;
    const proposal = hasProposal ? thread.proposals[0] : null;
    const hasBooking = proposal?.bookings && proposal.bookings.length > 0;
    const booking = hasBooking ? proposal.bookings[0] : null;
    const bookingStatus = booking?.payment_status;
    const bookingConfirmed = booking?.status === 'confirmed';

    // Priority 1: Check if there's a confirmed booking with paid status
    if (hasBooking) {
      if (bookingStatus === 'paid' && bookingConfirmed) {
        return 'bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs';
      }
      
      if (bookingStatus === 'pending') {
        return 'bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs';
      }
      
      if (bookingStatus === 'failed') {
        return 'bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs';
      }
    }
    
    // Priority 2: Check if payment has been requested
    if (thread.status === 'converted_to_proposal') {
      return 'bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs';
    }
    
    // Default status colors
    if (thread.status === 'closed') {
      return 'bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs';
    }
    
    if (thread.status === 'pending') {
      return 'bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs';
    }
    
    return 'bg-maroon-100 text-maroon-700 px-2 py-1 rounded-full text-xs';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
          <MessagesSquare className="h-8 w-8 text-maroon-600 mr-3" />
          <h1 className="text-4xl font-bold text-maroon-800 font-display mr-4">
            Messages
          </h1>
          <div className="inline-flex">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-3xl font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none font-display border-2 border-[#FFD2B3] bg-transparent hover:bg-[#fff5eb] active:bg-[#fff0e0] text-gray-800 transition-colors duration-200 h-8 px-4 py-1.5 text-sm flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div 
          ref={containerRef}
          className="flex lg:grid lg:grid-cols-3 lg:gap-8 min-h-screen overflow-hidden p-1"
        >
          {/* Thread List - Full width on mobile, 1/3 width on desktop */}
          <div className={`w-full flex-shrink-0 lg:w-auto lg:flex-shrink space-y-4 ${selectedThread ? 'hidden lg:!block' : 'block'} p-1`}>
            {/* Toggle between active and archived messages */}
            <div className="flex mb-4 bg-gray-100 p-1 rounded-lg">
              <Button
                variant={!showArchivedView ? 'secondary' : 'ghost'}
                className="flex-1 rounded-md"
                onClick={() => setShowArchivedView(false)}
              >
                <MessagesSquare className="h-4 w-4 mr-2" />
                Active
              </Button>
              <Button
                variant={showArchivedView ? 'secondary' : 'ghost'}
                className="flex-1 rounded-md"
                onClick={() => setShowArchivedView(true)}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </Button>
            </div>

            {/* Display either active or archived threads */}
            {showArchivedView ? (
              // Archived threads
              archivedThreads.length > 0 ? (
                archivedThreads.map((thread) => (
                  <Card
                    key={thread.id}
                    className="p-4 cursor-pointer transition-all hover:shadow-lg"
                    onClick={() => handleThreadSelect(thread.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-maroon-800">
                          {thread.property?.title || 'Property'}
                        </h3>
                        <p className="text-xs text-maroon-600">
                          {thread.property?.organization?.name || `Org ID: ${thread.property?.organization_id?.slice(0, 8)}...` || 'Venue'}
                        </p>
                        <p className="text-sm text-maroon-600">
                          {thread.user?.full_name || 'User'}
                        </p>
                      </div>
                      <div className="text-xs text-maroon-500">
                        {formatDate(thread.updated_at)}
                      </div>
                    </div>
                    <span className={`mt-2 inline-block ${getStatusColor(thread)}`}>
                      {getStatusMessage(thread)}
                    </span>
                    
                    {/* Add Booking Canceled label if applicable */}
                    {thread.proposals && thread.proposals.length > 0 && 
                     thread.proposals[0].bookings && 
                     thread.proposals[0].bookings.length > 0 && 
                     thread.proposals[0].bookings[0].status === 'canceled' && (
                      <span className="ml-2 inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                        Booking canceled
                      </span>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                      <div className="text-xs text-maroon-500">
                        {thread.messages && thread.messages.length > 0 ? `${thread.messages[0].count} messages` : 'No messages'}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchive(thread.id);
                        }}
                      >
                        <ArchiveRestore className="h-3 w-3 mr-1" />
                        Unarchive
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-maroon-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-maroon-800 mb-2">
                    No Archived Messages
                  </h3>
                  <p className="text-maroon-600">
                    When you archive messages, they'll appear here.
                  </p>
                </div>
              )
            ) : (
              // Active threads
              activeThreads.length > 0 ? (
                activeThreads.map((thread) => (
                  <Card
                    key={thread.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                      selectedThread === thread.id ? 'ring-2 ring-maroon-500' : ''
                    }`}
                    onClick={() => handleThreadSelect(thread.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-maroon-800">
                          {thread.property?.title || 'Property'}
                        </h3>
                        <p className="text-xs text-maroon-600">
                          {thread.property?.organization?.name || `Org ID: ${thread.property?.organization_id?.slice(0, 8)}...` || 'Venue'}
                        </p>
                        <p className="text-sm text-maroon-600">
                          {thread.user?.full_name || 'User'}
                        </p>
                      </div>
                      <div className="text-xs text-maroon-500">
                        {formatDate(thread.updated_at)}
                      </div>
                    </div>
                    <span className={`mt-2 inline-block ${getStatusColor(thread)}`}>
                      {getStatusMessage(thread)}
                    </span>
                    
                    {/* Add Booking Canceled label if applicable */}
                    {thread.proposals && thread.proposals.length > 0 && 
                     thread.proposals[0].bookings && 
                     thread.proposals[0].bookings.length > 0 && 
                     thread.proposals[0].bookings[0].status === 'canceled' && (
                      <span className="ml-2 inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                        Booking canceled
                      </span>
                    )}
                    {thread.messages && thread.messages.length > 0 && thread.messages[0]?.count > 0 && (
                      <div className="mt-2 text-xs text-maroon-500">
                        {thread.messages[0].count} messages
                      </div>
                    )}
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <MessagesSquare className="h-12 w-12 text-maroon-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-maroon-800 mb-2">
                    No Active Messages
                  </h3>
                  <p className="text-maroon-600">
                    When you inquire about a property or receive inquiries, they'll appear here.
                  </p>
                </div>
              )
            )}
          </div>

          {/* Message Thread - Only show if there are active threads */}
          {activeThreads.length > 0 && (
            <div className={`w-full flex-shrink-0 lg:w-auto lg:flex-shrink lg:col-span-2 overflow-hidden relative ${selectedThread ? 'block' : 'hidden lg:!block'}`}>
              {selectedThread ? (
                <MessageThread
                  inquiryId={selectedThread}
                  onClose={handleBackToList}
                  onInquiryStatusChange={handleInquiryStatusChange}
                />
              ) : (
                <div className="flex items-center justify-center text-center py-16">
                  <div>
                    <MessagesSquare className="h-16 w-16 text-maroon-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-maroon-800 mb-2">
                      Select a Conversation
                    </h3>
                    <p className="text-maroon-600">
                      Choose a conversation from the list to view messages
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;