import React from 'react';
import { DayPilot, DayPilotMonth, DayPilotCalendar } from '@daypilot/daypilot-lite-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Dialog } from '../components/ui/dialog';
import BookingDetails from '../components/booking/BookingDetails';
import { useBookingDetails } from '../lib/useBookingDetails';

interface CalendarEvent {
  id: string;
  start: string;
  end: string;
  text: string;
  backColor: string;
  borderColor: string;
  fontColor: string;
  moveDisabled: boolean;
  resizeDisabled: boolean;
}

type CalendarView = 'month' | 'week' | 'day';

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Load persisted state from localStorage on mount
  const [currentDate, setCurrentDate] = React.useState(() => {
    try {
      const saved = localStorage.getItem('calendar-currentDate');
      if (saved && saved.trim()) {
        // Parse the sortable string format: "2026-01-15T00:00:00"
        const dateStr = saved.trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return new DayPilot.Date(parsed);
        }
      }
      return DayPilot.Date.today();
    } catch {
      return DayPilot.Date.today();
    }
  });
  const [viewType, setViewType] = React.useState<CalendarView>(() => {
    const saved = localStorage.getItem('calendar-viewType');
    return (saved as CalendarView) || 'day';
  });
  const [selectedBookingId, setSelectedBookingId] = React.useState<string | null>(null);
  const [showBookingDetails, setShowBookingDetails] = React.useState(false);
  const [bookingDetailsKey, setBookingDetailsKey] = React.useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = React.useState<{
    start: DayPilot.Date;
    end: DayPilot.Date;
  } | null>(null);

  // Persist view changes to localStorage
  const handleViewChange = (view: CalendarView) => {
    setViewType(view);
    localStorage.setItem('calendar-viewType', view);
  };

  const handleDateChange = (date: DayPilot.Date) => {
    setCurrentDate(date);
    localStorage.setItem('calendar-currentDate', date.toStringSortable());
  };

  const { booking: selectedBooking } = useBookingDetails(selectedBookingId);

  const openBookingDetailsById = React.useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    setBookingDetailsKey((k) => k + 1);
    setShowBookingDetails(true);
  }, []);

  const handleCloseBookingDetails = React.useCallback(() => {
    setShowBookingDetails(false);
    setSelectedBookingId(null);
  }, []);

  const handleTimeRangeSelected = async (args: any) => {
    const start = args.start;
    const end = args.end;

    // Set the selected time range
    setSelectedTimeRange({ start, end });
  };

  const handleOpenProposal = () => {
    if (!selectedTimeRange) return;
    
    // Format dates for URL
    const startDate = selectedTimeRange.start.toStringSortable().split('T')[0];
    const endDate = selectedTimeRange.end.toStringSortable().split('T')[0];
    
    // Extract time parts from the sortable string
    const startTimeStr = selectedTimeRange.start.toStringSortable().split('T')[1];
    const endTimeStr = selectedTimeRange.end.toStringSortable().split('T')[1];
    
    // Include times if they're different from midnight (indicating time selection)
    const startTime = startTimeStr && startTimeStr !== '00:00:00' 
      ? startTimeStr.substring(0, 5) 
      : undefined;
    const endTime = endTimeStr && endTimeStr !== '00:00:00' 
      ? endTimeStr.substring(0, 5) 
      : undefined;
    
    // Build query parameters
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);
    
    // Navigate to OpenProposalPage with pre-populated dates
    navigate(`/open-proposal?${params.toString()}`);
    
    // Clear selection
    setSelectedTimeRange(null);
  };

  const handleClearSelection = () => {
    setSelectedTimeRange(null);
  };

  const handleEventClick = React.useCallback((args: any) => {
    try {
      const eventId: string = args?.e?.id?.() ?? args?.e?.data?.id;
      if (!eventId) return;

      if (eventId.startsWith('booking-')) {
        const bookingId = eventId.replace('booking-', '');
        void openBookingDetailsById(bookingId);
        return;
      }

      if (eventId.startsWith('inquiry-')) {
        const inquiryId = eventId.replace('inquiry-', '');
        navigate(`/messages?inquiry=${inquiryId}`);
        return;
      }

      if (eventId.startsWith('proposal-')) {
        const proposalId = eventId.replace('proposal-', '');
        // Navigate to proposal details or messages
        navigate(`/messages?proposal=${proposalId}`);
        return;
      }
    } catch (e) {
      console.warn('Failed to handle calendar event click:', e);
    }
  }, [navigate, openBookingDetailsById]);

  const getMonthConfig = (): DayPilot.MonthConfig => {
    return {
      startDate: currentDate.toString('yyyy-MM-dd'),
      cellHeight: 80,
      headerHeight: 30,
      events: events,
      onEventClick: handleEventClick,
      onTimeRangeSelected: handleTimeRangeSelected,
    };
  };

  const getWeekConfig = (): DayPilot.CalendarConfig => {
    return {
      startDate: currentDate,
      durationBarVisible: false,
      timeFormat: 'Clock12Hours' as const,
      headerDateFormat: 'MMMM d, yyyy',
      heightSpec: 'Full' as const,
      viewType: 'Week',
      businessBeginsHour: 6,
      businessEndsHour: 22,
      events: events,
      onEventClick: handleEventClick,
      onTimeRangeSelected: handleTimeRangeSelected,
    };
  };

  const getDayConfig = (): DayPilot.CalendarConfig => {
    return {
      startDate: currentDate,
      durationBarVisible: false,
      timeFormat: 'Clock12Hours' as const,
      headerDateFormat: 'dddd, MMM d',
      heightSpec: 'Full' as const,
      viewType: 'Day',
      businessBeginsHour: 6,
      businessEndsHour: 22,
      events: events,
      onEventClick: handleEventClick,
      onTimeRangeSelected: handleTimeRangeSelected,
    };
  };

  React.useEffect(() => {
    if (!user) return;
    fetchUserEvents();
  }, [user, currentDate, viewType]);

  const fetchUserEvents = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      let startDate: DayPilot.Date;
      let endDate: DayPilot.Date;
      
      // Calculate date range based on view type
      if (viewType === 'month') {
        // For month view, use the full month range
        startDate = currentDate.firstDayOfMonth();
        endDate = currentDate.lastDayOfMonth();
      } else if (viewType === 'week') {
        startDate = currentDate.firstDayOfWeek();
        endDate = startDate.addDays(6);
      } else {
        startDate = currentDate;
        endDate = currentDate;
      }
      
      const startDateStr = startDate.toString('yyyy-MM-dd');
      const endDateStr = endDate.toString('yyyy-MM-dd');
      
      // Fetch user's inquiries for the current view period
      console.log('Fetching inquiries for date range:', startDateStr, 'to', endDateStr);
      console.log('Current user ID:', user.id);
      
      // First, try to fetch all inquiries to see if any exist
      console.log('Starting debug query for all inquiries...');
      let allInquiriesDebug: any[] | null = null;
      let allInquiriesError: any = null;
      
      try {
        const result = await supabase
          .from('inquiries')
          .select('*')
          .limit(10);
        
        allInquiriesDebug = result.data;
        allInquiriesError = result.error;
        console.log('Debug query completed. Data:', allInquiriesDebug, 'Error:', allInquiriesError);
      } catch (err) {
        console.log('Debug query threw exception:', err);
        throw err;
      }
      
      console.log('All inquiries in database (first 10):', allInquiriesDebug, 'Error:', allInquiriesError);
      const allInquiries = allInquiriesDebug || [];
      
      // Check if any inquiry matches the expected dates and show its user_id
      if (allInquiriesDebug && allInquiriesDebug.length > 0) {
        const targetInquiry = allInquiriesDebug.find(inq => {
          const start = new Date(inq.start_date);
          const end = inq.end_date ? new Date(inq.end_date) : start;
          const targetStart = new Date('2025-12-23');
          const targetEnd = new Date('2025-12-25');
          return start.toDateString() === targetStart.toDateString() && 
                 end.toDateString() === targetEnd.toDateString();
        });
        
        if (targetInquiry) {
          console.log('Found target inquiry:', targetInquiry);
          console.log('Target inquiry user_id:', targetInquiry.user_id);
          console.log('Current user ID:', user.id);
          console.log('User ID matches:', targetInquiry.user_id === user.id);
        } else {
          console.log('No inquiry found for 12/23-2025 to 12/25/2025');
          console.log('Available inquiries with dates:');
          allInquiriesDebug.forEach(inq => {
            console.log(`- ${inq.id}: ${inq.start_date} to ${inq.end_date} (user_id: ${inq.user_id})`);
          });
        }
      }

      // Now fetch user's inquiries (both as initiator and venue owner) using separate queries
      const { data: initiatorInquiries, error: initiatorError } = await supabase
        .from('inquiries')
        .select(`
          *,
          properties!inner(title),
          user:profiles!inquiries_user_id_fkey(
            id,
            full_name,
            primary_organization_id,
            email
          )
        `)
        .eq('user_id', user.id);

      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('venue_id', user.id);

      const propertyIds = properties?.map(p => p.id) || [];

      let venueOwnerInquiries: any[] = [];
      if (propertyIds.length > 0) {
        const { data: venueInquiries, error: venueError } = await supabase
          .from('inquiries')
          .select(`
            *,
            properties!inner(title),
            user:profiles!inquiries_user_id_fkey(
              id,
              full_name,
              primary_organization_id,
              email
            )
          `)
          .in('property_id', propertyIds);
        
        if (!venueError) {
          venueOwnerInquiries = venueInquiries || [];
        }
      }

      // Combine both sets of inquiries and remove duplicates
      const allInquiriesCombined = [...(initiatorInquiries || []), ...venueOwnerInquiries];
      let inquiries = allInquiriesCombined.filter((inquiry, index, self) => 
        index === self.findIndex(i => i.id === inquiry.id)
      );

      // Fallback: if no inquiries returned via standard queries, use debug data filtered by property ownership
      if ((!inquiries || inquiries.length === 0) && allInquiries.length > 0) {
        const fallbackFiltered = propertyIds.length > 0
          ? allInquiries.filter(inquiry => propertyIds.includes(inquiry.property_id))
          : allInquiries;

        if (fallbackFiltered.length > 0) {
          inquiries = fallbackFiltered;
        }
      }

      // If inquiries came from the debug query (no joins), re-fetch them with the same embeds we use elsewhere.
      // This avoids direct `profiles` table reads which may be blocked by RLS.
      const inquiryIdsForEnrichment = [...new Set(inquiries.map(i => i.id).filter(Boolean))];
      const needsEnrichment = inquiries.some(inquiry => !inquiry.properties || !inquiry.user);
      if (needsEnrichment && inquiryIdsForEnrichment.length > 0) {
        const { data: enrichedInquiries, error: enrichedError } = await supabase
          .from('inquiries')
          .select(`
            *,
            properties!inner(title),
            user:profiles!inquiries_user_id_fkey(
              id,
              full_name,
              primary_organization_id,
              email
            )
          `)
          .in('id', inquiryIdsForEnrichment);

        if (!enrichedError && enrichedInquiries && enrichedInquiries.length > 0) {
          inquiries = enrichedInquiries;
        }
      }

      // Ensure fallback inquiries have property/profile details for display
      const inquiriesMissingProperties = inquiries.filter(inquiry => !inquiry.properties);
      const inquiriesMissingProfiles = inquiries.filter(inquiry => !inquiry.user);

      const missingPropertyIds = [...new Set(inquiriesMissingProperties.map(i => i.property_id).filter(Boolean))];
      const missingUserIds = [...new Set(inquiriesMissingProfiles.map(i => i.user_id).filter(Boolean))];

      let propertyMap: Record<string, { title: string }> = {};
      if (missingPropertyIds.length > 0) {
        const { data: fallbackProperties } = await supabase
          .from('properties')
          .select('id, title')
          .in('id', missingPropertyIds);
        propertyMap = (fallbackProperties || []).reduce((acc, property) => {
          acc[property.id] = { title: property.title };
          return acc;
        }, {} as Record<string, { title: string }>);
      }

      let profileMap: Record<string, { id: string; full_name: string | null; primary_organization_id: string | null; email: string | null }> = {};
      if (missingUserIds.length > 0) {
        const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, primary_organization_id, email')
          .in('id', missingUserIds);
        void fallbackProfilesError;
        profileMap = (fallbackProfiles || []).reduce((acc, profile) => {
          acc[profile.id] = {
            id: profile.id,
            full_name: profile.full_name,
            primary_organization_id: profile.primary_organization_id,
            email: profile.email,
          };
          return acc;
        }, {} as Record<string, { id: string; full_name: string | null; primary_organization_id: string | null; email: string | null }>);
      }

      inquiries = inquiries.map(inquiry => ({
        ...inquiry,
        properties: inquiry.properties || (inquiry.property_id ? propertyMap[inquiry.property_id] : undefined),
        user: inquiry.user || (inquiry.user_id ? profileMap[inquiry.user_id] : undefined),
      }));

      // Fetch counterparty display fields via RPC (RLS-safe) - will be done after proposals are fetched
      
      // Filter inquiries by date range in JavaScript
      const filteredInquiries = inquiries?.filter(inquiry => {
        const isHourly = inquiry.start_at && inquiry.end_at;
        let inquiryStart = isHourly ? new Date(inquiry.start_at!) : new Date(inquiry.start_date);
        let inquiryEnd = isHourly
          ? new Date(inquiry.end_at!)
          : inquiry.end_date
            ? new Date(inquiry.end_date)
            : new Date(inquiry.start_date);

        // For all-day events with same-day end, bump by a day so DayPilot renders them
        if (!isHourly && inquiryEnd.getTime() === inquiryStart.getTime()) {
          inquiryEnd = new Date(inquiryEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        const viewStart = new Date(startDateStr);
        const viewEnd = new Date(endDateStr);
        
        // Check if inquiry overlaps with view period
        return inquiryStart <= viewEnd && inquiryEnd >= viewStart;
      }) || [];

      // We'll suppress inquiries that have progressed to bookings after bookings are fetched.
      let filteredInquiriesWithoutBookings = filteredInquiries;

      // Fetch proposals that haven't become bookings yet
      const { data: userProposals, error: userProposalsError } = await supabase
        .from('proposals')
        .select(`
          *,
          inquiries!inner(
            *,
            properties!inner(title),
            user:profiles!inquiries_user_id_fkey(
              id,
              full_name,
              primary_organization_id,
              email
            )
          )
        `)
        .eq('inquiries.user_id', user.id);

      let venueOwnerProposals: any[] = [];
      if (propertyIds.length > 0) {
        const { data: venueProposalsData, error: venueProposalsError } = await supabase
          .from('proposals')
          .select(`
            *,
            inquiries!inner(
              *,
              properties!inner(title),
              user:profiles!inquiries_user_id_fkey(
                id,
                full_name,
                primary_organization_id,
                email
              )
            )
          `)
          .in('inquiries.property_id', propertyIds);
        
        if (!venueProposalsError) {
          venueOwnerProposals = venueProposalsData || [];
        }
      }

      // Combine both sets of proposals and remove duplicates
      const allProposalsCombined = [...(userProposals || []), ...venueOwnerProposals];
      let proposals = allProposalsCombined.filter((proposal, index, self) => 
        index === self.findIndex(p => p.id === proposal.id)
      );

      // Filter out proposals that have already become bookings
      // We'll do this after fetching bookings to avoid complex joins

      // Ensure proposals have user details for display (fallback like inquiries)
      const proposalsMissingUsers = proposals.filter(proposal => !proposal.inquiries.user);
      const missingProposalUserIds = [...new Set(proposalsMissingUsers.map(p => p.inquiries.user_id).filter(Boolean))];

      let proposalProfileMap: Record<string, { id: string; full_name: string | null; primary_organization_id: string | null; email: string | null }> = {};
      if (missingProposalUserIds.length > 0) {
        const { data: proposalProfiles, error: proposalProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, primary_organization_id, email')
          .in('id', missingProposalUserIds);
        void proposalProfilesError;
        proposalProfileMap = (proposalProfiles || []).reduce((acc, profile) => {
          acc[profile.id] = {
            id: profile.id,
            full_name: profile.full_name,
            primary_organization_id: profile.primary_organization_id,
            email: profile.email,
          };
          return acc;
        }, {} as Record<string, { id: string; full_name: string | null; primary_organization_id: string | null; email: string | null }>);
      }

      proposals = proposals.map(proposal => ({
        ...proposal,
        inquiries: {
          ...proposal.inquiries,
          user: proposal.inquiries.user || (proposal.inquiries.user_id ? proposalProfileMap[proposal.inquiries.user_id] : undefined),
        },
      }));

      // Fetch counterparty display fields via RPC (RLLS-safe) for both inquiries and proposals
      const allInquiryIds = [
        ...new Set(inquiries.map(inq => inq.id).filter(Boolean)),
        ...new Set(proposals.map(p => p.inquiries.id).filter(Boolean))
      ];
      let counterpartyByInquiryId: Record<string, { guest_full_name?: string | null; guest_organization_name?: string | null }> = {};
      if (allInquiryIds.length > 0) {
        const { data: counterpartyData, error: counterpartyError } = await (supabase as any)
          .rpc('get_inquiry_counterparty_display', { inquiry_ids: allInquiryIds });

        if (!counterpartyError && counterpartyData) {
          counterpartyByInquiryId = (counterpartyData as any[]).reduce((acc, row) => {
            acc[row.inquiry_id] = {
              guest_full_name: row.guest_full_name,
              guest_organization_name: row.guest_organization_name,
            };
            return acc;
          }, {} as Record<string, { guest_full_name?: string | null; guest_organization_name?: string | null }>);
        }
      }

      // Fetch organization names for all unique organization IDs from both inquiries and proposals
      const inquiryOrgIds = inquiries.map(inq => inq.user?.primary_organization_id).filter(Boolean);
      const proposalOrgIds = proposals.map(p => p.inquiries.user?.primary_organization_id).filter(Boolean);
      const organizationIds = [...new Set([...inquiryOrgIds, ...proposalOrgIds])];
      
      const organizations: { [key: string]: string } = {};
      
      if (organizationIds.length > 0) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', organizationIds);
        
        if (!orgError && orgData) {
          orgData.forEach(org => {
            organizations[org.id] = org.name;
          });
        }
      }

      // Fetch user's bookings for the current view period (both as user and venue owner)
      const { data: userBookings, error: userBookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          proposals!inner(
            *,
            inquiries!inner(
              *,
              properties!inner(title),
              profiles!inner(
                full_name,
                primary_organization_id,
                organizations:organizations!profiles_primary_organization_id_fkey(name)
              )
            )
          )
        `)
        .eq('user_id', user.id);

      let venueOwnerBookings: any[] = [];
      if (properties && properties.length > 0) {
        const propertyIds = properties.map(p => p.id);
        const { data: venueBookings, error: venueBookingsError } = await supabase
          .from('inquiries')
          .select('id')
          .in('property_id', propertyIds);
        
        if (!venueBookingsError && venueBookings) {
          const inquiryIds = venueBookings.map(i => i.id);
          let venueBookingData;
          let venueBookingError;
          
          if (inquiryIds.length === 1) {
            // Use .eq() for single ID - query proposals first, then bookings
            const { data: venueProposals, error: venueProposalsError } = await supabase
              .from('proposals')
              .select('id')
              .eq('inquiry_id', inquiryIds[0]);
            
            if (!venueProposalsError && venueProposals && venueProposals.length > 0) {
              const proposalIds = venueProposals.map(p => p.id);
              const result = await supabase
                .from('bookings')
                .select(`
                  *,
                  proposals!inner(
                    *,
                    inquiries!inner(
                      *,
                      properties!inner(title),
                      profiles!inner(
                        full_name,
                        primary_organization_id,
                        organizations:organizations!profiles_primary_organization_id_fkey(name)
                      )
                    )
                  )
                `)
                .eq('proposal_id', proposalIds[0]);
              venueBookingData = result.data;
              venueBookingError = result.error;
            } else {
              venueBookingData = [];
              venueBookingError = null;
            }
          } else if (inquiryIds.length > 1) {
            // Use .in() for multiple IDs - query proposals first, then bookings
            const { data: venueProposals, error: venueProposalsError } = await supabase
              .from('proposals')
              .select('id')
              .in('inquiry_id', inquiryIds);
            
            if (!venueProposalsError && venueProposals && venueProposals.length > 0) {
              const proposalIds = venueProposals.map(p => p.id);
              const result = await supabase
                .from('bookings')
                .select(`
                  *,
                  proposals!inner(
                    *,
                    inquiries!inner(
                      *,
                      properties!inner(title),
                      profiles!inner(
                        full_name,
                        primary_organization_id,
                        organizations:organizations!profiles_primary_organization_id_fkey(name)
                      )
                    )
                  )
                `)
                .in('proposal_id', proposalIds);
              venueBookingData = result.data;
              venueBookingError = result.error;
            } else {
              venueBookingData = [];
              venueBookingError = null;
            }
          }
          
          if (!venueBookingError) {
            venueOwnerBookings = venueBookingData || [];
          }
        }

        // Fallback: fetch bookings via inquiries -> proposals -> bookings (matches dashboard-style access)
        if (venueOwnerBookings.length === 0) {
          const { data: inquiryBookingTree, error: inquiryBookingTreeError } = await supabase
            .from('inquiries')
            .select(`
              id,
              properties:properties(title),
              proposals:proposals(
                id,
                bookings:bookings(
                  id,
                  start_date,
                  end_date,
                  status,
                  payment_status
                )
              )
            `)
            .in('property_id', propertyIds);

          if (!inquiryBookingTreeError && inquiryBookingTree) {
            const flattened: any[] = [];
            (inquiryBookingTree as any[]).forEach((inq: any) => {
              const proposals = inq.proposals || [];
              proposals.forEach((proposal: any) => {
                const bookings = proposal.bookings || [];
                bookings.forEach((booking: any) => {
                  flattened.push({
                    ...booking,
                    proposal_id: proposal.id,
                    proposals: {
                      inquiries: {
                        id: inq.id,
                        properties: inq.properties,
                      },
                    },
                  });
                });
              });
            });
            venueOwnerBookings = flattened;
          }
        }
      }

      // Combine both sets of bookings and remove duplicates
      const allBookingsCombined = [...(userBookings || []), ...venueOwnerBookings];
      const bookings = allBookingsCombined.filter((booking, index, self) => 
        index === self.findIndex(b => b.id === booking.id)
      );

      console.log('User bookings:', userBookings, 'Error:', userBookingsError);
      console.log('Venue owner bookings:', venueOwnerBookings);
      console.log('Combined bookings:', bookings);

      // If an inquiry has progressed to a booking, suppress the inquiry event (show only the booking).
      const bookedInquiryIds = new Set(
        (bookings || [])
          .map((b: any) => b?.proposals?.inquiries?.id)
          .filter(Boolean)
      );
      filteredInquiriesWithoutBookings = filteredInquiries.filter((inq: any) => !bookedInquiryIds.has(inq.id));

      // Filter out proposals that have already become bookings
      const bookedProposalIds = new Set(
        (bookings || [])
          .map((b: any) => b?.proposal_id)
          .filter(Boolean)
      );
      const filteredProposals = proposals.filter((proposal: any) => !bookedProposalIds.has(proposal.id));

      console.log('Filtered inquiries for calendar:', filteredInquiriesWithoutBookings);
      console.log('Filtered proposals for calendar:', filteredProposals);

      if (initiatorError) throw initiatorError;
      if (userProposalsError) throw userProposalsError;
      if (userBookingsError) throw userBookingsError;

      const calendarEvents: CalendarEvent[] = [];

      // Add inquiry events
      console.log('Processing inquiries for calendar:', filteredInquiriesWithoutBookings?.length || 0);
      filteredInquiriesWithoutBookings?.forEach(inquiry => {
        console.log('Processing inquiry:', inquiry);
        console.log('Inquiry user fields:', {
          id: inquiry.id,
          user_id: inquiry.user_id,
          user: (inquiry as any).user,
        });
        const isHourly = inquiry.start_at && inquiry.end_at;
        let inquiryStart = isHourly ? new Date(inquiry.start_at!) : new Date(inquiry.start_date);
        let inquiryEnd = isHourly
          ? new Date(inquiry.end_at!)
          : inquiry.end_date
            ? new Date(inquiry.end_date)
            : new Date(inquiry.start_date);

        if (!isHourly && inquiryEnd.getTime() === inquiryStart.getTime()) {
          inquiryEnd = new Date(inquiryEnd.getTime() + 24 * 60 * 60 * 1000);
        }
        
        const rpcCounterparty = counterpartyByInquiryId[inquiry.id];

        const organizationName =
          rpcCounterparty?.guest_organization_name ||
          (inquiry.user?.primary_organization_id && organizations[inquiry.user?.primary_organization_id]);

        const guestName =
          rpcCounterparty?.guest_full_name ||
          inquiry.user?.full_name ||
          inquiry.user?.email ||
          'Unknown Name';

        // Build the display text - only include organization if it exists
        let displayText = `${inquiry.properties?.title || 'Unknown Property'}\n${guestName}${isHourly ? ' (Hourly)' : ''}`;
        if (organizationName) {
          displayText = `${inquiry.properties?.title || 'Unknown Property'}\n${organizationName}\n${guestName}${isHourly ? ' (Hourly)' : ''}`;
        }

        const event = {
          id: `inquiry-${inquiry.id}`,
          start: inquiryStart.toISOString(),
          end: inquiryEnd.toISOString(),
          text: displayText,
          backColor: '#9EA3AE',
          borderColor: '#7A8293',
          fontColor: '#FFFFFF',
          moveDisabled: true,
          resizeDisabled: true,
        };
        
        console.log('Created inquiry event:', event);
        calendarEvents.push(event);
      });

      // Add proposal events
      filteredProposals?.forEach(proposal => {
        const isHourly = proposal.inquiries.start_at && proposal.inquiries.end_at;
        let proposalStart = isHourly ? new Date(proposal.inquiries.start_at!) : new Date(proposal.inquiries.start_date);
        let proposalEnd = isHourly
          ? new Date(proposal.inquiries.end_at!)
          : proposal.inquiries.end_date
            ? new Date(proposal.inquiries.end_date)
            : new Date(proposal.inquiries.start_date);

        if (!isHourly && proposalEnd.getTime() === proposalStart.getTime()) {
          proposalEnd = new Date(proposalEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        // Use counterparty RPC data like inquiries and bookings do
        const inquiryId = proposal.inquiries.id;
        const rpcCounterparty = counterpartyByInquiryId[inquiryId];

        const organizationName =
          rpcCounterparty?.guest_organization_name ||
          (proposal.inquiries.user?.primary_organization_id && organizations[proposal.inquiries.user?.primary_organization_id]);

        const guestName =
          rpcCounterparty?.guest_full_name ||
          proposal.inquiries.user?.full_name ||
          proposal.inquiries.user?.email ||
          'Unknown Name';

        // Build the display text - only include organization if it exists
        let displayText = `${proposal.inquiries.properties?.title || 'Unknown Property'}\n${guestName}${isHourly ? ' (Hourly)' : ''}`;
        if (organizationName) {
          displayText = `${proposal.inquiries.properties?.title || 'Unknown Property'}\n${organizationName}\n${guestName}${isHourly ? ' (Hourly)' : ''}`;
        }
        displayText += '\n[Proposal]';

        const event = {
          id: `proposal-${proposal.id}`,
          start: proposalStart.toISOString(),
          end: proposalEnd.toISOString(),
          text: displayText,
          backColor: '#4F46E5', // Blue for proposals
          borderColor: '#4338CA',
          fontColor: '#FFFFFF',
          moveDisabled: true,
          resizeDisabled: true,
        };
        
        console.log('Created proposal event:', event);
        calendarEvents.push(event);
      });

      // Add booking events
      bookings?.forEach(booking => {
        const bookingStart = new Date(booking.start_date);
        const bookingEnd = booking.end_date ? new Date(booking.end_date) : bookingStart;

        const bookingInquiryId = booking.proposals?.inquiries?.id;
        const bookingCounterparty = bookingInquiryId ? counterpartyByInquiryId[bookingInquiryId] : undefined;
        
        const organizationName =
          bookingCounterparty?.guest_organization_name ||
          booking.proposals?.inquiries?.profiles?.organizations?.name;

        const guestName =
          bookingCounterparty?.guest_full_name ||
          booking.proposals?.inquiries?.profiles?.full_name ||
          booking.proposals?.inquiries?.profiles?.email ||
          'Unknown Name';

        // Build the display text - only include organization if it exists
        let displayText = `${booking.proposals?.inquiries?.properties?.title || 'Unknown Property'}\n${guestName}`;
        if (organizationName) {
          displayText = `${booking.proposals?.inquiries?.properties?.title || 'Unknown Property'}\n${organizationName}\n${guestName}`;
        }
        
        calendarEvents.push({
          id: `booking-${booking.id}`,
          start: bookingStart.toISOString(),
          end: bookingEnd.toISOString(),
          text: displayText,
          backColor: '#DB735D',
          borderColor: '#B85A48',
          fontColor: '#FFFFFF',
          moveDisabled: true,
          resizeDisabled: true,
        });
      });

      // Fetch external calendar events for venue owners
      console.log('Checking for external calendars - properties:', properties?.length || 0);
      if (properties && properties.length > 0) {
        try {
          console.log('Fetching external calendar events for venue owner');
          
          // Get property schedules with iCal URLs
          const { data: schedules, error: schedulesError } = await supabase
            .from('property_schedule')
            .select('property_id, ical_url')
            .in('property_id', properties.map(p => p.id))
            .not('ical_url', 'is', null);

          console.log('Schedules query result:', { schedules, schedulesError });

          if (schedules && schedules.length > 0) {
            const icalUrls = schedules.map(s => s.ical_url).filter(Boolean);
            console.log('Found iCal URLs:', icalUrls);
            console.log('Full schedule data:', schedules);
            
            if (icalUrls.length > 0) {
              console.log('Fetching external events from', icalUrls.length, 'iCal URLs');
              
              const { data: externalData, error: externalError } = await supabase.functions.invoke('external-calendar-events', {
                body: { icalUrls },
              });

              if (!externalError && externalData?.events) {
                console.log('Loaded', externalData.events.length, 'external events');
                console.log('External events data:', externalData);
                
                // Get property titles for mapping
                const { data: propertyData } = await supabase
                  .from('properties')
                  .select('id, title')
                  .in('id', schedules.map(s => s.property_id));

                const titleMap = (propertyData || []).reduce((acc, prop) => {
                  acc[prop.id] = prop.title;
                  return acc;
                }, {} as Record<string, string>);

                // Add external events to calendar
                externalData.events.forEach((externalEvent: any) => {
                  // Find the property that matches this iCal URL
                  const schedule = schedules.find(s => s.ical_url === externalEvent.sourceUrl);
                  const propertyTitle = schedule ? titleMap[schedule.property_id] || 'Unknown Property' : 'External Booking';

                  const externalCalendarEvent = {
                    id: externalEvent.id,
                    start: externalEvent.start,
                    end: externalEvent.end,
                    text: `${propertyTitle}\nUnavailable\n[External Booking]`,
                    backColor: '#FF6B6B', // Red for unavailable
                    borderColor: '#CC5555',
                    fontColor: '#FFFFFF',
                    moveDisabled: true,
                    resizeDisabled: true,
                    resource: propertyTitle,
                    toolTip: 'External booking - cannot be modified',
                    isExternal: true,
                  };
                  
                  calendarEvents.push(externalCalendarEvent);
                });
              } else if (externalError) {
                console.warn('Failed to fetch external calendar events:', externalError);
              }
            }
          }
        } catch (error) {
          console.warn('Error fetching external calendar events:', error);
          // Don't fail the entire calendar load if external events fail
        }
      }

      console.log('Final calendar events:', calendarEvents);
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      
      // Check if it's a network/CORS error
      if (error instanceof Error && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('CORS') || 
           error.message.includes('522'))) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load calendar events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    if (viewType === 'month') {
      // Go back one month, keeping the same day position
      handleDateChange(currentDate.addMonths(-1));
    } else if (viewType === 'week') {
      handleDateChange(currentDate.addDays(-7));
    } else {
      handleDateChange(currentDate.addDays(-1));
    }
  };

  const handleNextMonth = () => {
    if (viewType === 'month') {
      // Go forward one month, keeping the same day position
      handleDateChange(currentDate.addMonths(1));
    } else if (viewType === 'week') {
      handleDateChange(currentDate.addDays(7));
    } else {
      handleDateChange(currentDate.addDays(1));
    }
  };

  const handleToday = () => {
    handleDateChange(DayPilot.Date.today());
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Please sign in to view your calendar</h2>
          <a href="/signin" className="text-blue-600 hover:text-blue-800">Sign In</a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Calendar Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#620E28] mb-2">Your Calendar</h1>
          <p className="text-gray-600">View all your inquiries and bookings in one place</p>
        </div>

        {selectedBooking && (
          <Dialog
            key={bookingDetailsKey}
            open={showBookingDetails}
            onClose={handleCloseBookingDetails}
            title="Booking Details"
            size="3xl"
          >
            <BookingDetails
              booking={selectedBooking}
              onClose={handleCloseBookingDetails}
              onBookingUpdated={fetchUserEvents}
            />
          </Dialog>
        )}

        {/* Calendar Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* View Selector */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleViewChange('month')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'month'
                    ? 'bg-[#620E28] text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => handleViewChange('week')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'week'
                    ? 'bg-[#620E28] text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => handleViewChange('day')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'day'
                    ? 'bg-[#620E28] text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Day
              </button>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePreviousMonth}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {viewType === 'month' ? 'Previous' : viewType === 'week' ? 'Previous Week' : 'Previous Day'}
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {viewType === 'month' ? 'Next' : viewType === 'week' ? 'Next Week' : 'Next Day'}
              </button>
            </div>
            
            {/* Legend */}
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#DB735D] rounded mr-2"></div>
                <span className="text-gray-700">Bookings</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#9EA3AE] rounded mr-2"></div>
                <span className="text-gray-700">Inquiries</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#4F46E5] rounded mr-2"></div>
                <span className="text-gray-700">Proposals</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#FF6B6B] rounded mr-2"></div>
                <span className="text-gray-700">External</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Time Range Selection UI */}
          {selectedTimeRange && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Time Range Selected</h3>
                  <p className="text-sm text-blue-700">
                    {selectedTimeRange.start.toString('MMM d, yyyy h:mm tt')} - {selectedTimeRange.end.toString('MMM d, yyyy h:mm tt')}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleOpenProposal}
                    className="bg-[#620E28] text-white px-4 py-2 rounded-md hover:bg-[#4A5F25] transition-colors"
                  >
                    Open Proposal
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
            </div>
          ) : (
            <>
              {viewType === 'month' ? (
                <DayPilotMonth
                  {...getMonthConfig()}
                />
              ) : (
                <DayPilotCalendar
                  {...(viewType === 'week' ? getWeekConfig() : getDayConfig())}
                />
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Calendar Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-[#DB735D] rounded mr-3"></div>
              <div>
                <span className="font-medium text-gray-900">Bookings</span>
                <p className="text-gray-600">Confirmed bookings and payments</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-[#9EA3AE] rounded mr-3"></div>
              <div>
                <span className="font-medium text-gray-900">Inquiries</span>
                <p className="text-gray-600">Property inquiries and requests</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-[#4F46E5] rounded mr-3"></div>
              <div>
                <span className="font-medium text-gray-900">Proposals</span>
                <p className="text-gray-600">Sent proposals awaiting response</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-[#FF6B6B] rounded mr-3"></div>
              <div>
                <span className="font-medium text-gray-900">External Bookings</span>
                <p className="text-gray-600">Bookings from external calendars (iCal)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
