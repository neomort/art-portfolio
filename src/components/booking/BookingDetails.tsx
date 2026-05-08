import React, { useState, useEffect, useRef } from 'react';
import { User, Building2, MapPin, Phone, Mail, AlertCircle, XCircle, Calendar, CalendarPlus, ChevronDown, MessageSquare, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { formatCurrency, formatDate } from '../../lib/utils';
import { cancelBooking } from '../../lib/api/booking';
import { useNavigate } from 'react-router-dom';
import { generateCalendarEvent } from '../../lib/calendar';
import { Dialog } from '../ui/dialog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface BookingDetailsProps {
  booking: any;
  onClose: () => void;
  onBookingUpdated?: () => void;
}

const BookingDetails: React.FC<BookingDetailsProps> = ({ booking, onClose, onBookingUpdated }) => {
  console.log('BookingDetails payload:', booking);
  // 

  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Payout breakdown state (venue owner only)
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const payoutAttemptByBookingIdRef = useRef<Record<string, boolean>>({});
  const [payout, setPayout] = useState<{
    amount?: number;
    commissionAmount?: number;
    originalCommissionAmount?: number;
    serviceCreditApplied?: number;
    stripeProcessingFee?: number;
    payoutAmount?: number;
    currency?: string;
    available?: boolean;
    platformFeePercent?: number | null;
    feeRule?: string | null;
    stripeFeePending?: boolean;
  } | null>(null);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

  const computedCommissionPercent: number | null = (() => {
    if (!payout) return null;
    if (payout.platformFeePercent != null) return payout.platformFeePercent;
    if (payout.amount && payout.amount > 0 && payout.commissionAmount != null) {
      const pct = (payout.commissionAmount / payout.amount) * 100;
      return isFinite(pct) ? pct : null;
    }
    return null;
  })();

  // Extract property details from either nested structure or direct access
  const property = booking.proposals?.inquiries?.properties || 
                   (booking as any).property || 
                   null;
  
  // Extract inquiry details from either nested structure or direct access  
  const inquiry = booking.proposals?.inquiries || 
                   (booking as any).inquiry || 
                   null;

  // Extract price with fallbacks (Calendar uses top-level, Dashboard may use nested)
  const price = booking.price_total ?? booking.proposals?.price_total ?? 0;

  // Extract Stripe payment intent ID with fallbacks
  const stripePaymentIntentId = booking.stripe_payment_intent_id ?? booking.proposals?.stripe_payment_intent_id ?? null;
  
  // Extract customer details from the enriched booking payload or fetch via RPC if missing
  const [customerFallback, setCustomerFallback] = useState<any | null>(null);
  const customer = booking?.proposals?.inquiries?.profiles ? {
    id: booking.proposals.inquiries.profiles.id,
    full_name: booking.proposals.inquiries.profiles.full_name,
    email: booking.proposals.inquiries.profiles.email,
    phone: booking.proposals.inquiries.profiles.phone
  } : (booking as any)?.customer || customerFallback || null;

  // Fallback fetch if nested data missing: use RPC to get guest name, email, and phone
  useEffect(() => {
    const fetchCustomer = async () => {
      if (customerFallback) return;
      const inquiryId = booking?.proposals?.inquiry_id || (booking as any)?.inquiry?.id;
      if (!inquiryId) return;
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any)
          .rpc('get_inquiry_counterparty_display', { inquiry_ids: [inquiryId] });
        const rpcRow = rpcData?.[0];
        if (!rpcError && rpcRow?.guest_full_name) {
          setCustomerFallback({
            id: booking.user_id,
            full_name: rpcRow.guest_full_name,
            email: rpcRow.guest_email || null,
            phone: rpcRow.guest_phone || null,
            primary_organization_id: rpcRow.guest_organization_name || null,
          });
        }
      } catch (e) {
        console.warn('Could not fetch customer profile via RPC:', e);
      }
    };
    fetchCustomer();
  }, [booking?.proposals?.inquiry_id, (booking as any)?.inquiry?.id, booking?.user_id, customerFallback]);
  
  // Extract inquiry details if available
  const inquiryContent = inquiry?.message || '';
  
  // Parse inquiry message content for specific sections
  const parseInquiryContent = (content: string) => {
    const sections: Record<string, string> = {};
    
    // Try to extract sections using regex
    const spaceRequirementsMatch = content.match(/Space Requirements:[\s\n]+(.*?)(?=\n\n|$)/s);
    const brandInfoMatch = content.match(/About the Brand:[\s\n]+(.*?)(?=\n\n|$)/s);
    const commentsMatch = content.match(/Comments:[\s\n]+(.*?)(?=\n\n|$)/s);
    
    if (spaceRequirementsMatch) sections.spaceRequirements = spaceRequirementsMatch[1].trim();
    if (brandInfoMatch) sections.brandInfo = brandInfoMatch[1].trim();
    if (commentsMatch) sections.comments = commentsMatch[1].trim();
    
    return sections;
  };

  
  
  const inquirySections = parseInquiryContent(inquiryContent);
  
  // Extract venue owner information
  const [venueOwnerFallback, setVenueOwnerFallback] = useState<any | null>(null);
  // Determine if current user is a member of the venue owner's organization
  const [isOrgMember, setIsOrgMember] = useState<boolean>(false);

  useEffect(() => {
    const fetchVenueOwner = async () => {
      try {
        if (venueOwnerFallback) return; // already fetched
        const venueId = property?.venue_id;
        if (!venueId) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, primary_organization_id')
          .eq('id', venueId)
          .single();
        if (!error && data) {
          setVenueOwnerFallback(data);
        }
      } catch (e) {
        console.warn('Could not fetch venue owner profile:', e);
      }
    };
    fetchVenueOwner();
  }, [property?.venue_id]);

  // After owner/org info is present, check if current user is an org member
  useEffect(() => {
    const checkOrgMembership = async () => {
      try {
        const ownerOrgId = booking?.property?.organization_id || booking?.property?.profiles?.primary_organization_id || venueOwnerFallback?.primary_organization_id;
        if (!ownerOrgId || !user?.id) {
          setIsOrgMember(false);
          return;
        }
        const { data, error } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', ownerOrgId)
          .eq('user_id', user.id)
          .limit(1);
        if (error) throw error;
        setIsOrgMember((data || []).length > 0);
      } catch (e) {
        // On error, default to not a member
        setIsOrgMember(false);
      }
    };
    checkOrgMembership();
  }, [booking?.property?.organization_id, booking?.property?.profiles?.primary_organization_id, venueOwnerFallback?.primary_organization_id, user?.id]);
  
  // State for calendar dropdown
  const [showCalendarDropdown, setShowCalendarDropdown] = React.useState(false);
  
  // Handle calendar dropdown toggle
  const toggleCalendarDropdown = () => {
    setShowCalendarDropdown(!showCalendarDropdown);
  };
  
  // Generate calendar event data
  const handleAddToCalendar = async (type: 'google' | 'apple' | 'outlook') => {
    if (!booking) return;
    
    const eventTitle = `Space booking at ${booking.proposals?.inquiries?.properties?.title || 'Property'}`;
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    
    // Build a complete location string with all address components
    let location = 'Unknown location';
    if (booking.proposals?.inquiries?.properties) { 
      const property = booking.proposals.inquiries.properties;
      const addressParts = [];
      
      // Add street address if available
      if (property.address_street) {
        addressParts.push(property.address_street);
      }
      
      // Add city, state, postal code
      const cityStatePostal = [];
      if (property.address_city) cityStatePostal.push(property.address_city);
      if (property.address_state) cityStatePostal.push(property.address_state);
      if (property.address_postal_code) cityStatePostal.push(property.address_postal_code);
      
      if (cityStatePostal.length > 0) {
        addressParts.push(cityStatePostal.join(' '));
      }
      
      // Add country if available
      if (property.address_country) {
        addressParts.push(property.address_country);
      }
      
      // Join all parts with commas
      if (addressParts.length > 0) {
        location = addressParts.join(', ');
      }
    }
    
    // Create a specific description with booking ID
    const description = `Booking details: ${window.location.origin}/dashboard?booking=${booking.id}\nDates: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
    
    if (type === 'google') {
      // Google Calendar link
      const googleResult = generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'google', true);
      if (!googleResult) {
        console.error('Failed to generate Google Calendar URL');
      } else if (typeof googleResult === 'string') {
        window.open(googleResult, '_blank');
      } else {
        // Some implementations may return Uint8Array; build a Blob URL and open it
        const blob = new Blob([googleResult], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } else if (type === 'apple' || type === 'outlook') {
      // Download .ics file for Apple Calendar or Outlook
      const icsFile = await generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'ics', true);
      
      if (!icsFile) {
        console.error('Failed to generate ICS file content');
        return;
      }

      // Build a Blob from either string or Uint8Array
      const blob =
        typeof icsFile === 'string'
          ? new Blob([icsFile], { type: 'text/calendar;charset=utf-8' })
          : new Blob([icsFile], { type: 'text/calendar' });

      const url = URL.createObjectURL(blob);

      // Create a download link with the ICS content
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `booking-${booking.id.substring(0, 8)}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }
    
    // Close dropdown after selection
    setShowCalendarDropdown(false);
  };
  
  // Determine if user is the booker or the venue owner
  const isCustomer = user?.id === booking.user_id;
  const isVenueOwner = user?.id === booking.proposals?.inquiries?.properties?.venue_id;
  
  // Fetch payout breakdown for venue owners (runs after isVenueOwner is defined)
  useEffect(() => {
    const loadPayout = async () => {
      if (!booking?.id) return;
      // Only venue owner or org members should request payout breakdown
      if (!isVenueOwner && !isOrgMember) {
        setPayout(null);
        return;
      }
      // If there's no Stripe payment intent yet, payout breakdown isn't available.
      // Avoid hitting the edge function (which may respond 400) and just show nothing.
      if (!stripePaymentIntentId || String(stripePaymentIntentId).trim() === '') {
        setPayout(null);
        setPayoutError(null);
        return;
      }
      // In React StrictMode dev, effects can run more than once. Prevent duplicate calls per booking.
      if (payoutAttemptByBookingIdRef.current[booking.id]) {
        return;
      }
      payoutAttemptByBookingIdRef.current[booking.id] = true;
      try {
        setPayoutLoading(true);
        setPayoutError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Your session has expired. Please sign in again.');
        const { data, error } = await supabase.functions.invoke('booking-payout-breakdown', {
          body: { bookingId: booking.id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) {
          const status = (error as any)?.context?.status;
          // Treat 400 as "not available" rather than a fatal UI error.
          // (Often means incomplete booking/payment state or function-side validation.)
          if (status === 400) {
            setPayout(null);
            return;
          }

          console.warn('Payout breakdown edge function error:', {
            name: (error as any)?.name,
            message: (error as any)?.message,
            status,
          });
          // If unauthorized, silently ignore (not a responder/org member)
          if ((error as any)?.message?.toLowerCase?.().includes('unauthorized')) {
            setPayout(null);
            return;
          }
          // If forbidden (403), also silently ignore
          if ((error as any)?.message?.toLowerCase?.().includes('forbidden')) {
            setPayout(null);
            return;
          }
          throw error;
        }
        setPayout(data || null);
      } catch (err: any) {
        // Avoid noisy console errors for payout breakdown; this is non-critical UI.
        // If function returns 400, treat as "not available" rather than an error state.
        if (err?.context?.status === 400) {
          setPayout(null);
          setPayoutError(null);
          return;
        }

        console.warn('Failed to load payout breakdown:', {
          name: err?.name,
          message: err?.message,
          status: err?.context?.status,
        });
        setPayoutError(err?.message || 'Failed to load payout breakdown');
      } finally {
        setPayoutLoading(false);
      }
    };
    loadPayout();
  }, [booking?.id, isVenueOwner, isOrgMember]);
  
  // Check if booking can be canceled
  const canCancel = booking.status !== 'canceled' && (isVenueOwner || (isCustomer && new Date(booking.start_date) > new Date()));
  
  // Handle booking cancellation
  const handleCancelBooking = async () => {
    if (!canCancel) return;
    
    setCancelLoading(true);
    setCancelError(null);
    
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Your session has expired. Please sign in again to continue.');
      }
      
      // Call the cancel booking API
      await cancelBooking(booking.id, cancelReason, session.access_token);
      
      // Close the modal
      setShowCancelModal(false);
      
      // Notify parent component to refresh data
      if (onBookingUpdated) {
        onBookingUpdated();
      }
      
      // Close the booking details
      onClose();
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Error canceling booking:', err);
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancelLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Property Information */}
      <div>
        <h3 className="text-lg font-semibold text-maroon-800 mb-3">Space Information</h3>
        <Card className="p-4">
          <div className="flex gap-4 items-start">
            {property?.images && property.images[0] && (
              <div className="w-24 h-24 flex-shrink-0">
                <img 
                  src={property.images[0]} 
                  alt={property.title}
                  className="w-full h-full object-cover rounded-lg" 
                />
              </div>
            )}
            <div>
              <h4 className="text-base font-medium text-maroon-800">
                {property?.title || 'Property'}
              </h4>
              
              <div className="flex items-center text-maroon-600 text-sm mt-1">
                <MapPin 
                  className="h-3 w-3 mr-1" 
                  data-testid="map-pin-icon"
                />
                {property?.address_city}, {property?.address_state}
              </div>
              
              {property?.address_street && (
                <p className="text-maroon-600 text-sm mt-1">
                  {property.address_street}
                </p>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => {
                  navigate(`/property/${property?.id || booking.proposals?.inquiries?.property_id}`);
                  onClose();
                }}
              >
                <Building2 className="h-3 w-3 mr-1.5" />
                View Property
              </Button>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Parties Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Venue Owner Information */}
        <div>
          <h3 className="text-lg font-semibold text-maroon-800 mb-3">Venue Owner</h3>
          <Card className="p-4">
            <div className="space-y-2">
              {venueOwnerFallback || (property?.venue_id && isVenueOwner) ? (
                <>
                  <div className="flex items-start">
                    <User className="h-4 w-4 text-maroon-500 mt-0.5 mr-2" />
                    <div>
                      <p className="text-maroon-800 font-medium">
                        {venueOwnerFallback?.full_name || (isVenueOwner ? user?.full_name : 'Venue Owner')}
                      </p>
                    </div>
                  </div>
                  
                  {(venueOwnerFallback?.phone || (isVenueOwner && user?.phone)) && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-maroon-500 mr-2" />
                      <p className="text-maroon-600">
                        {venueOwnerFallback?.phone || (isVenueOwner && user?.phone)}
                      </p>
                    </div>
                  )}
                  
                  {(venueOwnerFallback?.email || (isVenueOwner && user?.email)) && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-maroon-500 mr-2" />
                      <p className="text-maroon-600">
                        {venueOwnerFallback?.email || (isVenueOwner && user?.email)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-maroon-600 italic">Venue owner information unavailable</p>
              )}
            </div>
          </Card>
        </div>
        
        {/* Customer Information */}
        <div>
          <h3 className="text-lg font-semibold text-maroon-800 mb-3">Customer</h3>
          <Card className="p-4">
            <div className="space-y-2">
              {customer ? (
                <>
                  <div className="flex items-start">
                    <User className="h-4 w-4 text-maroon-500 mt-0.5 mr-2" />
                    <div>
                      <p className="text-maroon-800 font-medium">
                        {customer.full_name}
                      </p>
                    </div>
                  </div>
                  
                  {customer.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-maroon-500 mr-2" />
                      <p className="text-maroon-600">
                        {customer.phone}
                      </p>
                    </div>
                  )}
                  
                  {customer.email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-maroon-500 mr-2" />
                      <p className="text-maroon-600">
                        {customer.email}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-maroon-600 italic">Customer information unavailable</p>
              )}
            </div>
          </Card>
        </div>
      </div>
      
      {/* Cancel Booking Confirmation Modal */}
      <Dialog
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Booking"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Are you sure you want to cancel this booking?</p>
              {isCustomer && (
                <p className="text-sm mt-1">
                  You will receive a full refund if canceling before the booking start date.
                </p>
              )}
              {isVenueOwner && (
                <p className="text-sm mt-1">
                  {new Date(booking.start_date) > new Date() 
                    ? "The customer will receive a full refund." 
                    : new Date(booking.end_date) > new Date()
                      ? "The customer will receive a prorated refund for the unused portion of the booking."
                      : "No refund will be issued as the booking period has ended."}
                </p>
              )}
            </div>
          </div>
          
          {cancelError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
              {cancelError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-maroon-700 mb-2">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Please provide a reason for cancellation..."
              className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelLoading}
            >
              Keep Booking
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelBooking}
              isLoading={cancelLoading}
              disabled={cancelLoading}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Dialog>
      
      {/* Booking and Date Information */}
      <div>
        <h3 className="text-lg font-semibold text-maroon-800 mb-3">Booking Information</h3>
        <Card className="p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <p className="text-sm text-maroon-500">Booking Created</p>
                <p className={`h-4 w-4 text-maroon-800 mr-2 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                  {formatDate(booking.created_at)}
                </p>
              </div>
              
              <div className="col-span-1">
                <p className="text-sm text-maroon-500">Booking Status</p>
                <div className="flex items-center">
                  <p className={`text-maroon-800 mr-2 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                    {(() => { const s = booking.status ?? 'pending'; return s.charAt(0).toUpperCase() + s.slice(1); })()}
                  </p>
                  {booking.payment_status === 'paid' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  )}
                  {booking.payment_status === 'pending' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Payment Pending
                    </span>
                  )}
                  {booking.payment_status === 'failed' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Payment Failed
                    </span>
                  )}
                  {booking.status === 'canceled' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Canceled
                    </span>
                  )}
                </div>
              </div>
              
              <div className="col-span-1 flex items-end justify-end">
                {booking.status !== 'canceled' && canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => setShowCancelModal(true)}
                    data-testid="cancel-booking-button"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Cancel Booking
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-maroon-500">Booking Dates</p>
              <div className="flex items-center mt-1">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-maroon-600 mr-2" />
                  <p className={`text-maroon-800 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                    {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                  </p>
                </div>
                
                {/* Add to Calendar Button - Only show if booking is not canceled or completed */}
                {booking.status !== 'canceled' && booking.status !== 'completed' && (
                  <div className="relative ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={toggleCalendarDropdown}
                      title="Add to Calendar"
                    >
                      <div className="flex items-center">
                        <CalendarPlus className="h-4 w-4 mr-1.5" />
                        <span>Add to Calendar</span>
                      </div>
                      <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showCalendarDropdown ? 'rotate-180' : ''}`} />
                    </Button>
                    
                    {/* Calendar Dropdown */}
                    {showCalendarDropdown && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg py-1 z-10 border border-gray-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2 px-4 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => handleAddToCalendar('google')} 
                          aria-label="Add to Google Calendar"
                        >
                          <span className="w-5 h-5 mr-2 flex items-center justify-center text-blue-500">G</span>
                          Google Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2 px-4 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => handleAddToCalendar('apple')}
                          aria-label="Add to Apple Calendar"
                        >
                          <span className="w-5 h-5 mr-2 flex items-center justify-center text-gray-800">
                            <Calendar className="h-4 w-4" />
                          </span>
                          Apple Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2 px-4 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => handleAddToCalendar('outlook')}
                          aria-label="Add to Outlook Calendar"
                        >
                          <span className="w-5 h-5 mr-2 flex items-center justify-center text-blue-600">O</span>
                          Outlook
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-maroon-500">Associated Inquiry</p>
              {inquiry?.id ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="pl-0"
                  onClick={() => {
                    navigate(`/messages?inquiry=${inquiry.id}`);
                  }}
                >
                  <MessageSquare 
                    className="h-4 w-4 mr-1.5" 
                    data-testid="message-icon" 
                  />
                  View Message Thread
                </Button>
              ) : (
                <p className="text-sm text-gray-500 mt-1">No associated inquiry</p>
              )}
            </div>
          </div>
        </Card>
      </div>
      
      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-semibold text-maroon-800 mb-3">Payment Information</h3>
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-maroon-500">Total Amount</p>
              <p className="text-xl font-semibold text-maroon-800">
                {formatCurrency(price, booking.currency)}
              </p>
            </div>
            
            <div className="text-center">
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between">
                  <p className="text-maroon-600">Base Price</p>
                  <p className={`text-maroon-800 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                    {formatCurrency(price, booking.currency)}
                  </p>
                </div>
                
                {booking.payment_status === 'paid' && booking.status !== 'canceled' && (
                  <div className="flex justify-between">
                    <p className="text-maroon-600">Taxes</p>
                    <p className="text-maroon-800">{formatCurrency(booking.payment_breakdown?.taxes || 0, booking.currency)}</p>
                  </div>
                )}
                
                {booking.payment_status === 'pending' && booking.status !== 'canceled' && (
                  <div className="flex justify-between">
                    <p className="text-maroon-600">Taxes</p>
                    <p className="text-maroon-800">{formatCurrency(booking.payment_breakdown?.taxes || 0, booking.currency)}</p>
                  </div>
                )}
                
                {booking.payment_status === 'failed' && booking.status !== 'canceled' && (
                  <div className="flex justify-between">
                    <p className="text-maroon-600">Taxes</p>
                    <p className={`text-maroon-800 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                      {formatCurrency(booking.payment_breakdown?.taxes || 0, booking.currency)}
                    </p>
                  </div>
                )}
                
                {(booking.payment_breakdown?.fees || 0) > 0 && (
                  <div className="flex justify-between">
                    <p className="text-maroon-600">Fees</p>
                    <p className={`text-maroon-800 ${booking.status === 'canceled' ? 'line-through' : ''}`}>
                      {formatCurrency(booking.payment_breakdown?.fees || 0, booking.currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {(payout && payout.available) && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-maroon-500">Payout Breakdown</p>
                {payoutLoading && (
                  <p className="text-sm text-gray-500 mt-1">Loading payout details…</p>
                )}
                {payoutError && (
                  <p className="text-sm text-red-600 mt-1">{payoutError}</p>
                )}
                {payout && payout.available && (
                  <div className="mt-2 space-y-1">
                    {/* Subtotal */}
                    <div className="flex justify-between">
                      <p className="text-maroon-600">Subtotal (Base + Taxes + Fees)</p>
                      <p className="text-maroon-800">
                        {formatCurrency(
                          (booking.payment_breakdown?.base_price || 0) +
                          (booking.payment_breakdown?.taxes || 0) +
                          (booking.payment_breakdown?.fees || 0),
                          booking.currency
                        )}
                      </p>
                    </div>
                    {/* Commission (original, before service credit) */}
                    <div className="flex justify-between">
                      <p className="text-maroon-600">
                        {`Less: Platform Commission`}
                        {computedCommissionPercent != null && (
                          ` (${formatPercent(computedCommissionPercent)}%)`
                        )}
                      </p>
                      <p className="text-maroon-800">-
                        {formatCurrency((payout.originalCommissionAmount ?? payout.commissionAmount ?? 0), payout.currency || booking.currency)}
                      </p>
                    </div>
                    {/* Service credit applied (if any) */}
                    {payout.serviceCreditApplied && payout.serviceCreditApplied > 0 && (
                      <div className="flex justify-between">
                        <p className="text-maroon-600">Service credit applied</p>
                        <p className="text-maroon-800">+
                          {formatCurrency(payout.serviceCreditApplied, payout.currency || booking.currency)}
                        </p>
                      </div>
                    )}
                    {/* Stripe processing fee */}
                    <div className="flex justify-between">
                      <p className="text-maroon-600">
                        {payout.stripeFeePending ? 'Less: Stripe Processing Fee (Pending)' : 'Less: Stripe Processing Fee'}
                      </p>
                      <p className="text-maroon-800">-
                        {formatCurrency(payout.stripeProcessingFee || 0, payout.currency || booking.currency)}
                      </p>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-100">
                      <p className="text-maroon-700 font-medium">Estimated Payout</p>
                      <p className="text-maroon-800 font-semibold">
                        {formatCurrency(payout.payoutAmount || 0, payout.currency || booking.currency)}
                      </p>
                    </div>
                  </div>
                )}
                {payout && !payout.available && (
                  <p className="text-sm text-gray-500 mt-1">Payout details are not available yet.</p>
                )}
              </div>
            )}

            {stripePaymentIntentId && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-maroon-500">Payment Details</p>
                <div className="flex items-center mt-1">
                  <CreditCard className="h-4 w-4 text-maroon-600 mr-2" />
                  <p className="text-maroon-800 text-xs font-mono">
                    {stripePaymentIntentId}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      
      {/* Inquiry Information (if available) */}
      {(inquirySections.spaceRequirements || inquirySections.brandInfo || inquirySections.comments) && (
        <div>
          <h3 className="text-lg font-semibold text-maroon-800 mb-3">Inquiry Information</h3>
          <Card className="p-4">
            <div className="space-y-4">
              {inquirySections.spaceRequirements && (
                <div>
                  <p className="text-sm font-medium text-maroon-700 mb-1">Space Requirements</p>
                  <p className="text-maroon-600 bg-gray-50 p-2 rounded-lg">
                    {inquirySections.spaceRequirements}
                  </p>
                </div>
              )}
              
              {inquirySections.brandInfo && (
                <div>
                  <p className="text-sm font-medium text-maroon-700 mb-1">About the Brand</p>
                  <p className="text-maroon-600 bg-gray-50 p-2 rounded-lg">
                    {inquirySections.brandInfo}
                  </p>
                </div>
              )}
              
              {inquirySections.comments && (
                <div>
                  <p className="text-sm font-medium text-maroon-700 mb-1">Comments</p>
                  <p className="text-maroon-600 bg-gray-50 p-2 rounded-lg">
                    {inquirySections.comments}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BookingDetails;