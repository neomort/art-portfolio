import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Calendar, MessageCircleQuestion, RefreshCw, CheckCircle, MapPin, Home, FileText, CalendarPlus, ChevronDown, LayoutDashboard, Settings, Download } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '../components/ui/button';
import { Tooltip } from '../components/ui/Tooltip';
import PropertyCard from '../components/property/PropertyCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
// Removed legacy pending inquiry helpers
import { formatCurrency, formatDate } from '../lib/utils';
import { formatFullAddress, formatCityState } from '../lib/formatAddress';
import { 
  toDashboardProperty,
  toDashboardInquiry,
  toDashboardBooking,
  type DashboardProperty,
  type DashboardInquiry,
  type DashboardBooking,
  type PaymentBreakdown,
} from './dashboardMappers';
import { generateCalendarEvent } from '../lib/calendar';
import { Dialog } from '../components/ui/dialog';
import BookingDetails from '../components/booking/BookingDetails';

// Minimal local types for this page to reduce 'any' usage

// Types and mappers are imported from './dashboardMappers'


// Local type aliases for status values remain implicit via imported types

const PROPERTIES_PER_PAGE = 99;

const DashboardPage: React.FC = () => {
  usePageHeaderTitle('Dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, passwordNeeded } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticePropertyId, setNoticePropertyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [inquiries, setInquiries] = useState<DashboardInquiry[]>([]);
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [bookingViewMode, setBookingViewMode] = useState<'upcoming' | 'completed'>('upcoming');
  const [bookingDetailsKey, setBookingDetailsKey] = useState(0);
  const [initialBookingId, setInitialBookingId] = useState<string | null>(null);
  const [ownedPropertyIds, setOwnedPropertyIds] = useState<string[]>([]);
  const [userOrgIds, setUserOrgIds] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<Array<{ id: string; name?: string | null; business_type?: string | null }>>([]);
  const [showShareMenu, setShowShareMenu] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [propertyPage, setPropertyPage] = useState(1);
  // Removed legacy pending inquiry finish banner state

  const propertyTotalPages = Math.max(1, Math.ceil(properties.length / PROPERTIES_PER_PAGE));
  const paginatedDashboardProperties = useMemo(() => {
    const start = (propertyPage - 1) * PROPERTIES_PER_PAGE;
    return properties.slice(start, start + PROPERTIES_PER_PAGE);
  }, [properties, propertyPage]);
  const propertyRangeStart = (propertyPage - 1) * PROPERTIES_PER_PAGE;
  const propertyRangeEnd = Math.min(properties.length, propertyRangeStart + paginatedDashboardProperties.length);
  const propertyHasPagination = properties.length > PROPERTIES_PER_PAGE;

  useEffect(() => {
    if (propertyPage > propertyTotalPages) {
      setPropertyPage(propertyTotalPages);
    }
  }, [propertyPage, propertyTotalPages]);

  useEffect(() => {
    setPropertyPage(1);
  }, [properties.length]);

  // Show a banner if a pending inquiry token exists locally after auth
  // Removed legacy pending inquiry detection

  const goToPropertyPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), propertyTotalPages);
    setPropertyPage(nextPage);
    if (typeof window !== 'undefined') {
      const section = document.getElementById('your-properties');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePropertyNextPage = () => {
    if (propertyPage < propertyTotalPages) {
      goToPropertyPage(propertyPage + 1);
    }
  };

  const handlePropertyPreviousPage = () => {
    if (propertyPage > 1) {
      goToPropertyPage(propertyPage - 1);
    }
  };

  // Removed legacy pending inquiry handler

  // Check for booking ID in URL query parameters (react to navigation changes)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const bookingId = searchParams.get('booking');
    setInitialBookingId(bookingId);

    const n = searchParams.get('notice');
    const pid = searchParams.get('property');
    if (n) setNotice(decodeURIComponent(n));
    if (pid) setNoticePropertyId(pid);
  }, [location.search]);


  // Get open inquiries (not converted to confirmed bookings and not closed)
  const openInquiries = useMemo(() => {
    return inquiries.filter(inquiry => {
      // Check if the current user is the initiator or responder
      const isInitiator = inquiry.user_id === user?.id;
      const isResponder = inquiry.property?.venue_id === user?.id;
      
      // Skip if deleted by the current user based on their role
      if ((isInitiator && inquiry.initiator_deleted) || 
          (isResponder && inquiry.responder_deleted)) {
        return false;
      }
      
      // Skip if payment is completed (check related booking's status, not inquiry.status)
      const relatedBooking = bookings.find(booking => 
        booking?.proposal?.inquiry_id === inquiry.id
      );
      if (relatedBooking && relatedBooking.payment_status === 'paid') {
        return false;
      }
      // Defensive: check deleted flags and valid inquiry statuses
      const isActiveStatus = inquiry.status === 'pending' || inquiry.status === 'responded' || inquiry.status === 'converted_to_proposal';
      return isActiveStatus;

    });
  }, [inquiries, bookings, user?.id]);

  // Calculate active inquiries count
  const activeInquiriesCount = openInquiries.length;

  // Defensive: robust loading state for bookings
  const bookingsLoading = loading || bookings === undefined || bookings === null;


  // State for calendar dropdown
  const [calendarDropdownBookingId, setCalendarDropdownBookingId] = useState<string | null>(null);

  // Stable key for owned property IDs to use in effect deps and filters
  const ownedPropertyKey = useMemo(() => ownedPropertyIds.join(','), [ownedPropertyIds]);

  // A) Auth redirect effect
  useEffect(() => {
    if (!user) {
      navigate('/signin?redirect=/dashboard');
    }
  }, [user, navigate]);

  // Update inquiries status based on bookings (stable callback)
  const updateInquiriesStatus = useCallback(async (inquiries: DashboardInquiry[], bookings: DashboardBooking[]) => {
    try {
      const paidBookings = bookings.filter(booking => 
        booking.payment_status === 'paid' && 
        booking.proposal?.inquiry_id
      );

      const inquiryIdsToUpdate = paidBookings
        .map(booking => booking.proposal?.inquiry_id)
        .filter((id): id is string => !!id);

      const inquiriesToUpdate = inquiries.filter(inquiry => 
        inquiryIdsToUpdate.includes(inquiry.id) && 
        inquiry.status !== 'payment_completed'
      );

      if (inquiriesToUpdate.length > 0) {
        console.log(`Updating ${inquiriesToUpdate.length} inquiries to payment_completed status`);
        for (const inquiry of inquiriesToUpdate) {
          const { error } = await (supabase as any)
            .from('inquiries')
            .update({
              status: 'payment_completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', inquiry.id);
          if (error) {
            console.error(`Error updating inquiry ${inquiry.id}:`, error);
          }
        }

        // Reload inquiries to reflect the updates
        const { data: updatedInquiries, error: inquiriesError } = await (supabase as any)
          .from('inquiries')
          .select(`
            *,
            property:properties(title, venue_id)
          `)
          .or(`user_id.eq.${user!.id}${ownedPropertyKey ? `,property_id.in.(${ownedPropertyKey})` : ''}`)
          .order('created_at', { ascending: false });
        if (!inquiriesError && updatedInquiries) {
          setInquiries(updatedInquiries as DashboardInquiry[]);
        }
      }
    } catch (err) {
      console.error('updateInquiriesStatus error', err);
    }
  }, [user, ownedPropertyKey]);

  // Load dashboard data (stable callback)
  const loadDashboardData = useCallback(async () => {
    // Add null check for user at the beginning
    if (!user) {
      console.warn('Cannot load dashboard data: user is null');
      return;
    }

    try {
      console.log('Loading dashboard data for user:', user.id);
      
      // Fetch properties for which the current user is either the venue owner OR a member of the property's organization
      let propertiesData: unknown[] = [];
      // 1) Find organizations current user belongs to
      const { data: orgMemberships, error: orgErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);
      if (orgErr) {
        console.error('Organization memberships fetch error:', orgErr);
        // Non-fatal; continue with personal properties only
      }
      const orgIds: string[] = (orgMemberships || []).map((m: any) => m.organization_id);
      setUserOrgIds(orgIds);
      // 1b) Load organization records for business type checks
      try {
        if (orgIds.length > 0) {
          const { data: orgRows, error: orgRowsErr } = await supabase
            .from('organizations')
            .select('id,name,business_type')
            .in('id', orgIds);
          if (orgRowsErr) {
            console.error('Organizations fetch error:', orgRowsErr);
          } else {
            setOrgs((orgRows as any[])?.map(r => ({ id: r.id, name: r.name ?? null, business_type: r.business_type ?? null })) ?? []);
          }
        } else {
          setOrgs([]);
        }
      } catch (e) {
        console.error('Network error fetching organizations:', e);
      }
      try {
        // 2) Personal-owned properties
        const { data: personalProps, error: personalErr } = await supabase
          .from('properties')
          .select('*')
          .eq('venue_id', user.id);
        if (personalErr) {
          console.error('Personal properties fetch error:', personalErr);
          throw new Error(`Failed to fetch properties: ${personalErr.message}`);
        }

        // 3) Organization-scoped properties (if any org memberships)
        let orgProps: any[] = [];
        if (orgIds.length > 0) {
          const { data: oprops, error: orgPropsErr } = await supabase
            .from('properties')
            .select('*')
            .in('organization_id', orgIds);
          if (orgPropsErr) {
            console.error('Org properties fetch error:', orgPropsErr);
            throw new Error(`Failed to fetch org properties: ${orgPropsErr.message}`);
          }
          orgProps = oprops || [];
        }

        // 4) Combine and de-duplicate by id
        const byId = new Map<string, any>();
        for (const p of (personalProps || [])) byId.set((p as any).id, p);
        for (const p of orgProps) byId.set((p as any).id, p);
        propertiesData = Array.from(byId.values());
      } catch (error) {
        console.error('Network error fetching properties:', error);
        if (error instanceof TypeError && (error as Error).message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      // Transform the flat address data into nested structure
      const propertyIds = propertiesData
        .map((p) => (p as any).id as string | null | undefined)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      setOwnedPropertyIds(propertyIds);
      
      const transformedProperties: DashboardProperty[] = propertiesData.map((property: any) => ({
        ...property,
        address: {
          street: property.address_street,
          city: property.address_city,
          state: property.address_state,
          postalCode: property.address_postal_code,
          country: property.address_country,
          latitude: property.latitude,
          longitude: property.longitude
        }
      }));
      
      setProperties(transformedProperties.map(toDashboardProperty));

      // Fetch inquiries with better error handling (for current user as requester OR org/personal properties as responder)
      let inquiriesData: unknown[] = [];
      let inquiriesTyped: DashboardInquiry[] = [];
      try {
        const sb: any = supabase;
        const inquirySelect = `
            *,
            property:properties(
              title,
              venue_id,
              profiles:profiles!properties_venue_id_fkey(
                full_name,
                organization:organizations!profiles_primary_organization_id_fkey(
                  name
                )
              )
            )
          `;

        const { data: personalInquiries, error: personalErr } = await sb
          .from('inquiries')
          .select(inquirySelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (personalErr) {
          console.error('Inquiries fetch error (personal):', personalErr);
          throw new Error(`Failed to fetch inquiries: ${personalErr.message}`);
        }

        const combined: any[] = personalInquiries || [];

        if (propertyIds.length > 0) {
          const uniquePropertyIds = Array.from(new Set(propertyIds));
          const chunkSize = 50;
          for (let i = 0; i < uniquePropertyIds.length; i += chunkSize) {
            const chunk = uniquePropertyIds.slice(i, i + chunkSize);
            const { data: propertyInquiries, error: propertyErr } = await sb
              .from('inquiries')
              .select(inquirySelect)
              .in('property_id', chunk)
              .order('created_at', { ascending: false });

            if (propertyErr) {
              console.error('Inquiries fetch error (properties):', propertyErr);
              throw new Error(`Failed to fetch inquiries: ${propertyErr.message}`);
            }

            if (propertyInquiries) {
              combined.push(...propertyInquiries);
            }
          }
        }

        // Deduplicate by inquiry ID and sort by created_at descending
        const byId = new Map<string, any>();
        for (const row of combined) {
          if (row && row.id) {
            byId.set(row.id, row);
          }
        }
        inquiriesData = Array.from(byId.values()).sort((a: any, b: any) => {
          const aTime = new Date(a?.created_at ?? 0).getTime();
          const bTime = new Date(b?.created_at ?? 0).getTime();
          return bTime - aTime;
        });
      } catch (error) {
        console.error('Network error fetching inquiries:', error);
        if (error instanceof TypeError && (error as Error).message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        throw error;
      }
      inquiriesTyped = (inquiriesData as any[]).map(toDashboardInquiry);
      setInquiries(inquiriesTyped);

      // Fetch bookings with better error handling
      let bookingsData: unknown[] = [];
      try {
        const sb: any = supabase;
        const bookingSelect = `  
            *,
            property:properties(
              id, 
              title, 
              venue_id, 
              organization_id,
              images, 
              address_street, 
              address_city, 
              address_state,
              tax_rate,
              fee_type,
              fee_value,
              fee_description,
              profiles:profiles!properties_venue_id_fkey(
                id,
                full_name,
                email,
                phone,
                organization:organizations!profiles_primary_organization_id_fkey(
                  id,
                  name
                )
              )
            ),
            proposal:proposals(
              id,
              inquiry_id,
              price_total,
              currency,
              message
            ),
            customer:profiles!bookings_user_id_fkey(
              id,
              full_name,
              email,
              phone
            )
          `;

        const { data: personalBookings, error: personalBookingsErr } = await sb
          .from('bookings')
          .select(bookingSelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (personalBookingsErr) {
          console.error('Bookings fetch error (personal):', personalBookingsErr);
          throw new Error(`Failed to fetch bookings: ${personalBookingsErr.message}`);
        }

        const combinedBookings: any[] = personalBookings || [];

        if (propertyIds.length > 0) {
          const uniquePropertyIds = Array.from(new Set(propertyIds));
          const chunkSize = 50;
          for (let i = 0; i < uniquePropertyIds.length; i += chunkSize) {
            const chunk = uniquePropertyIds.slice(i, i + chunkSize);
            const { data: propertyBookings, error: propertyBookingsErr } = await sb
              .from('bookings')
              .select(bookingSelect)
              .in('property_id', chunk)
              .order('created_at', { ascending: false });

            if (propertyBookingsErr) {
              console.error('Bookings fetch error (properties):', propertyBookingsErr);
              throw new Error(`Failed to fetch bookings: ${propertyBookingsErr.message}`);
            }

            if (propertyBookings) {
              combinedBookings.push(...propertyBookings);
            }
          }
        }

        const bookingsById = new Map<string, any>();
        for (const row of combinedBookings) {
          if (row && row.id) {
            bookingsById.set(row.id, row);
          }
        }

        bookingsData = Array.from(bookingsById.values()).sort((a: any, b: any) => {
          const aTime = new Date(a?.created_at ?? 0).getTime();
          const bTime = new Date(b?.created_at ?? 0).getTime();
          return bTime - aTime;
        });
      } catch (error) {
        console.error('Network error fetching bookings:', error);
        if (error instanceof TypeError && (error as Error).message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        throw error;
      }
      
      // Fetch additional inquiry data for each booking
      const baseBookings: DashboardBooking[] = (bookingsData as any[]).map(toDashboardBooking);
      const bookingsWithInquiries: DashboardBooking[] = await Promise.all(
        baseBookings.map(async (booking) => {
          if (booking.proposal?.inquiry_id) {
            const { data: inquiry }: any = await (supabase as any)
              .from('inquiries')
              .select('id, message, created_at')
              .eq('id', booking.proposal.inquiry_id)
              .single();
              
            // Add payment breakdown info
            const paymentBreakdown: PaymentBreakdown = {
              base_price: 0,
              taxes: 0,
              fees: 0,
              fee_description: booking.property?.fee_description ?? null
            };
            
            if (booking.price_total) {
              const property = booking.property;
              if (property) {
                const startDate = new Date(booking.start_date);
                const endDate = new Date(booking.end_date);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
                
                if (property.price_per_day != null) {
                  paymentBreakdown.base_price = Number(property.price_per_day) * diffDays;
                } else {
                  paymentBreakdown.base_price = Number(booking.price_total ?? 0);
                }
                
                if (property.tax_rate && Number(property.tax_rate) > 0) {
                  paymentBreakdown.taxes = paymentBreakdown.base_price * (Number(property.tax_rate) / 100);
                }
                
                if (property.fee_value && Number(property.fee_value) > 0) {
                  if (property.fee_type === 'percentage') {
                    paymentBreakdown.fees = paymentBreakdown.base_price * (Number(property.fee_value) / 100);
                  } else {
                    paymentBreakdown.fees = Number(property.fee_value);
                  }
                  paymentBreakdown.fee_description = property.fee_description ?? null;
                }
                
                const calculatedTotal = paymentBreakdown.base_price + paymentBreakdown.taxes + paymentBreakdown.fees;
                const bookingTotal = Number(booking.price_total ?? 0);
                if (Math.abs(calculatedTotal - bookingTotal) > 0.01) {
                  paymentBreakdown.base_price = bookingTotal - paymentBreakdown.taxes - paymentBreakdown.fees;
                }
              }
            }
              
            return {
              ...booking,
              inquiry: inquiry ? { id: inquiry.id, message: inquiry.message ?? null, created_at: inquiry.created_at } : null,
              payment_breakdown: paymentBreakdown
            } as DashboardBooking;
          }
          return booking;
        })
      );
      
      console.log('Loaded bookings with inquiries:', bookingsWithInquiries);
      setBookings(bookingsWithInquiries);
      
      // After loading all data, update the inquiries status based on bookings
      updateInquiriesStatus(inquiriesTyped, bookingsWithInquiries);
      
    } catch (error) {
      console.error('Error loading dashboard data:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Unable to connect')) {
          console.error('Network connectivity issue:', error.message);
        } else {
          console.error('Application error:', error.message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, updateInquiriesStatus]);

  // Compute if user is a member of any org with business type set to Venue owner/operator
  const isVenueOwnerOperatorMember = useMemo(() => {
    return orgs.some(o => ((o.business_type || '').toString().toLowerCase()) === 'venue');
  }, [orgs]);

  // Compute a preferred orgId for sharing links
  const preferredOrgId = useMemo(() => {
    if (userOrgIds && userOrgIds.length > 0) return userOrgIds[0];
    const withOrg = properties.find((p: any) => p?.organization_id);
    return (withOrg as any)?.organization_id || '';
  }, [userOrgIds, properties]);

  const buildOrgListingUrl = (view: 'full' | 'map' | 'filters') => {
    if (!preferredOrgId || typeof window === 'undefined') return '';
    const base = window.location.origin;
    const url = new URL(`${base}/properties`);
    url.searchParams.set('org_id', preferredOrgId);
    url.searchParams.set('view', view);
    return url.toString();
  };

  const copyShareLink = async (view: 'full' | 'map' | 'filters') => {
    const link = buildOrgListingUrl(view);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setShareCopied(true);
      // Auto-hide ephemeral alert
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      } catch {}
    }
    setShowShareMenu(false);
  };

  // Handle direct booking link (stable callback)
  const handleDirectBookingLink = useCallback(async (bookingId: string) => {
    try {
      console.log('Handling direct booking link for ID:', bookingId);
      
      // Find the booking in the already loaded bookings
      let targetBooking: DashboardBooking | undefined = bookings.find(b => b.id === bookingId);
      
      // Defensive null check
      if (!targetBooking) {
        const { data, error } = await supabase
          .from('bookings')
          .select(`  
            *,
            property:properties(
              id, 
              title, 
              venue_id, 
              images, 
              address_street, 
              address_city, 
              address_state,
              tax_rate,
              fee_type,
              fee_value,
              fee_description,
              profiles:profiles!properties_venue_id_fkey(
                id,
                full_name,
                email,
                phone
              )
            ),
            proposal:proposals(
              id,
              inquiry_id,
              price_total,
              currency,
              message
            ),
            customer:profiles!bookings_user_id_fkey(
              id,
              full_name,
              email,
              phone
            )
          `)
          .eq('id', bookingId)
          .single();
          
        if (error) {
          console.error('Error fetching booking:', error);
          return;
        }
        
        if (data) {
          targetBooking = toDashboardBooking(data as any);

          if (targetBooking) {
            try {
              const paymentBreakdown: PaymentBreakdown = {
                base_price: 0,
                taxes: 0,
                fees: 0,
                fee_description: (targetBooking.property)?.fee_description ?? null,
              };

              const priceTotal = Number(targetBooking.price_total) || 0;
              if (priceTotal > 0) {
                const property = targetBooking.property as DashboardProperty | null;
                if (property) {
                  const startDate = new Date(targetBooking.start_date);
                  const endDate = new Date(targetBooking.end_date);
                  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

                  const pricePerDay = Number(property.price_per_day) || 0;
                  if (pricePerDay > 0) {
                    paymentBreakdown.base_price = pricePerDay * diffDays;
                  } else {
                    paymentBreakdown.base_price = priceTotal;
                  }

                  const taxRate = Number(property.tax_rate) || 0;
                  if (taxRate > 0) {
                    paymentBreakdown.taxes = paymentBreakdown.base_price * (taxRate / 100);
                  }

                  const feeValue = Number(property.fee_value ?? 0) || 0;
                  const feeType = property.fee_type ?? undefined;
                  if (feeValue > 0) {
                    if (feeType === 'percentage') {
                      paymentBreakdown.fees = paymentBreakdown.base_price * (feeValue / 100);
                    } else {
                      paymentBreakdown.fees = feeValue;
                    }
                    paymentBreakdown.fee_description = property.fee_description ?? null;
                  }

                  const calculatedTotal = paymentBreakdown.base_price + paymentBreakdown.taxes + paymentBreakdown.fees;
                  if (Math.abs(calculatedTotal - priceTotal) > 0.01) {
                    paymentBreakdown.base_price = priceTotal - paymentBreakdown.taxes - paymentBreakdown.fees;
                  }
                }
              }

              targetBooking = { ...(targetBooking as DashboardBooking), payment_breakdown: paymentBreakdown };
            } catch (e) {
              console.warn('Failed to compute payment_breakdown for direct booking load:', e);
            }

            // Fetch inquiry data if needed
            if (targetBooking && targetBooking.proposal?.inquiry_id) {
              const { data: inquiry }: any = await (supabase as any)
                .from('inquiries')
                .select('id, message, created_at')
                .eq('id', targetBooking.proposal.inquiry_id)
                .maybeSingle();
                
              if (inquiry) {
                targetBooking.inquiry = { id: inquiry.id, message: inquiry.message ?? null, created_at: inquiry.created_at };
              }
            }
          }
        }
      }
      
      if (targetBooking) {
        setSelectedBooking(targetBooking);
        setShowBookingDetails(true);
      } else {
        if (typeof setError === 'function') setError('Booking not found.');
      }
    } catch (err) {
      console.error('Error handling direct booking link:', err);
    }
  }, [bookings]);

  // B1) Initial data load (decoupled from direct-link handling to avoid effect churn)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      // Wait for an auth session to ensure Authorization header is present
      const timeoutMs = 4000;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const { data: sessionData } = await (supabase as any).auth.getSession();
        if (sessionData?.session?.access_token) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!cancelled) {
        await loadDashboardData();
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, loadDashboardData]);

  // B2) Handle direct booking link separately so changes in bookings don't retrigger loads
  useEffect(() => {
    if (!user?.id || !initialBookingId) return;
    // Intentionally omit handleDirectBookingLink from deps to keep this effect stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    handleDirectBookingLink(initialBookingId);
  }, [user?.id, initialBookingId]);

  // C) Realtime subscriptions to bookings (debounced reload). We subscribe to both user_id and property_id scopes
  const reloadTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;

    const scheduleReload = (payload: any) => {
      console.log('Booking updated via real-time subscription:', payload);
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => {
        loadDashboardData();
      }, 500);
    };

    const chUser = supabase.channel('dashboard-bookings-user')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${user.id}`,
      }, scheduleReload)
      .subscribe();

    // For venue owners, also subscribe to bookings on owned properties
    let chProps: ReturnType<typeof supabase.channel> | null = null;
    if (ownedPropertyIds.length > 0) {
      const quoted = ownedPropertyIds.map(id => `"${id}"`).join(',');
      chProps = supabase.channel('dashboard-bookings-props')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `property_id=in.(${quoted})`,
        }, scheduleReload)
        .subscribe();
    }

    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      chUser.unsubscribe();
      if (chProps) chProps.unsubscribe();
    };
  }, [user?.id, loadDashboardData, ownedPropertyIds]);

  

  

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  // Manual function to mark payment as completed (workaround for webhook issues)
  const markPaymentCompleted = async (bookingId: string) => {
    // Add null check for user
    if (!user) {
      console.warn('Cannot mark payment completed: user is null');
      return;
    }

    try {
      setLoading(true);
      const { error } = await (supabase as any)
        .from('bookings')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('user_id', user.id); // Security check

      if (error) throw error;
      
      // Also update any related inquiry status
      const { data: booking }: any = await (supabase as any)
        .from('bookings')
        .select('proposal_id')
        .eq('id', bookingId)
        .single();

      if (booking?.proposal_id) {
        const { data: proposal }: any = await (supabase as any)
          .from('proposals')
          .select('inquiry_id')
          .eq('id', booking.proposal_id)
          .single();

        if (proposal?.inquiry_id) {
          await (supabase as any)
            .from('inquiries')
            .update({
              status: 'payment_completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', proposal.inquiry_id);
        }
      }
      // Reload data to show updated status
      await loadDashboardData();
      setLoading(false);
    } catch (error) {
      console.error('Error updating payment status:', error);
      setLoading(false);
    }
  };

  // Removed getRecentActivity (unused)

  // Removed getActivityMessage (unused)

  const { upcoming: upcomingBookingCount, completed: completedBookingCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let upcoming = 0;
    let completed = 0;

    bookings.forEach((booking) => {
      const isBooker = booking.user_id === user?.id;
      const isVenueOwner = booking.property?.venue_id === user?.id;
      const isOrgMember = booking.property?.organization_id && userOrgIds.includes(booking.property.organization_id);
      const isUserRelated = isBooker || isVenueOwner || isOrgMember;

      if (!isUserRelated) return;

      const isConfirmed = booking.status === 'confirmed' || booking.status === 'canceled';
      if (!isConfirmed) return;

      const bookingStartDate = new Date(booking.start_date);
      bookingStartDate.setHours(0, 0, 0, 0);
      const bookingEndDate = new Date(booking.end_date);
      bookingEndDate.setHours(0, 0, 0, 0);

      const isOngoing = bookingStartDate <= today && today <= bookingEndDate && booking.status !== 'canceled';
      const isFuture = bookingStartDate > today && booking.status !== 'canceled';
      const isUpcoming = isOngoing || isFuture;
      const isCompleted = bookingEndDate < today || booking.status === 'canceled';

      if (isUpcoming) {
        upcoming += 1;
      } else if (isCompleted) {
        completed += 1;
      }
    });

    return { upcoming, completed };
  }, [bookings, user?.id, userOrgIds]);

  // Filter bookings to include both user bookings and venue bookings
  const getUserRelatedBookings = () => {
    // Create a date object for today at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return bookings.filter(booking => {
      // Filter by user role (booker or venue owner)
      const isBooker = booking.user_id === user?.id;
      const isVenueOwner = booking.property?.venue_id === user?.id;
      const isOrgMember = booking.property?.organization_id && userOrgIds.includes(booking.property.organization_id);
      const isUserRelated = isBooker || isVenueOwner || isOrgMember;
      
      // Show confirmed and canceled bookings
      // Use booking.status rather than payment_status to avoid missing confirmed rows for org members
      const isConfirmed = booking.status === 'confirmed' || booking.status === 'canceled';
      
      // Parse start and end dates at midnight
      const bookingStartDate = new Date(booking.start_date);
      bookingStartDate.setHours(0, 0, 0, 0);
      const bookingEndDate = new Date(booking.end_date);
      bookingEndDate.setHours(0, 0, 0, 0);

      // A booking is upcoming if today is between start_date and end_date (inclusive), or start_date is in the future, and it's not canceled
      const isOngoing = bookingStartDate <= today && today <= bookingEndDate && booking.status !== 'canceled';
      const isFuture = bookingStartDate > today && booking.status !== 'canceled';
      const isUpcoming = (isOngoing || isFuture);

      // A booking is completed if its end date is in the past OR it's canceled
      const isCompleted = bookingEndDate < today || booking.status === 'canceled';

      return isUserRelated && isConfirmed && 
        (bookingViewMode === 'upcoming' ? isUpcoming : isCompleted);
    });
  };

  // Determine if user is the booker or the venue owner for a booking
  const getBookingUserRole = (booking: any) => {
    const isBooker = booking.user_id === user?.id;
    const isVenueOwner = booking.property?.venue_id === user?.id;
    
    // If user is both booker and venue owner (self-booking), prioritize venue owner
    if (isVenueOwner) {
      return 'venue_owner';
    } else if (isBooker) {
      return 'booker';
    }
    return null;
  };

  // Clear URL parameter when closing booking details
  const handleCloseBookingDetails = () => {
    setShowBookingDetails(false);
    setSelectedBooking(null);
    
    // Remove the booking parameter from URL without reloading the page
    const url = new URL(window.location.href);
    url.searchParams.delete('booking');
    window.history.pushState({}, '', url);
    
    // Reset the initial booking ID
    setInitialBookingId(null);
  };

  // Open booking details dialog
  const openBookingDetails = (booking: any) => {
    setSelectedBooking(booking);
    setBookingDetailsKey(prev => prev + 1); // Force re-render of BookingDetails
    setShowBookingDetails(true);
    
    // Update URL with booking ID without reloading the page
    const url = new URL(window.location.href);
    url.searchParams.set('booking', booking.id);
    window.history.pushState({}, '', url);
  };

  // Generate calendar event data
  const handleAddToCalendar = async (booking: any, type: 'google' | 'apple' | 'outlook') => {
    if (!booking) return;
    
    const eventTitle = `Space booking at ${booking.property?.title || 'Property'}`;
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    
    // Use shared formatter for address description
    const location = booking.property ? formatFullAddress(booking.property) : 'Unknown location';
    
    // Create a specific description with booking ID
    const description = `Booking details: ${window.location.origin}/dashboard?booking=${booking.id}`;
    
    if (type === 'google') {
      // Google Calendar link
      const googleUrl = generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'google', true);
      if (googleUrl && typeof googleUrl === 'string') {
        window.open(googleUrl, '_blank');
      } else {
        console.error('Failed to generate Google Calendar URL');
      }
    } else if (type === 'apple' || type === 'outlook') {
      // Generate ICS content
      const icsContent = generateCalendarEvent(eventTitle, startDate, endDate, location, description, 'ics', true);
      
      if (icsContent && typeof icsContent === 'string') {
        try {
          // Create a Blob with the ICS content
          const blob = new Blob([icsContent], { 
            type: 'text/calendar;charset=utf-8',
            endings: 'native'
          });
          
          // Use FileSaver.js to trigger the download
          saveAs(blob, `booking-${booking.id.substring(0, 8)}.ics`);
          
        } catch (error) {
          console.error('Error creating download:', error);
          
          // Fallback to data URL method if FileSaver fails
          try {
            const dataStr = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', `booking-${booking.id.substring(0, 8)}.ics`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
          } catch (fallbackError) {
            console.error('Fallback download method failed:', fallbackError);
            
            // Last resort: open in new window
            const win = window.open('', '_blank');
            if (win) {
              win.document.write(`<pre>${icsContent}</pre>`);
              win.document.close();
            }
          }
        }
      } else {
        console.error('Failed to generate valid ICS file content');
      }
    }
    
    // Close dropdown after selection
    setCalendarDropdownBookingId(null);
  };

  // Early return if user is null to prevent rendering with null user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  
  const userRelatedBookings = getUserRelatedBookings();

  if (bookingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  // Note: We deliberately avoid early-returning on empty upcoming bookings so the
  // dashboard layout renders, and rely on the section-level empty state below.

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Light-account password banner */}
        {user && passwordNeeded && (
          <div className="mb-6 rounded-xl border-2 border-blue-300 bg-blue-50 p-4 flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-blue-900">Secure your account</div>
              <div className="text-sm text-blue-800">Create a password to fully secure your account. You can continue using magic links, but a password unlocks standard sign-in.</div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="primary" onClick={() => navigate('/set-password')}>
                Create password
              </Button>
            </div>
          </div>
        )}
        {/* Removed legacy finish inquiry banner */}
        {notice && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm whitespace-pre-line">{notice}</p>
                {noticePropertyId && (
                  <p className="mt-2 text-sm">
                    <a className="text-maroon-700 underline" href={`/property/${noticePropertyId}`}>
                      View your listing
                    </a>
                  </p>
                )}
              </div>
              <button
                onClick={() => setNotice(null)}
                className="text-sm text-amber-700 hover:text-amber-900"
                aria-label="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex items-center">
            <div className="flex items-center">
              <LayoutDashboard className="h-8 w-8 text-maroon-600 mr-3" />
              <h1 className="text-4xl font-bold text-maroon-800 font-display" id="dashboard-title">
                Dashboard
              </h1>
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              isLoading={refreshing}
              disabled={refreshing}
              className="ml-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-maroon-800">
                <Building2 className="h-5 w-5 mr-2" />
                Properties
              </CardTitle>
              <CardDescription className="flex items-center gap-3 relative">
                <a 
                  href="#your-properties" 
                  className="hover:text-maroon-600 transition-colors"
                >
                  {properties.length} listed {properties.length === 1 ? 'property' : 'properties'}
                </a>
                {/* Share Listings menu */}
                <div className="ml-2">
                  <Tooltip content={<div className="max-w-xs whitespace-normal break-words">
                    Copy a link to a page displaying only your listings. You have the option for a page with only your listings,
                    one that also displays the map, or one that displays the filter options.
                  </div>}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowShareMenu((s) => !s)}
                      disabled={!preferredOrgId}
                    >
                      Share Listings
                    </Button>
                  </Tooltip>
                  {showShareMenu && (
                    <div className="absolute z-20 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => copyShareLink('full')}
                        >
                          Listings alone
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => copyShareLink('map')}
                        >
                          Listings + Map
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => copyShareLink('filters')}
                        >
                          Listings + Filters
                        </button>
                      </div>
                    </div>
                  )}
                  {shareCopied && (
                    <div
                      className="absolute z-20 mt-2 px-3 py-2 text-sm text-white bg-green-600 rounded shadow transition-opacity duration-300"
                      role="status"
                      aria-live="polite"
                    >
                      The link has been copied to your clipboard
                    </div>
                  )}
                </div>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between w-full text-maroon-800">
                <span className="flex items-center">
                  <MessageCircleQuestion className="h-5 w-5 mr-2" />
                  Active Inquiries
                </span>
                {isVenueOwnerOperatorMember && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full"
                    aria-label="Inquiry Settings"
                    title="Inquiry Settings"
                    onClick={() => navigate('/inquiry-settings')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                <a href="#open-inquiries-section" className="hover:text-maroon-600 transition-colors">
                  {activeInquiriesCount} active {activeInquiriesCount === 1 ? 'inquiry' : 'inquiries'}
                </a>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center text-maroon-800">
                  <Calendar className="h-5 w-5 mr-2" />
                  Bookings
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0 text-maroon-600 hover:text-maroon-700 rounded-full"
                  aria-label="Export payment data"
                  onClick={() => navigate('/export-payment-data')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                <a 
                  href="#your-bookings" 
                  className="hover:text-maroon-600 transition-colors"
                >
                  {upcomingBookingCount} upcoming · {completedBookingCount} completed
                </a>
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="space-y-6">
          {openInquiries.length > 0 && (
            <section>
              <h2 id="open-inquiries-section" className="text-2xl font-bold text-maroon-800 mb-4 font-display">
                Open Inquiries
              </h2>
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="space-y-4">
                  {openInquiries.map((inquiry) => {
                    // Determine if user is initiator or responder
                    const isInitiator = inquiry.user_id === user?.id;
                    const isResponder = inquiry.property?.venue_id === user?.id;
                    
                    // For proposals, the guest should be able to make payment, not the inquiry initiator
                    // Check if this is a proposal and if the current user is the guest (via inquiry.user)
                    const isGuestInProposal = inquiry.status === 'converted_to_proposal' && 
                      inquiry.user_id === user?.id;
                    
                    const shouldShowPaymentButton = inquiry.status === 'converted_to_proposal' && 
                      (isGuestInProposal || (!isInitiator && !isResponder));
                    
                    // Find related booking if any
                    const relatedBooking = bookings.find(booking => 
                      booking?.proposal?.inquiry_id === inquiry.id
                    );
                    
                    // Determine status label and color
                    let statusLabel = '';
                    let statusColor = '';
                    
                    if (relatedBooking && relatedBooking.payment_status === 'paid') {
                      statusLabel = 'Payment completed';
                      statusColor = 'bg-green-100 text-green-700';
                    } else if (relatedBooking && relatedBooking.payment_status === 'pending') {
                      statusLabel = 'Payment Pending';
                      statusColor = 'bg-amber-100 text-amber-700';
                    } else if (inquiry.status === 'pending') {
                      statusLabel = 'New Inquiry';
                      statusColor = 'bg-blue-100 text-blue-700';
                    } else if (inquiry.status === 'responded') {
                      statusLabel = 'Inquiry in Progress';
                      statusColor = 'bg-purple-100 text-purple-700';
                    } else if (inquiry.status === 'converted_to_proposal') {
                      statusLabel = 'Payment Requested';
                      statusColor = 'bg-amber-100 text-amber-700';
                    }
                    
                    return (
                      <div 
                        key={inquiry.id}
                        className="flex items-start space-x-4 py-4 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex-shrink-0">
                          <MessageCircleQuestion className="h-6 w-6 text-maroon-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="text-xs text-maroon-500">
                                Inquiry opened: {formatDate(inquiry.created_at)}
                              </p>
                              
                              {inquiry.start_date && inquiry.end_date && (
                                <div className="relative group">
                                  <div className="flex items-center">
                                    <Calendar className="h-3 w-3 text-maroon-500 cursor-help" />
                                  </div>
                                  <div className="absolute left-0 -top-1 transform -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 min-w-[200px]">
                                      <p className="font-semibold">Booking Request:</p>
                                      <p>{formatDate(inquiry.start_date)} to {formatDate(inquiry.end_date)}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            
                            <p className="text-sm font-medium text-maroon-900">
                              {inquiry.property?.title}
                            </p>
                            {(() => {
                              const orgName = (inquiry as any)?.property?.organization?.name as string | undefined;
                              return orgName ? (
                                <p className="text-xs text-maroon-600">{orgName}</p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
                          {shouldShowPaymentButton && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                if (relatedBooking?.id) {
                                  navigate(`/payment/${relatedBooking.id}`);
                                } else {
                                  console.error('No related booking found for this inquiry');
                                  setError('No payment information found for this inquiry. Please try again later or contact support.');
                                }
                              }}
                              className="w-full sm:w-auto"
                            >
                              Make Payment
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/messages?inquiry=${inquiry.id}`)}
                            className="w-full sm:w-auto"
                          >
                            View Message Thread
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Bookings Section */}
          {userRelatedBookings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 id="your-bookings" className="text-2xl font-bold text-maroon-800 font-display">
                Your Bookings
              </h2>
              
              {/* Toggle between upcoming and completed bookings */}
              <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <Button
                  variant={bookingViewMode === 'upcoming' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`rounded-md ${bookingViewMode !== 'upcoming' ? 'text-gray-600 hover:text-maroon-600' : ''}`}
                  onClick={() => setBookingViewMode('upcoming')}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Upcoming
                </Button>
                <Button
                  variant={bookingViewMode === 'completed' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`rounded-md ${bookingViewMode !== 'completed' ? 'text-gray-600 hover:text-maroon-600' : ''}`}
                  onClick={() => setBookingViewMode('completed')}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Completed
                </Button>
              </div>
            </div>
            
            {/* Debug logs for bookings */}
            <div style={{display: 'none'}}>
              {/* These do not render, but are here for dev inspection */}
              {/* {JSON.stringify(bookings)} */}
              {/* {JSON.stringify(userRelatedBookings)} */}
              {/* {JSON.stringify(upcomingBookings)} */}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userRelatedBookings.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-maroon-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-maroon-800 mb-2">No Upcoming Bookings</h3>
                </div>
              ) : (
                userRelatedBookings
                  .slice(0, 6)
                  .map((booking) => {
                  const userRole = getBookingUserRole(booking);
                  return (
                    <Card key={booking.id}>
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl">
                        <img
                          src={booking.property?.images?.[0] || '/placeholder-image.jpg'}
                          alt={booking.property?.title || 'Property'}
                          className="w-full h-full object-cover"
                        />
                        {/* Role indicator icons */}
                        {userRole === 'booker' && (
                          <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md">
                            <MapPin className="h-4 w-4 text-maroon-600" />
                          </div>
                        )}
                        {userRole === 'venue_owner' && (
                          <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md">
                            <Home className="h-4 w-4 text-maroon-600" />
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <CardTitle className="text-maroon-800">{booking.property?.title || 'No title'}</CardTitle>
                        {(() => {
                          const orgName = booking.property?.organization?.name;
                          return orgName ? (
                            <div className="text-xs text-maroon-600">{orgName}</div>
                          ) : null;
                        })()}
                        <CardDescription>
                          {booking.property ? formatCityState(booking.property) : 'Unknown City'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {/* Booking dates with Add to Calendar button */}
                          <div className="flex items-center justify-between text-sm text-maroon-500 mb-3">
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>{formatDate(booking.start_date)} - {formatDate(booking.end_date)}</span>
                            </div>
                            
                            {/* Add to Calendar Button */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center text-maroon-600 hover:text-maroon-800 p-1 h-auto"
                                onClick={() => setCalendarDropdownBookingId(calendarDropdownBookingId === booking.id ? null : booking.id)}
                                title="Add to Calendar"
                              >
                                <CalendarPlus className="h-4 w-4" />
                                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${calendarDropdownBookingId === booking.id ? 'rotate-180' : ''}`} />
                              </Button>
                              
                              {/* Calendar Dropdown */}
                              {calendarDropdownBookingId === booking.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg py-1 z-10 border border-gray-200">
                                  <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => handleAddToCalendar(booking, 'google')}
                                  >
                                    <span className="w-5 h-5 mr-2 flex items-center justify-center text-blue-500">G</span>
                                    Google Calendar
                                  </button>
                                  <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => handleAddToCalendar(booking, 'apple')}
                                  >
                                    <span className="w-5 h-5 mr-2 flex items-center justify-center text-gray-800">
                                      <Calendar className="h-4 w-4" />
                                    </span>
                                    Apple Calendar
                                  </button>
                                  <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                    onClick={() => handleAddToCalendar(booking, 'outlook')}
                                  >
                                    <span className="w-5 h-5 mr-2 flex items-center justify-center text-blue-600">O</span>
                                    Outlook
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Price and Status - Moved below date display */}
                          <div className="flex justify-between items-center mb-4">
                            <div className="text-maroon-600">
                              <span className="font-semibold">
                                {booking.status === 'canceled' ? 'Canceled' : formatCurrency(booking.price_total ?? 0, booking.proposal?.currency ?? 'USD')}
                              </span>
                            </div>
                            <div className="flex items-center">
                              {booking.status === 'canceled' ? (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  Canceled
                                </span>
                              ) : booking.payment_status === 'paid' ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                  Confirmed
                                </span>
                              ) : null}
                              {booking.payment_status === 'pending' && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                  Payment Pending
                                </span>
                              )}
                              {booking.payment_status === 'failed' && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  Payment Failed
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Show Booking Details button for all bookings */}
                          <Button
                            variant={booking.status === 'canceled' ? 'ghost' : 'outline'}
                            className="w-full"
                            onClick={() => openBookingDetails(booking)}
                          >
                            {booking.status === 'canceled' ? (
                              <>
                                <FileText className="h-4 w-4 mr-2 text-red-500" />
                                <span className="text-red-500">Booking Details</span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 mr-2" />
                                Booking Details
                              </>
                            )}
                          </Button>
                          
                          {/* Conditional Action Buttons - only show for customer bookings */}
                          {userRole === 'booker' && booking.payment_status === 'pending' && (
                            <>
                              <Button
                                variant="danger"
                                className="w-full"
                                onClick={() => navigate(`/payment/${booking.id}`)}
                              >
                                Make Payment
                              </Button>
                              
                              {/* Temporary manual fix button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => markPaymentCompleted(booking.id)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as Paid (if paid in Stripe)
                              </Button>
                            </>
                          )}
                          
                          {userRole === 'booker' && booking.payment_status === 'failed' && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => navigate(`/payment/${booking.id}`)}
                            >
                              Retry Payment
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
          )}

          {/* Properties */}
          <section>
            <h2 id="your-properties" className="text-2xl font-bold text-maroon-800 mb-4 font-display">
              Your Properties
            </h2>

            {properties.length > 0 && (
              <nav className="mb-4 flex items-center justify-between flex-wrap gap-3" aria-label="Dashboard property pagination">
                <span className="text-sm text-maroon-700">
                  Showing {propertyRangeStart + 1}
                  –{propertyRangeEnd} of {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-maroon-700">
                    Page {propertyPage} of {propertyTotalPages}
                  </span>
                  {propertyHasPagination && (
                    <>
                      <button
                        type="button"
                        onClick={handlePropertyPreviousPage}
                        disabled={propertyPage === 1}
                        className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${propertyPage === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={handlePropertyNextPage}
                        disabled={propertyPage === propertyTotalPages}
                        className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${propertyPage === propertyTotalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                      >
                        Next
                      </button>
                    </>
                  )}
                </div>
              </nav>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedDashboardProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  showDraftLabel={property.published === false}
                  mode="dashboard"
                  onManageProperty={(id) => navigate(`/properties/${id}`)}
                />
              ))}
              
              {/* Add Property Card */}
              <Card className="flex flex-col items-center justify-center p-6 border-2 border-dashed">
                <Building2 className="h-12 w-12 text-maroon-400 mb-4" />
                <h3 className="text-lg font-semibold text-maroon-800 mb-2">
                  List a Property
                </h3>
                <p className="text-maroon-600 text-center mb-4">
                  Add a property to your portfolio
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/list-property')}
                >
                  Add Property
                </Button>
              </Card>
            </div>

            {propertyHasPagination && properties.length > 0 && (
              <nav className="mt-6 flex items-center justify-between flex-wrap gap-3" aria-label="Dashboard property pagination footer">
                <span className="text-sm text-maroon-700">
                  Showing {propertyRangeStart + 1}
                  –{propertyRangeEnd} of {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-maroon-700">
                    Page {propertyPage} of {propertyTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={handlePropertyPreviousPage}
                    disabled={propertyPage === 1}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${propertyPage === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handlePropertyNextPage}
                    disabled={propertyPage === propertyTotalPages}
                    className={`px-3 py-2 rounded-full border border-maroon-200 text-sm font-medium transition-colors ${propertyPage === propertyTotalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-maroon-700 hover:bg-maroon-100'}`}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </section>
        </div>
      </div>
      
      {/* Debug section - only visible in development */}

      {/* Booking Details Dialog */}
      {selectedBooking && (
        <Dialog 
          key={bookingDetailsKey}
          open={showBookingDetails}
          onClose={handleCloseBookingDetails}
          title="Booking Details"
          size="3xl" // Use the new wider size (50% wider than lg)
        >
          <BookingDetails 
            booking={selectedBooking} 
            onClose={handleCloseBookingDetails} 
            onBookingUpdated={loadDashboardData}
          />
        </Dialog>
      )}
    </div>
  );
};

export default DashboardPage;