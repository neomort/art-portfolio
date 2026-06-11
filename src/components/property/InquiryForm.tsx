import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { DateRangePicker, SingleDatePicker } from '../DateRangePicker';
import HourlyCalendar, { HourlyCalendarSelection } from '../booking/HourlyCalendar';
import '../../components/DateRangePicker.css';
import { buildPendingInquiryPayload } from '../../lib/pendingInquiry';
import { computeQuote, type QuoteBreakdown } from '../../lib/pricing';
import { Tooltip } from '../ui/Tooltip';
import { parseAppliedAdjustmentTokens, isAdjustmentApplied } from '../../lib/adjustments';
import './InquiryForm.css';

// Helper function to parse iCal data
function parseICalData(icsText: string): any[] {
  const lines = icsText.replace(/\r/g, '').split('\n');
  const events: any[] = [];
  let currentEvent: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        // Split key from parameters
        const semicolonIndex = keyPart.indexOf(';');
        const key = semicolonIndex > 0 ? keyPart.substring(0, semicolonIndex) : keyPart;
        
        currentEvent[key] = value;
      }
    }
  }
  
  return events;
}

type PropertyScheduleRow = Database['public']['Tables']['property_schedule']['Row'];
type InquiryInsert = Database['public']['Tables']['inquiries']['Insert'];
type QuoteAdjustment = { id: string; label: string; amount: number };

interface InquiryFormProps {
  propertyId: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialBrandInfo?: string;
}

const InquiryForm: React.FC<InquiryFormProps> = ({ 
  propertyId, 
  initialStartDate = '', 
  initialEndDate = '', 
  initialBrandInfo = ''
}) => {

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDaily, setHasDaily] = useState<boolean>(false);
  const [hasHourly, setHasHourly] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const submissionRef = useRef<string | null>(null);
  const [mode, setMode] = useState<'daily' | 'hourly'>('daily');
  const [propertyTimezone, setPropertyTimezone] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgAdjustments, setOrgAdjustments] = useState<any[]>([]);
  const [appliedAdjustmentTokens, setAppliedAdjustmentTokens] = useState<string[]>([]);
  const [headcount, setHeadcount] = useState<string>('');
  const [baseHourly, setBaseHourly] = useState<number | null>(null);
  const [baseDaily, setBaseDaily] = useState<number | null>(null);
  const [weeklyRateType, setWeeklyRateType] = useState<'percentage' | 'fixed' | null>(null);
  const [weeklyRateValue, setWeeklyRateValue] = useState<number>(0);
  const [monthlyRateType, setMonthlyRateType] = useState<'percentage' | 'fixed' | null>(null);
  const [monthlyRateValue, setMonthlyRateValue] = useState<number>(0);
  const [yearlyRateType, setYearlyRateType] = useState<'percentage' | 'fixed' | null>(null);
  const [yearlyRateValue, setYearlyRateValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [feeType, setFeeType] = useState<'percentage' | 'fixed'>('percentage');
  const [feeValue, setFeeValue] = useState<number>(0);
  const [feeDescription, setFeeDescription] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [propertyCapacity, setPropertyCapacity] = useState<number | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);
  const hideLoginPromptTimer = useRef<number | null>(null);
  const [selectedUserDiscounts, setSelectedUserDiscounts] = useState<Record<string, boolean>>({});
  const appliedAdjustmentTokenSet = useMemo(() => new Set(appliedAdjustmentTokens), [appliedAdjustmentTokens]);
  // Debug: live snapshot of preview decisions (use ref to avoid re-render loops)
  const debugInfoRef = useRef<null | {
    appliedIds: string[];
    orgAdjustments: Array<{ id: string; type: string; name?: string }>;
    qbAdjustments: Array<{ id: string; label: string; amount: number }>;
    filteredAdjustments: QuoteAdjustment[];
    mode: 'daily' | 'hourly';
    hasHeadcountPanel: boolean;
    hasDiscountPanel: boolean;
    selection: any;
  }>(null);
  // Schedule constraints for Hourly calendar
  const [minDateStr, setMinDateStr] = useState<string | undefined>(undefined); // yyyy-mm-dd
  const [maxDateStr, setMaxDateStr] = useState<string | undefined>(undefined);
  const [disabledWeekdays, setDisabledWeekdays] = useState<number[]>([]);
  const [workingHoursByWeekday, setWorkingHoursByWeekday] = useState<Record<number, { start: string; end: string }>>({});
  const [icalUrl, setIcalUrl] = useState<string | undefined>(undefined);
  const [blockedRanges, setBlockedRanges] = useState<{ start: string; end: string }[]>([]);
  const [supportsIcalUrl, setSupportsIcalUrl] = useState<boolean>(true);
  // Helpers for local date parsing/formatting
  function parseLocalDate(str: string | undefined): Date | null {
    if (!str) return null;
    const [year, month, day] = str.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  function formatLocalDate(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // Date state as Date objects
  const [dateRange, setDateRange] = useState<[
    Date | null,
    Date | null
  ]>([
    parseLocalDate(initialStartDate),
    parseLocalDate(initialEndDate),
  ]);
  // Sync string values for form submission
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [formData, setFormData] = useState({
    spaceRequirements: '',
    brandInfo: '',
    comments: ''
  });

  // Hourly selection (ISO strings)
  const [hourlySelection, setHourlySelection] = useState<HourlyCalendarSelection | null>(null);
  const [singleDate, setSingleDate] = useState<Date | null>(parseLocalDate(initialStartDate));
  const [lastDailyRange, setLastDailyRange] = useState<[Date | null, Date | null] | null>([
    parseLocalDate(initialStartDate),
    parseLocalDate(initialEndDate),
  ]);

  // Sync string values when dateRange changes
  useEffect(() => {
    setStartDate(dateRange[0] ? formatLocalDate(dateRange[0]) : '');
    setEndDate(dateRange[1] ? formatLocalDate(dateRange[1]) : '');
    setSingleDate(dateRange[0] ?? null);
  }, [dateRange]);

  // Update local state when initial props change (e.g., from URL parameters)
  useEffect(() => {
    if (initialStartDate !== startDate) {
      setStartDate(initialStartDate);
    }
  }, [initialStartDate]);

  useEffect(() => {
    if (initialEndDate !== endDate) {
      setEndDate(initialEndDate);
    }
  }, [initialEndDate]);

  // Update brandInfo when initialBrandInfo changes
  useEffect(() => {
    if (initialBrandInfo && initialBrandInfo !== formData.brandInfo) {
      setFormData(prev => ({
        ...prev,
        brandInfo: initialBrandInfo
      }));
    }
  }, [initialBrandInfo]);

  // Load property flags to determine available booking modes
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const baseSelect = '*';

        const trySelect = async (includeTokens: boolean) => {
          const select = includeTokens
            ? `${baseSelect}, applied_adjustment_tokens`
            : baseSelect;
          return await supabase
            .from('properties')
            .select(select)
            .eq('id', propertyId)
            .single();
        };

        let { data, error } = await trySelect(true);
        if (error && /applied_adjustment_tokens|PGRST204|column/i.test(error.message || '')) {
          const fallback = await trySelect(false);
          data = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        if (!active) return;
        const daily = !!data?.price_per_day;
        const hourly = !!(data as any)?.price_per_hour;
        const longer = !!(data?.weekly_rate_type || data?.weekly_rate || data?.weekly_percent || data?.monthly_rate_type || data?.monthly_rate || data?.monthly_percent || data?.yearly_rate_type || data?.yearly_rate || data?.yearly_percent);
        setHasDaily(daily || longer); // daily UI covers daily and longer-term
        setHasHourly(hourly);
        setBaseHourly((data as any)?.price_per_hour ?? null);
        setBaseDaily((data as any)?.price_per_day ?? null);
        setWeeklyRateType((() => {
          const row = data as any;
          if (row?.weekly_rate_type) return row.weekly_rate_type as any;
          if (typeof row?.weekly_rate === 'number' || typeof row?.weekly_rate_value === 'number') return 'fixed';
          return null;
        })());
        setWeeklyRateValue((() => {
          const row = data as any;
          if (row?.weekly_rate_type === 'fixed' && typeof row?.weekly_rate_value === 'number') return Number(row.weekly_rate_value) || 0;
          if (typeof row?.weekly_rate === 'number') return Number(row.weekly_rate) || 0;
          if (typeof row?.weekly_rate_value === 'number') return Number(row.weekly_rate_value) || 0;
          return 0;
        })());
        setMonthlyRateType((() => {
          const row = data as any;
          if (row?.monthly_rate_type) return row.monthly_rate_type as any;
          if (typeof row?.monthly_rate === 'number' || typeof row?.monthly_rate_value === 'number') return 'fixed';
          return null;
        })());
        setMonthlyRateValue((() => {
          const row = data as any;
          if (row?.monthly_rate_type === 'fixed' && typeof row?.monthly_rate_value === 'number') return Number(row.monthly_rate_value) || 0;
          if (typeof row?.monthly_rate === 'number') return Number(row.monthly_rate) || 0;
          if (typeof row?.monthly_rate_value === 'number') return Number(row.monthly_rate_value) || 0;
          return 0;
        })());
        setYearlyRateType((() => {
          const row = data as any;
          if (row?.yearly_rate_type) return row.yearly_rate_type as any;
          if (typeof row?.yearly_rate === 'number' || typeof row?.yearly_rate_value === 'number') return 'fixed';
          return null;
        })());
        setYearlyRateValue((() => {
          const row = data as any;
          if (row?.yearly_rate_type === 'fixed' && typeof row?.yearly_rate_value === 'number') return Number(row.yearly_rate_value) || 0;
          if (typeof row?.yearly_rate === 'number') return Number(row.yearly_rate) || 0;
          if (typeof row?.yearly_rate_value === 'number') return Number(row.yearly_rate_value) || 0;
          return 0;
        })());
        setTaxRate(Number((data as any)?.tax_rate || 0));
        setFeeType(((data as any)?.fee_type || 'percentage') as 'percentage' | 'fixed');
        setFeeValue(Number((data as any)?.fee_value || 0));
        setFeeDescription((data as any)?.fee_description || '');
        setPropertyCapacity((data as any)?.capacity || null);
        // Capture applied adjustments gating list (stable keys or legacy ids)
        {
          const tokens = parseAppliedAdjustmentTokens((data as any)?.applied_adjustment_tokens);
          const ids = parseAppliedAdjustmentTokens((data as any)?.applied_adjustment_ids);
          setAppliedAdjustmentTokens(Array.from(new Set([...tokens, ...ids])));
        }
        // Decide initial mode
        if (hourly && !(daily || longer)) {
          const first = parseLocalDate(initialStartDate) || parseLocalDate(initialEndDate) || new Date();
          const tuple: [Date | null, Date | null] = [first, first];
          setDateRange(tuple);
          setSingleDate(first);
          setLastDailyRange(tuple);
          setMode('hourly');
        } else {
          setMode('daily');
          const tuple: [Date | null, Date | null] = [
            parseLocalDate(initialStartDate),
            parseLocalDate(initialEndDate),
          ];
          setLastDailyRange(tuple);
        }
        // Resolve timezone: prefer property, then organization default from Edge Function response
        let tz: string | null = (data as any)?.iana_timezone || null;
        if (!tz) {
          tz = (data as any)?.defaultTimezone || null;
        }
        setPropertyTimezone(tz);
        setOrganizationId((data as any)?.organization_id || null);
      } catch (e) {
        // default to daily
        setHasDaily(true);
        setHasHourly(false);
        setMode('daily');
      }
    })();
    return () => { active = false; };
  }, [propertyId, supportsIcalUrl]);

  // Survey loading disabled for art portfolio — see SURVEY_DISABLED.md

  // Org adjustments are now fetched via Edge Function alongside bookings

  // Load blocked ranges from bookings and iCal (bookings via Edge Function to bypass RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Skip Edge Function entirely for art portfolio (no bookings/inquiries needed)
        const publicDataPromise = Promise.resolve({ data: { bookings: [], orgAdjustments: [] } });

        let icalPromise: Promise<any>;
        if (supportsIcalUrl && icalUrl) {
          const normalizedUrl = icalUrl.startsWith('webcal://')
            ? 'https://' + icalUrl.slice('webcal://'.length)
            : icalUrl;
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info('[InquiryForm] invoking fetch_ical', { normalizedUrl });
          }

          // Try direct fetch first (bypass Edge Function for testing)
          icalPromise = fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(normalizedUrl), {
            headers: { 'Accept': 'application/json' }
          })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const jsonResponse = await res.json();
            const icsText = jsonResponse.contents; // allorigins.win wraps the response

            if (typeof window !== 'undefined') {
              // eslint-disable-next-line no-console
              console.info('[InquiryForm] CORS proxy fetch successful, parsing...');
              // Debug: Log the raw iCal content to see what we're working with
              console.log('[InquiryForm] Raw iCal content (first 500 chars):', icsText.substring(0, 500));
              console.log('[InquiryForm] Raw iCal content (last 500 chars):', icsText.substring(-500));
            }

            // Check if the response is base64-encoded
            let decodedIcsText = icsText;
            if (icsText.includes('base64,')) {
              // Extract base64 part and decode it
              const base64Match = icsText.match(/base64,(.+)/);
              if (base64Match) {
                try {
                  decodedIcsText = atob(base64Match[1]);
                  if (typeof window !== 'undefined') {
                    // eslint-disable-next-line no-console
                    console.info('[InquiryForm] Successfully decoded base64 iCal content');
                  }
                } catch (e) {
                  if (typeof window !== 'undefined') {
                    // eslint-disable-next-line no-console
                    console.warn('[InquiryForm] Failed to decode base64 iCal content:', e);
                  }
                }
              }
            }

            // More robust iCal parser that handles parameters
            const lines = decodedIcsText.replace(/\r/g, '').split('\n');
            const events: any[] = [];
            let currentEvent: any = null;

            if (typeof window !== 'undefined') {
              // eslint-disable-next-line no-console
              console.info('[InquiryForm] Parsing', lines.length, 'lines of iCal data');
            }

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();

              if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
              } else if (line === 'END:VEVENT' && currentEvent) {
                events.push(currentEvent);
                currentEvent = null;
              } else if (currentEvent && line.includes(':')) {
                // Handle lines with parameters like DTSTART;TZID=America/Denver:20260108T140000Z
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                  const keyPart = line.substring(0, colonIndex);
                  const value = line.substring(colonIndex + 1);

                  // Extract the key without parameters
                  const key = keyPart.split(';')[0];

                  if (key === 'DTSTART') {
                    currentEvent.start = value;
                  } else if (key === 'DTEND') {
                    currentEvent.end = value;
                  } else if (key === 'SUMMARY') {
                    currentEvent.summary = value;
                  } else if (key === 'UID') {
                    currentEvent.uid = value;
                  }
                }
              }
            }

            if (typeof window !== 'undefined') {
              // eslint-disable-next-line no-console
              console.info('[InquiryForm] CORS proxy parsing result:', { eventsCount: events.length });
              events.forEach((ev, i) => {
                console.log(`[InquiryForm] CORS proxy parsed event ${i}:`, ev);
              });
            }

            return { data: { events }, error: null } as any;
          })
          .catch((e) => {
            if (typeof window !== 'undefined') {
              // eslint-disable-next-line no-console
              console.warn('[InquiryForm] CORS proxy fetch failed, trying direct fetch...', e);
            }

            // Fallback to proxy fetch for Google Calendar (CORS-safe)
            if (normalizedUrl.includes('calendar.google.com')) {
              const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://coandrdclvjebyoadoau.supabase.co';
              return fetch(`${supabaseUrl}/functions/v1/ical-proxy?url=${encodeURIComponent(normalizedUrl)}`, {
                headers: { 'Accept': 'text/calendar, */*' }
              })
              .then(async (res) => {
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const icsText = await res.text();
                if (typeof window !== 'undefined') {
                  // eslint-disable-next-line no-console
                  console.info('[InquiryForm] Proxy iCal fetch successful, parsing...');
                }
                return { data: { events: parseICalData(icsText) }, error: null } as any;
              });
            } else {
              // For non-Google Calendar URLs, try direct fetch
              return fetch(normalizedUrl, {
                headers: { 'Accept': 'text/calendar, */*', 'User-Agent': 'SplitSpace-ICAL-Fetch/1.0' }
              })
              .then(async (res) => {
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const icsText = await res.text();
                if (typeof window !== 'undefined') {
                  // eslint-disable-next-line no-console
                  console.info('[InquiryForm] Direct iCal fetch successful, parsing...');
                }
                return { data: { events: parseICalData(icsText) }, error: null } as any;
              });
            }
          });
        } else {
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info('[InquiryForm] skipping fetch_ical', { supportsIcalUrl, hasIcalUrl: !!icalUrl, icalUrlValue: icalUrl });
          }
          icalPromise = Promise.resolve({ data: { events: [] }, error: null } as any);
        }

        const [publicDataRes, icalRes] = await Promise.all([publicDataPromise, icalPromise]);

        const blocked: { start: string; end: string }[] = [];

        const publicDataErr = (publicDataRes as any)?.error;
        const publicData = (publicDataRes as any)?.data || {};
        const bookingsArr = Array.isArray(publicData?.bookings) ? publicData.bookings : [];
        const adjustmentsArr = Array.isArray(publicData?.orgAdjustments) ? publicData.orgAdjustments : [];
        // Update org adjustments for quote UI
        setOrgAdjustments(adjustmentsArr);

        if (!publicDataErr && Array.isArray(bookingsArr)) {
          for (const b of bookingsArr as any[]) {
            // Prefer precise timestamps if present
            if (b.start_at && b.end_at) {
              blocked.push({ start: new Date(b.start_at).toISOString(), end: new Date(b.end_at).toISOString() });
            } else if (b.start_date && b.end_date) {
              // For daily bookings, only block business hours, not the entire 24-hour period
              // This allows hourly bookings outside of business hours to still be available
              const startDate = new Date(b.start_date + 'T00:00:00');
              const endDate = new Date(b.end_date + 'T00:00:00');

              // Calculate number of days to block
              const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

              for (let i = 0; i < daysDiff; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                // Use working hours for this weekday, or default business hours
                const weekday = currentDate.getDay();
                const workingHours = workingHoursByWeekday[weekday];

                if (workingHours) {
                  // Block only the working hours for this day
                  const [startHour, startMin] = workingHours.start.split(':').map(Number);
                  const [endHour, endMin] = workingHours.end.split(':').map(Number);

                  const blockStart = new Date(currentDate);
                  blockStart.setHours(startHour, startMin || 0, 0, 0);

                  const blockEnd = new Date(currentDate);
                  blockEnd.setHours(endHour, endMin || 0, 0, 0);

                  blocked.push({ start: blockStart.toISOString(), end: blockEnd.toISOString() });
                } else {
                  // Default business hours: 9 AM to 5 PM
                  const blockStart = new Date(currentDate);
                  blockStart.setHours(9, 0, 0, 0);

                  const blockEnd = new Date(currentDate);
                  blockEnd.setHours(17, 0, 0, 0);

                  blocked.push({ start: blockStart.toISOString(), end: blockEnd.toISOString() });
                }
              }
            }
          }
        }

        if (!icalRes.error && Array.isArray(icalRes.data?.events)) {
          // Convert an iCal date-time string (e.g. 20260108T140000Z) into a naive
          // local wall-time string in the property's timezone (e.g. America/Denver):
          // returns 'YYYY-MM-DDTHH:mm:ss' without a timezone designator.
          const toTzNaive = (iso: string, tz?: string | null) => {
            try {
              let d: Date | null = null;

              // Prefer parsing as iCal basic format first
              const m = iso.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
              if (m) {
                const [, Y, Mo, D, H, Mi, S, Zed] = m;
                if (Zed === 'Z') {
                  // Construct in UTC then view in target timezone
                  d = new Date(Date.UTC(
                    parseInt(Y),
                    parseInt(Mo) - 1,
                    parseInt(D),
                    parseInt(H),
                    parseInt(Mi),
                    parseInt(S)
                  ));
                } else {
                  // No Z means local (or TZID was stripped); treat as UTC anyway to be consistent
                  d = new Date(Date.UTC(
                    parseInt(Y),
                    parseInt(Mo) - 1,
                    parseInt(D),
                    parseInt(H),
                    parseInt(Mi),
                    parseInt(S)
                  ));
                }
              }

              // Fallback to native Date parsing if needed
              if (!d) {
                const tmp = new Date(iso);
                d = isNaN(tmp.getTime()) ? null : tmp;
              }
              if (!d || isNaN(d.getTime())) {
                console.warn('[InquiryForm] Invalid iCal timestamp:', iso);
                return null;
              }

              // Format in target timezone using formatToParts for zero-padding
              const timeZone = tz || undefined;
              const fmt = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });
              const parts = fmt.formatToParts(d);
              const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value || '00';
              const y = get('year');
              const mo = get('month');
              const da = get('day');
              const hh = get('hour');
              const mm = get('minute');
              const ss = get('second');
              return `${y}-${mo}-${da}T${hh}:${mm}:${ss}`;
            } catch (e) {
              console.warn('[InquiryForm] Error converting iCal timestamp:', iso, e);
              return null;
            }
          };
          for (const ev of icalRes.data.events as any[]) {
            if (ev.start && ev.end) {
              // Debug: log raw iCal events to help troubleshoot
              if (typeof window !== 'undefined') {
                console.log('[InquiryForm] iCal event:', {
                  start: ev.start,
                  end: ev.end,
                  summary: ev.summary,
                  uid: ev.uid
                });
              }

              // Convert to property timezone naive time for calendar display
              const localStart = toTzNaive(ev.start, propertyTimezone);
              const localEnd = toTzNaive(ev.end, propertyTimezone);

              if (localStart && localEnd) {
                if (typeof window !== 'undefined') {
                  console.log('[InquiryForm] Converted to local:', {
                    originalStart: ev.start,
                    localStart,
                    originalEnd: ev.end,
                    localEnd,
                    startDate: new Date(ev.start).toLocaleString(),
                    endDate: new Date(ev.end).toLocaleString()
                  });
                }

                blocked.push({ start: localStart, end: localEnd });
              } else {
                console.warn('[InquiryForm] Failed to convert iCal event dates:', ev);
              }
            }
          }
        }

        if (!cancelled) {
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.info('[InquiryForm] blockedRanges size', blocked.length);

            // Debug: Show breakdown of blocked ranges by source
            const bookingRanges = blocked.filter(r => !r.start.includes('__blocked__'));
            const icalRanges = blocked.filter(r => r.start.includes('__blocked__'));
            console.info('[InquiryForm] Blocked ranges breakdown:', {
              total: blocked.length,
              fromBookings: bookingRanges.length,
              fromICal: icalRanges.length
            });

            // Debug: log blocked ranges to help troubleshoot availability issues
            blocked.forEach((range, index) => {
              console.log(`[InquiryForm] Blocked range ${index}:`, {
                start: range.start,
                end: range.end,
                duration: new Date(range.end).getTime() - new Date(range.start).getTime(),
                startTime: new Date(range.start).toLocaleTimeString(),
                endTime: new Date(range.end).toLocaleTimeString(),
                startDate: new Date(range.start).toLocaleDateString(),
                endDate: new Date(range.end).toLocaleDateString(),
                source: range.start.includes('__blocked__') ? 'iCal' : 'booking'
              });
            });

            // Debug: Check if blocked ranges include Jan 8-9, 2026
            const jan8Start = new Date('2026-01-08T00:00:00').getTime();
            const jan9End = new Date('2026-01-10T00:00:00').getTime();
            const jan8Events = blocked.filter(range => {
              const rangeStart = new Date(range.start).getTime();
              return rangeStart >= jan8Start && rangeStart < jan9End;
            });
            console.log('[InquiryForm] Jan 8-9, 2026 blocked events:', jan8Events);
          }
          setBlockedRanges(blocked);
        }
      } catch {
        if (!cancelled) setBlockedRanges([]);
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId, icalUrl, supportsIcalUrl]);

  // Feature-detect ical_url column once
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.from('property_schedule').select('ical_url').limit(1);
        if (error && /ical_url|PGRST204|column/i.test(error.message || '')) {
          setSupportsIcalUrl(false);
        } else {
          setSupportsIcalUrl(true);
        }
      } catch {
        setSupportsIcalUrl(true);
      }
    })();
  }, []);

  // Load property_schedule to clamp Hourly calendar and fetch ical_url (when supported)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const columns = supportsIcalUrl
          ? 'available_from, available_until, daily_schedule, limit_availability, ical_url'
          : 'available_from, available_until, daily_schedule, limit_availability';
        const { data, error } = await supabase
          .from('property_schedule')
          .select(columns)
          .eq('property_id', propertyId)
          .maybeSingle<PropertyScheduleRow>();
        if (error) {
          // No schedule set; leave as open selection
          return;
        }
        if (!active || !data) return;
        // Set min/max date strings (yyyy-mm-dd)
        setMinDateStr(data.available_from || undefined);
        setMaxDateStr(data.available_until || undefined);
        if (supportsIcalUrl) {
          const icalUrlFromDb = data.ical_url || undefined;
          if (typeof window !== 'undefined' && icalUrlFromDb) {
            // eslint-disable-next-line no-console
            console.info('[InquiryForm] Loaded iCal URL from database:', { icalUrlFromDb, propertyId });
          }
          setIcalUrl(icalUrlFromDb);
        }
        // Determine disabled weekdays if limit_availability is false
        if (data.limit_availability === false) {
          setDisabledWeekdays([]);
          setWorkingHoursByWeekday({});
        } else if (data.daily_schedule && typeof data.daily_schedule === 'object') {
          const map: Record<string, number> = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };
          const disabled: number[] = [];
          const hours: Record<number, { start: string; end: string }> = {};
          Object.entries(map).forEach(([day, idx]) => {
            const val = (data.daily_schedule as Record<string, { enabled?: boolean; start?: string; end?: string }>)[day];
            if (!val?.enabled) {
              disabled.push(idx);
            } else if (val.start && val.end) {
              hours[idx] = { start: val.start, end: val.end };
            }
          });
          setDisabledWeekdays(disabled);
          setWorkingHoursByWeekday(hours);
        }
      } catch {
        // Ignore; keep defaults
      }
    })();
    return () => { active = false; };
  }, [propertyId, supportsIcalUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate unique submission ID
    const currentSubmissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prevent duplicate submissions using ref (persists across re-renders)
    if (submissionRef.current) {
      console.log('Form already submitting (ref check), ignoring duplicate submission', { 
        currentSubmissionId, 
        existingSubmissionId: submissionRef.current 
      });
      return;
    }
    
    // Also check state-based guard
    if (isSubmitting && submissionId) {
      console.log('Form already submitting (state check), ignoring duplicate submission', { 
        currentSubmissionId, 
        existingSubmissionId: submissionId 
      });
      return;
    }
    
    // Set both ref and state
    submissionRef.current = currentSubmissionId;
    setIsSubmitting(true);
    setSubmissionId(currentSubmissionId);
    setError(null);

    const isHourlyMode = mode === 'hourly';
    const hourlySelectionForPayload = isHourlyMode ? hourlySelection : null;
    const startDateValue = isHourlyMode
      ? (hourlySelectionForPayload ? startDate || hourlySelectionForPayload.start.substring(0, 10) : startDate)
      : startDate;
    const endDateValue = isHourlyMode
      ? (hourlySelectionForPayload ? endDate || hourlySelectionForPayload.end.substring(0, 10) : endDate)
      : endDate;

    if (!startDateValue || !endDateValue) {
      setError('Please select valid dates before submitting.');
      return;
    }

    if (isHourlyMode && !hourlySelectionForPayload) {
      setError('Please select a time range before submitting.');
      return;
    }

    const redirectPath = location.pathname + location.search;

    // Read setup & cleanup buffers from localStorage (saved on ManagePropertyPage)
    let setupBuffer: number | null = null;
    let cleanupBuffer: number | null = null;
    try {
      const raw = localStorage.getItem(`setupCleanup_${propertyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (mode === 'hourly') {
          setupBuffer = Math.max(0, parseInt(String(parsed?.hourly?.setupMinutes ?? 0), 10));
          cleanupBuffer = Math.max(0, parseInt(String(parsed?.hourly?.cleanupMinutes ?? 0), 10));
        } else {
          // daily mode (longer terms handled in later phase)
          setupBuffer = Math.max(0, parseInt(String(parsed?.daily?.setupDays ?? 0), 10));
          cleanupBuffer = Math.max(0, parseInt(String(parsed?.daily?.cleanupDays ?? 0), 10));
        }
      }
    } catch {}

    if (!user) {
      if (!guestEmail.trim()) {
        setError('Please enter your email so we can reach you.');
        return;
      }

      // New flow: create a light account + inquiry, and email a magic link
      try {
        setLoading(true);

        const payload = buildPendingInquiryPayload({
          propertyId,
          startDate: startDateValue,
          endDate: endDateValue,
          mode,
          hourlySelection: hourlySelectionForPayload,
          headcount,
          selectedUserDiscounts,
          formData,
          guestEmail: guestEmail || undefined,
          guestName: guestName || undefined,
          propertyTimezone,
          redirectPath,
          setupBuffer,
          cleanupBuffer,
        });

        const { data, error } = await supabase.functions.invoke('submit-inquiry-lite', {
          body: {
            propertyId,
            startDate: payload.startDate,
            endDate: payload.endDate,
            startAt: payload.startAt,
            endAt: payload.endAt,
            headcountValue: payload.headcountValue,
            selectedAdjustmentIds: payload.selectedAdjustmentIds,
            message: payload.message,
            guestEmail: payload.guestEmail,
            guestName: payload.guestName,
            redirectPath: payload.redirectPath,
            setupBuffer: payload.setupBuffer ?? null,
            cleanupBuffer: payload.cleanupBuffer ?? null,
          },
        });

        if (error) {
          console.error('[InquiryForm] submit-inquiry-lite error:', error);
          setError(error.message || 'We could not submit your inquiry. Please try again.');
          return;
        }

        // Success: if server did not send branded email, trigger Supabase OTP as fallback
        if (!data || !data.emailSent) {
          try {
            const emailRedirectTo = `${window.location.origin}${payload.redirectPath || '/dashboard'}`;
            const { error: otpErr } = await supabase.auth.signInWithOtp({
              email: payload.guestEmail as string,
              options: { emailRedirectTo },
            });
            if (otpErr) {
              console.warn('[InquiryForm] signInWithOtp failed to send email magic link:', otpErr);
            }
          } catch (sendErr) {
            console.warn('[InquiryForm] signInWithOtp crashed:', sendErr);
          }
        }

        // Guide user to email
        const notice = encodeURIComponent('We sent a secure link to your email so you can continue your inquiry.');
        navigate(`/dashboard?notice=${notice}`);
      } catch (err) {
        console.error('[InquiryForm] Unexpected error:', err);
        setError('We could not submit your inquiry. Please try again.');
      } finally {
        setLoading(false);
        setIsSubmitting(false);
        setSubmissionId(null);
        submissionRef.current = null;
      }
      return;
    }

    // Authenticated user flow: use Edge Function to create inquiry
    try {
      setLoading(true);
      
      const payload = buildPendingInquiryPayload({
        propertyId,
        startDate: startDateValue,
        endDate: endDateValue,
        mode,
        hourlySelection: hourlySelectionForPayload,
        headcount,
        selectedUserDiscounts,
        formData,
        guestEmail: (user as any)?.email ?? undefined,
        guestName: (user as any)?.full_name ?? undefined,
        propertyTimezone,
        redirectPath,
        setupBuffer,
        cleanupBuffer,
      });

      const { error } = await supabase.functions.invoke('submit-inquiry-lite', {
        body: {
          propertyId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          startAt: payload.startAt,
          endAt: payload.endAt,
          headcountValue: payload.headcountValue,
          selectedAdjustmentIds: payload.selectedAdjustmentIds,
          message: payload.message,
          guestEmail: payload.guestEmail,
          guestName: payload.guestName,
          redirectPath: payload.redirectPath,
          setupBuffer: payload.setupBuffer ?? null,
          cleanupBuffer: payload.cleanupBuffer ?? null,
        },
      });

      if (error) {
        console.error('[InquiryForm] submit-inquiry-lite error:', error);
        setError(error.message || 'We could not submit your inquiry. Please try again.');
        return;
      }

      // Success: navigate to dashboard
      const notice = encodeURIComponent('Your inquiry has been submitted successfully!');
      navigate(`/dashboard?notice=${notice}`);
      
    } catch (err) {
      console.error('[InquiryForm] Unexpected error:', err);
      setError('We could not submit your inquiry. Please try again.');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setSubmissionId(null);
      submissionRef.current = null;
    }

    // User is logged in - submit inquiry directly
    try {
      setLoading(true);

      const payload = buildPendingInquiryPayload({
        propertyId,
        startDate: startDateValue,
        endDate: endDateValue,
        mode,
        hourlySelection: hourlySelectionForPayload,
        headcount,
        selectedUserDiscounts,
        formData,
        guestEmail: (user as any)?.email ?? undefined,
        guestName: (user as any)?.full_name ?? undefined,
        propertyTimezone,
        redirectPath,
        setupBuffer,
        cleanupBuffer,
      });

      const { data: inquiry, error: inquiryError } = await supabase
        .from('inquiries')
        .insert({
          property_id: propertyId,
          user_id: user.id,
          start_date: payload.startDate,
          end_date: payload.endDate,
          start_at: payload.startAt,
          end_at: payload.endAt,
          headcount: payload.headcountValue,
          selected_adjustment_ids: payload.selectedAdjustmentIds.length > 0 ? payload.selectedAdjustmentIds : null,
          message: payload.message,
          status: 'pending',
        } satisfies InquiryInsert)
        .select('id')
        .single();

      if (inquiryError) throw inquiryError;

      try {
        const { data: propertyData } = await supabase
          .from('properties')
          .select(`
            id, title,
            venue_id,
            organization_id
          `)
          .eq('id', propertyId)
          .single();

        if (propertyData?.venue_id) {
          // Send notification to venue owner
          await supabase.functions.invoke('send-notification', {
            body: {
              inquiryId: inquiry.id,
              propertyId,
              venueId: propertyData.venue_id,
            }
          });
        }
      } catch (notificationError) {
        console.warn('Notification failed', notificationError);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Error submitting inquiry:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit inquiry');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setSubmissionId(null);
      submissionRef.current = null;
    }
  };

  const minDateValue = minDateStr ? parseLocalDate(minDateStr) : null;
  const maxDateValue = maxDateStr ? parseLocalDate(maxDateStr) : null;

  const ensureDate = (value: Date | null): Date => {
    if (value) return new Date(value.getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const handleModeChange = (nextMode: 'daily' | 'hourly') => {
    if (nextMode === mode) return;
    if (nextMode === 'hourly') {
      if (mode === 'daily') {
        setLastDailyRange([dateRange[0], dateRange[1]]);
      }
      const base = dateRange[0] || dateRange[1] || singleDate || null;
      const baseDate = ensureDate(base);
      const tuple: [Date | null, Date | null] = [baseDate, baseDate];
      setSingleDate(baseDate);
      setDateRange(tuple);
      if (hourlySelection && hourlySelection.start.substring(0,10) !== formatLocalDate(baseDate)) {
        setHourlySelection(null);
      }
      setMode('hourly');
    } else {
      const restore = (lastDailyRange && (lastDailyRange[0] || lastDailyRange[1]))
        ? [lastDailyRange[0], lastDailyRange[1]] as [Date | null, Date | null]
        : [singleDate, singleDate] as [Date | null, Date | null];
      setDateRange(restore);
      setMode('daily');
    }
  };

  type PricingTier = 'daily' | 'weekly' | 'monthly' | 'yearly';
  interface PricingTierOption {
    tier: PricingTier;
    cost: number;
    effectiveRate: number;
    spans: number;
  }

  const derivedDailyRate = useMemo(() => {
    if (typeof baseDaily === 'number' && baseDaily > 0) return baseDaily;
    if (weeklyRateType === 'fixed' && weeklyRateValue > 0) return weeklyRateValue / 7;
    if (monthlyRateType === 'fixed' && monthlyRateValue > 0) return monthlyRateValue / 30;
    if (yearlyRateType === 'fixed' && yearlyRateValue > 0) return yearlyRateValue / 365;
    return null;
  }, [baseDaily, weeklyRateType, weeklyRateValue, monthlyRateType, monthlyRateValue, yearlyRateType, yearlyRateValue]);

  const buildTierOptions = (days: number): PricingTierOption[] => {
    const normalizedDays = Math.max(1, days);
    const nights = Math.max(1, normalizedDays - 1);
    const opts: PricingTierOption[] = [];

    if (derivedDailyRate != null) {
      opts.push({ tier: 'daily', cost: derivedDailyRate * normalizedDays, effectiveRate: derivedDailyRate, spans: normalizedDays });
    }

    if (weeklyRateType === 'fixed' && weeklyRateValue > 0) {
      const spans = Math.max(1, Math.ceil(nights / 7));
      const cost = spans * weeklyRateValue;
      opts.push({ tier: 'weekly', cost, effectiveRate: cost / normalizedDays, spans });
    }

    if (monthlyRateType === 'fixed' && monthlyRateValue > 0 && normalizedDays >= 15) {
      const spans = Math.max(1, Math.ceil(nights / 30));
      const cost = spans * monthlyRateValue;
      opts.push({ tier: 'monthly', cost, effectiveRate: cost / normalizedDays, spans });
    }

    if (yearlyRateType === 'fixed' && yearlyRateValue > 0 && normalizedDays >= 180) {
      const spans = Math.max(1, Math.ceil(nights / 365));
      const cost = spans * yearlyRateValue;
      opts.push({ tier: 'yearly', cost, effectiveRate: cost / normalizedDays, spans });
    }

    return opts;
  };

  const pickBestTier = (days: number): PricingTierOption | null => {
    const options = buildTierOptions(days);
    if (!options.length) return null;

    let best = options[0];
    for (let i = 1; i < options.length; i += 1) {
      if (options[i].effectiveRate + 0.01 < best.effectiveRate) {
        best = options[i];
      }
    }

    if (derivedDailyRate != null) {
      const dailyRate = derivedDailyRate;
      if (Math.abs(best.effectiveRate - dailyRate) < 0.01) {
        const daily = options.find(opt => opt.tier === 'daily');
        if (daily) return daily;
      }
    }

    return best;
  };

  const describeBaseCalculation = (
    tier: PricingTier | undefined,
    spans: number | undefined,
    totalDays: number,
    baseAmount: number,
  ): string => {
    if (!tier || tier === 'daily') {
      if (derivedDailyRate != null) {
        return `$${derivedDailyRate.toFixed(2)} x ${totalDays} day${totalDays === 1 ? '' : 's'}`;
      }
      if (totalDays > 0 && baseAmount > 0) {
        const perDay = baseAmount / totalDays;
        return `$${perDay.toFixed(2)} x ${totalDays} day${totalDays === 1 ? '' : 's'}`;
      }
      return '';
    }

    if (!spans || spans <= 0) return '';

    const unitConfig: Record<'weekly' | 'monthly' | 'yearly', { days: number; label: string; value: number } | null> = {
      weekly: weeklyRateValue ? { days: 7, label: 'week', value: weeklyRateValue } : { days: 7, label: 'week', value: baseAmount / spans },
      monthly: monthlyRateValue ? { days: 30, label: 'month', value: monthlyRateValue } : { days: 30, label: 'month', value: baseAmount / spans },
      yearly: yearlyRateValue ? { days: 365, label: 'year', value: yearlyRateValue } : { days: 365, label: 'year', value: baseAmount / spans },
    };

    const config = unitConfig[tier as 'weekly' | 'monthly' | 'yearly'];
    if (!config) return '';

    const parts: string[] = [`$${config.value.toFixed(2)} x ${spans} ${config.label}${spans === 1 ? '' : 's'}`];
    const totalNights = Math.max(0, totalDays - 1);
    const extraNights = Math.max(0, totalNights - (config.days * spans));
    if (extraNights > 0) {
      parts.push(`${extraNights} extra day${extraNights === 1 ? '' : 's'}`);
    }

    return parts.join(' + ');
  };

  const minimumBookableDays = useMemo(() => {
    if (baseDaily !== null && baseDaily !== undefined) {
      return 1;
    }
    if (weeklyRateType === 'fixed' || weeklyRateType === 'percentage') {
      return 7;
    }
    if (monthlyRateType === 'fixed' || monthlyRateType === 'percentage') {
      return 30;
    }
    if (yearlyRateType === 'fixed' || yearlyRateType === 'percentage') {
      return 365;
    }
    return 1;
  }, [baseDaily, weeklyRateType, monthlyRateType, yearlyRateType]);

  const minimumBookingLabel = useMemo(() => {
    switch (minimumBookableDays) {
      case 7:
        return 'one week';
      case 30:
        return 'one month';
      case 365:
        return 'one year';
      default:
        return null;
    }
  }, [minimumBookableDays]);

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 pt-3">
          {/* Debug banner (enable with localStorage.setItem('debugAdjustments','1')) */}
          {typeof window !== 'undefined' && window.localStorage.getItem('debugAdjustments') === '1' && (
            <div className="p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900 text-xs space-y-2">
              <div className="font-semibold">Adjustment Debug</div>
              <div className="flex flex-wrap gap-2">
                <div><span className="font-medium">Org ID:</span> {organizationId || 'n/a'}</div>
                <div><span className="font-medium">Applied Tokens:</span> {(appliedAdjustmentTokens || []).join(', ') || '[]'}</div>
                <div><span className="font-medium">Mode:</span> {mode}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <div className="font-medium">Org Adjustments ({orgAdjustments.length})</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {(orgAdjustments || []).map((r: any) => (
                      <li key={r.id} className="break-all">{r.id} — {r.type} — {(r.data?.name || '')}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Last Preview Snapshot</div>
                  <div><span className="font-medium">qbAdjustments:</span> {debugInfoRef.current?.qbAdjustments?.length ?? 0}</div>
                  <div><span className="font-medium">filtered:</span> {debugInfoRef.current?.filteredAdjustments?.length ?? 0}</div>
                  <div><span className="font-medium">hasHeadcountPanel:</span> {String(debugInfoRef.current?.hasHeadcountPanel)}</div>
                  <div><span className="font-medium">hasDiscountPanel:</span> {String(debugInfoRef.current?.hasDiscountPanel)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Organization-specific additional questions (Survey) */}
          {/* Moved near submit button for final placement */}

          {(hasDaily && hasHourly) && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-maroon-700 font-medium">Booking type:</span>
              <div className="inline-flex items-center gap-1 rounded-xl border border-maroon-200 px-1 py-1 toggle-container" role="group" aria-label="Booking type">
                <button
                  type="button"
                  aria-pressed={mode === 'daily'}
                  className={`w-24 px-3 py-1 text-sm text-center rounded-lg transition-colors ${mode === 'daily' ? 'font-semibold active-toggle' : ''}`}
                  style={mode === 'daily' ? { backgroundColor: '#620E28', color: '#FFFFFF' } : { color: '#620E28', backgroundColor: '#FFFFFF' }}
                  onClick={() => handleModeChange('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'hourly'}
                  className={`w-24 px-3 py-1 text-sm text-center rounded-lg transition-colors ${mode === 'hourly' ? 'font-semibold active-toggle' : ''}`}
                  style={mode === 'hourly' ? { backgroundColor: '#620E28', color: '#FFFFFF' } : { color: '#620E28', backgroundColor: '#FFFFFF' }}
                  onClick={() => handleModeChange('hourly')}
                >
                  Hourly
                </button>
              </div>
            </div>
          )}

          {/* Date picker block (single-day when hourly) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#620E28] mb-2">Select Dates</label>
            {mode === 'hourly' && hasHourly ? (
              <SingleDatePicker
                value={singleDate}
                onChange={(date) => {
                  setSingleDate(date);
                  const normalized: [Date | null, Date | null] = date ? [date, date] : [null, null];
                  setDateRange(normalized);
                  if (date) {
                    const isoDay = formatLocalDate(date);
                    if (hourlySelection && hourlySelection.start.substring(0, 10) !== isoDay) {
                      setHourlySelection(null);
                    }
                  }
                }}
                minDate={minDateValue ?? new Date()}
                maxDate={maxDateValue ?? undefined}
              />
            ) : (
              <DateRangePicker
                value={dateRange}
                onChange={(dates) => {
                  const next: [Date | null, Date | null] = [dates[0], dates[1]];
                  setDateRange(next);
                  if (mode === 'daily') {
                    setLastDailyRange(next);
                  }
                  if (next[0] && next[1] && next[0].getTime() === next[1].getTime()) {
                    setSingleDate(next[0]);
                  }
                }}
                minDate={minDateValue ?? new Date()}
                maxDate={maxDateValue ?? undefined}
              />
            )}
            {(initialStartDate || initialEndDate) && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg">✓ Dates pre-filled from your search filters</div>
            )}
          </div>

          <div className="space-y-2">
            {mode === 'hourly' && hasHourly && (
              <>
                <label className="block text-sm font-medium text-[#620E28] mb-2">Select Day and Time</label>
                <HourlyCalendar
                  selected={hourlySelection}
                  onChange={(sel) => {
                    setHourlySelection(sel);
                    // Keep start/end date strings in sync, use the date parts
                    if (sel) {
                      const s = sel.start.substring(0,10);
                      const e = sel.end.substring(0,10);
                      setDateRange([parseLocalDate(s), parseLocalDate(e)]);
                    }
                  }}
                  date={(startDate || minDateStr) || undefined}
                  minDate={minDateStr ? new Date(minDateStr) < new Date() ? formatLocalDate(new Date()) : minDateStr : undefined}
                  maxDate={maxDateStr}
                  disabledWeekdays={disabledWeekdays}
                  workingHoursByWeekday={workingHoursByWeekday}
                  blockedRanges={blockedRanges}
                />
                {!hourlySelection && (
                  <div className="text-xs text-maroon-600 mt-2">Drag on the calendar to select a time range.</div>
                )}
                {/* Local time detail intentionally hidden per product request */}
                {/* Estimated Headcount (only if capacity surcharge is active AND applied to this property) */}
                {(() => {
                  try {
                    const cap = (orgAdjustments as any[]).find(r => r.type === 'capacity_surcharge' && ((r.data?.active ?? true) !== false));
                    const show = !!cap && isAdjustmentApplied(cap, appliedAdjustmentTokenSet);
                    if (!show) return null;
                    return (
                      <div className="mt-4 px-4 pt-4 pb-3 border border-maroon-200 rounded-xl bg-white">
                        {error && error.includes('capacity') && (
                          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-3">
                            {error}
                          </div>
                        )}
                        <label className="block text-sm font-medium text-[#620E28] mb-1">
                          Estimated Headcount
                          <Tooltip content={<div className="max-w-xs whitespace-normal">For this booking, a surcharge may apply based on attendance</div>}>
                            <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                          </Tooltip>
                        </label>
                        <input
                          type="number"
                          value={headcount}
                          onChange={(e) => {
                            const newHeadcount = e.target.value;
                            const headcountNum = parseInt(newHeadcount);
                            
                            // Check if capacity surcharge is active and property has capacity limit
                            const hasCapacitySurcharge = orgAdjustments.some(adj => 
                              adj.type === 'capacity_surcharge' && isAdjustmentApplied(adj, appliedAdjustmentTokenSet)
                            );
                            
                            if (hasCapacitySurcharge && propertyCapacity && headcountNum > propertyCapacity) {
                              setError(`Property's maximum capacity is ${propertyCapacity}`);
                              return;
                            }
                            
                            setError(null);
                            setHeadcount(newHeadcount);
                          }}
                          className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                          placeholder="e.g., 60"
                          min={0}
                        />
                      </div>
                    );
                  } catch { return null; }
                })()}

                {/* Discount Options (user-selected) — only if applied on this property */}
                {(() => {
                  try {
                    const userDiscounts = (orgAdjustments as any[])
                      .filter(r => r.type === 'user_selected_discount' && ((r.data?.active ?? true) !== false) && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
                    if (!userDiscounts.length) return null;
                    return (
                      <div className="mt-4 px-4 py-3 border border-maroon-200 rounded-xl bg-white">
                        <h4 className="text-sm font-semibold text-maroon-800 mb-2">Discount Options</h4>
                        <div className="space-y-2">
                          {userDiscounts.map((row) => {
                            const label = (row.data?.name as string) || 'User-selected discount';
                            const doc = (row.data?.documentation as string)
                              || (row.data?.required_documentation as string)
                              || (row.data?.approval_process as string)
                              || (row.data?.explanatory_text as string)
                              || (row.data?.note as string)
                              || '';
                            const checked = !!selectedUserDiscounts[row.id];
                            return (
                              <label key={row.id} className="flex items-start gap-2 text-sm text-maroon-800">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                                  checked={checked}
                                  onChange={(e) => setSelectedUserDiscounts(prev => ({ ...prev, [row.id]: e.target.checked }))}
                                />
                                <span>
                                  <div className="font-medium">{label}</div>
                                  {doc ? (
                                    <div className="text-xs text-maroon-600 mt-0.5 whitespace-pre-line">{doc}</div>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}

                {/* Quote Breakdown */}
                <div className="mt-4 px-4 py-3 border border-maroon-200 rounded-xl bg-white">
                  <div className="text-sm text-maroon-800">
                    {(() => {
                      try {
                        const hc = headcount ? Math.max(0, parseInt(headcount, 10)) : null;
                        const isHourly = mode === 'hourly';
                        const daysSelected = (() => {
                          if (!startDate || !endDate) return 0;
                          const s = new Date(`${startDate}T00:00:00`);
                          const e = new Date(`${endDate}T00:00:00`);
                          const diff = Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
                          return Math.max(1, Math.floor(diff) + 1);
                        })();
                        const appliedAdjustments = (orgAdjustments as any[]).filter(r => isAdjustmentApplied(r, appliedAdjustmentTokenSet));

                        const qb = (() => {
                          if (isHourly) {
                            if (!hourlySelection) return null;
                            if (!baseHourly) return null;
                            return computeQuote({
                              mode: 'hourly',
                              baseHourly,
                              startISO: hourlySelection.start,
                              endISO: hourlySelection.end,
                              timezone: propertyTimezone,
                              headcount: hc,
                              adjustments: appliedAdjustments as any,
                            });
                          }
                          if (daysSelected <= 0) return null;

                          const tier = pickBestTier(daysSelected);
                          if (!tier) return null;

                          if (tier.tier === 'daily') {
                            return computeQuote({
                              mode: 'daily',
                              baseDaily: derivedDailyRate ?? 0,
                              days: daysSelected,
                              timezone: propertyTimezone,
                              headcount: hc,
                              adjustments: appliedAdjustments as any,
                            });
                          }

                          return {
                            base: tier.cost,
                            adjustments: [] as QuoteAdjustment[],
                            total: tier.cost,
                            meta: {
                              tier: tier.tier,
                              spans: tier.spans,
                              effectiveRate: tier.effectiveRate,
                            },
                          };
                        })();

                        if (!qb) {
                          return isHourly
                            ? (!hourlySelection
                              ? <span>Select a time range to preview a quote.</span>
                              : <span>Hourly rate not set for this property.</span>)
                            : (daysSelected > 0 && daysSelected < minimumBookableDays && minimumBookingLabel
                              ? <span>Your selected date range is too short. The minimum booking length is {minimumBookingLabel}.</span>
                              : <span>Select a valid date range to preview a quote.</span>);
                        }

                        const rawAdjustments: QuoteAdjustment[] = Array.isArray(qb.adjustments) ? (qb.adjustments as QuoteAdjustment[]) : [];
                        const hasApplied = appliedArr.length > 0;
                        const qbAdjustments: QuoteAdjustment[] = hasApplied ? rawAdjustments : [];
                        // Base + approved org automatic adjustments subtotal
                        const subtotal = qb.base + qbAdjustments.reduce((sum: number, adj: QuoteAdjustment) => sum + adj.amount, 0);
                        // Apply any user-selected discounts next (only if those discounts are also applied on this property)
                        const selectedDiscountRows = (orgAdjustments as any[]) 
                          .filter(r => r.type === 'user_selected_discount' && selectedUserDiscounts[r.id] && appliedSet.has(r.id));
                        const userDiscountLines: { id: string; label: string; amount: number; note?: string }[] = selectedDiscountRows.map((row: any) => {
                          const label = (row.data?.name as string) || 'User-selected discount';
                          const rateType = (row.data?.rateType as 'percentage' | 'fixed') || 'percentage';
                          const value = Number(row.data?.value || 0);
                          const note = (row.data?.documentation as string)
                            || (row.data?.required_documentation as string)
                            || (row.data?.approval_process as string)
                            || (row.data?.explanatory_text as string)
                            || (row.data?.note as string) || undefined;
                          const amt = rateType === 'percentage' ? -(subtotal * (value / 100)) : -Math.abs(value);
                          const labelWithPct = rateType === 'percentage' && value > 0 ? `${label} (${value}%)` : label;
                          return { id: row.id, label: labelWithPct, amount: amt, note };
                        });
                        const subtotalWithUser = subtotal + userDiscountLines.reduce((s, l) => s + l.amount, 0);
                        // Fees and taxes are computed after discounts
                        const bookingFee = feeType === 'percentage' ? (qb.base * (feeValue / 100)) : feeValue;
                        const taxedBase = subtotalWithUser + bookingFee;
                        const taxAmount = (taxRate > 0) ? (taxedBase * (taxRate / 100)) : 0;
                        const grandTotal = taxedBase + taxAmount;
                        // Build base calculation display
                        let baseCalcLabel = '';
                        if (isHourly && hourlySelection && baseHourly) {
                          const ms = new Date(hourlySelection.end).getTime() - new Date(hourlySelection.start).getTime();
                          const hours = Math.max(0, ms / (1000 * 60 * 60));
                          const hoursLabel = (hours % 1 === 0) ? `${hours} hours` : `${hours.toFixed(2)} hours`;
                          baseCalcLabel = `$${baseHourly.toFixed(2)} x ${hoursLabel}`;
                        } else if (!isHourly) {
                          const tier = (qb as any)?.meta?.tier as PricingTier | undefined;
                          const spans = (qb as any)?.meta?.spans as number | undefined;
                          baseCalcLabel = describeBaseCalculation(tier, spans, daysSelected, qb.base);
                        }
                        // Longer-term discount line (percentage types)
                        let longTermLine: { label: string; amount: number } | null = null;
                        if (!isHourly && derivedDailyRate && ((qb as any)?.meta?.tier === 'daily' || !(qb as any)?.meta?.tier)) {
                          const baseGross = derivedDailyRate * daysSelected;
                          if (yearlyRateType === 'percentage' && yearlyRateValue > 0 && daysSelected >= 365) {
                            longTermLine = { label: `${yearlyRateValue}% yearly discount`, amount: - (baseGross * (yearlyRateValue / 100)) };
                          } else if (monthlyRateType === 'percentage' && monthlyRateValue > 0 && daysSelected >= 30) {
                            longTermLine = { label: `${monthlyRateValue}% monthly discount`, amount: - (baseGross * (monthlyRateValue / 100)) };
                          } else if (weeklyRateType === 'percentage' && weeklyRateValue > 0 && daysSelected >= 7) {
                            longTermLine = { label: `${weeklyRateValue}% weekly discount`, amount: - (baseGross * (weeklyRateValue / 100)) };
                          }
                        }
                        // Save debug snapshot without triggering re-render
                        try {
                          const debugAppliedArr = Array.isArray(appliedAdjustmentTokens) ? appliedAdjustmentTokens : [];
                          const debugAppliedSet = new Set(debugAppliedArr);
                          const hasHeadcountPanel = (() => {
                            const cap = (orgAdjustments as any[]).find(r => r.type === 'capacity_surcharge' && ((r.data?.active ?? true) !== false));
                            return !!cap && isAdjustmentApplied(cap, debugAppliedSet);
                          })();
                          const hasDiscountPanel = (orgAdjustments as any[]).some(r => r.type === 'user_selected_discount' && isAdjustmentApplied(r, debugAppliedSet));
                          const filteredForDebug = (qb.adjustments || []).filter((l: QuoteAdjustment) => debugAppliedSet.has(l.id)).slice(0,50);
                          debugInfoRef.current = {
                            appliedIds: debugAppliedArr,
                            orgAdjustments: (orgAdjustments as any[]).map(r => ({ id: r.id, type: r.type, name: r.data?.name })).slice(0,50),
                            qbAdjustments: (qb.adjustments || []).slice(0,50),
                            filteredAdjustments: filteredForDebug,
                            mode,
                            hasHeadcountPanel,
                            hasDiscountPanel,
                            selection: mode === 'hourly' ? hourlySelection : { startDate, endDate },
                          };
                        } catch {}
                        return (
                          <div className="space-y-1">
                            <div className="flex justify-between"><span>Base ({baseCalcLabel})</span><span>{'$' + qb.base.toFixed(2)}</span></div>
                            {qbAdjustments.length > 0 && (
                              <div className="space-y-1">
                                {qbAdjustments.map((l: QuoteAdjustment) => {
                                  const src = (orgAdjustments as any[]).find(r => r.id === l.id);
                                  const note: string | undefined = src?.data?.note || src?.data?.explanatory_text || undefined;
                                  const displayLabel = (src?.data?.name as string) || l.label;
                                  return (
                                    <div key={l.id} className="flex justify-between">
                                      <span>
                                        {displayLabel}
                                        {note ? (
                                          <Tooltip content={<div className="max-w-xs whitespace-normal">{note}</div>}>
                                            <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                                          </Tooltip>
                                        ) : null}
                                      </span>
                                      <span>{(l.amount < 0 ? '-$' : '$') + Math.abs(l.amount).toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {userDiscountLines.length > 0 && (
                              <div className="space-y-1">
                                {userDiscountLines.map((l: { id: string; label: string; amount: number; note?: string }) => (
                                  <div key={l.id} className="flex justify-between">
                                    <span>
                                      {l.label}
                                      {l.note ? (
                                        <Tooltip content={<div className="max-w-xs whitespace-normal">{l.note}</div>}>
                                          <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                                        </Tooltip>
                                      ) : null}
                                    </span>
                                    <span>{(l.amount < 0 ? '-$' : '$') + Math.abs(l.amount).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {longTermLine && (
                              <div className="flex justify-between">
                                <span>{longTermLine.label}</span>
                                <span>{'-$' + Math.abs(longTermLine.amount).toFixed(2)}</span>
                              </div>
                            )}
                            {bookingFee > 0 && (
                              <div className="flex justify-between">
                                <span>{feeDescription ? feeDescription : 'Booking fee'}</span>
                                <span>{'$' + bookingFee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between"><span>Tax{taxRate ? ` (${taxRate}%)` : ''}</span><span>{'$' + taxAmount.toFixed(2)}</span></div>
                            <div className="mt-1 font-semibold flex justify-between"><span>Estimated Total</span><span>{'$' + grandTotal.toFixed(2)}</span></div>
                            <div className="text-xs text-maroon-600">This is an estimate; final quote may vary.</div>
                          </div>
                        );
                      } catch { return null; }
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {mode === 'daily' && hasDaily && (
            <>
              {/* Estimated Headcount (only if capacity surcharge is active AND applied to this property) */}
              {(() => {
                try {
                  const cap = (orgAdjustments as any[]).find(r => r.type === 'capacity_surcharge' && ((r.data?.active ?? true) !== false));
                  const show = !!cap && isAdjustmentApplied(cap, appliedAdjustmentTokenSet);
                  if (!show) return null;
                  return (
                    <div className="mt-4 px-4 pt-4 pb-3 border border-maroon-200 rounded-xl bg-white">
                      {error && error.includes('capacity') && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-3">
                          {error}
                        </div>
                      )}
                      <label className="block text-sm font-medium text-[#620E28] mb-1">
                        Estimated Headcount
                        <Tooltip content={<div className="max-w-xs whitespace-normal">For this booking, a surcharge may apply based on attendance</div>}>
                          <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        value={headcount}
                        onChange={(e) => {
                          const newHeadcount = e.target.value;
                          const headcountNum = parseInt(newHeadcount);
                          
                          // Check if capacity surcharge is active and property has capacity limit
                          const hasCapacitySurcharge = orgAdjustments.some(adj => 
                            adj.type === 'capacity_surcharge' && isAdjustmentApplied(adj, appliedAdjustmentTokenSet)
                          );
                          
                          if (hasCapacitySurcharge && propertyCapacity && headcountNum > propertyCapacity) {
                            setError(`Property's maximum capacity is ${propertyCapacity}`);
                            return;
                          }
                          
                          setError(null);
                          setHeadcount(newHeadcount);
                        }}
                        className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                        placeholder="e.g., 60"
                        min={0}
                      />
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Discount Options (user-selected) — only if applied on this property */}
              {(() => {
                try {
                  const userDiscounts = (orgAdjustments as any[])
                    .filter(r => r.type === 'user_selected_discount' && ((r.data?.active ?? true) !== false) && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
                  if (!userDiscounts.length) return null;
                  return (
                    <div className="mt-4 px-4 py-3 border border-maroon-200 rounded-xl bg-white">
                      <h4 className="text-sm font-semibold text-maroon-800 mb-2">Discount Options</h4>
                      <div className="space-y-2">
                        {userDiscounts.map((row: any) => {
                          const label = (row.data?.name as string) || 'User-selected discount';
                          const doc = (row.data?.documentation as string)
                            || (row.data?.required_documentation as string)
                            || (row.data?.approval_process as string)
                            || (row.data?.explanatory_text as string)
                            || (row.data?.note as string)
                            || '';
                          const checked = !!selectedUserDiscounts[row.id];
                          return (
                            <label key={row.id} className="flex items-start gap-2 text-sm text-maroon-800">
                              <input
                                type="checkbox"
                                className="mt-1 rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                                checked={checked}
                                onChange={(e) => setSelectedUserDiscounts(prev => ({ ...prev, [row.id]: e.target.checked }))}
                              />
                              <span>
                                <div className="font-medium">{label}</div>
                                {doc ? (
                                  <div className="text-xs text-maroon-600 mt-0.5 whitespace-pre-line">{doc}</div>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Quote Breakdown */}
              <div className="mt-4 px-4 py-3 border border-maroon-200 rounded-xl bg-white">
                <div className="text-sm text-maroon-800">
                  {(() => {
                    try {
                      const hc = headcount ? Math.max(0, parseInt(headcount, 10)) : null;
                      const daysSelected = (() => {
                        if (!startDate || !endDate) return 0;
                        const start = new Date(`${startDate}T00:00:00`);
                        const end = new Date(`${endDate}T00:00:00`);
                        const diff = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        return Math.max(1, Math.floor(diff) + 1);
                      })();

                      if (daysSelected <= 0) {
                        return <span>Select a valid date range to preview a quote.</span>;
                      }

                      const appliedAdjustments = (orgAdjustments as any[]).filter((row) => isAdjustmentApplied(row, appliedAdjustmentTokenSet));

                      const tier = pickBestTier(daysSelected);
                      if (!tier) {
                        return <span>Select a valid date range to preview a quote.</span>;
                      }

                      const quote: QuoteBreakdown = tier.tier === 'daily'
                        ? computeQuote({
                          mode: 'daily',
                          baseDaily: derivedDailyRate ?? 0,
                          days: daysSelected,
                          timezone: propertyTimezone,
                          headcount: hc,
                          adjustments: appliedAdjustments as any,
                        })
                        : {
                          base: tier.cost,
                          adjustments: [] as QuoteAdjustment[],
                          total: tier.cost,
                          meta: {
                            mode: 'daily',
                            baseDaily: derivedDailyRate,
                            appliedAdjustmentIds: appliedArr,
                            tier: tier.tier,
                            spans: tier.spans,
                            effectiveRate: tier.effectiveRate,
                          } as QuoteBreakdown['meta'],
                        };

                      const rawAdjustments: QuoteAdjustment[] = Array.isArray(quote.adjustments)
                        ? (quote.adjustments as QuoteAdjustment[])
                        : [];
                      const qbAdjustments: QuoteAdjustment[] = appliedArr.length > 0
                        ? rawAdjustments.filter((adj) => appliedSet.has(adj.id))
                        : [];

                      const subtotal = quote.base + qbAdjustments.reduce((sum: number, adj: QuoteAdjustment) => sum + adj.amount, 0);

                      const selectedDiscountRows = (orgAdjustments as any[])
                        .filter((row) => row.type === 'user_selected_discount' && selectedUserDiscounts[row.id] && appliedSet.has(row.id));
                      const userDiscountLines: { id: string; label: string; amount: number; note?: string }[] = selectedDiscountRows.map((row: any) => {
                        const label = (row.data?.name as string) || 'User-selected discount';
                        const rateType = (row.data?.rateType as 'percentage' | 'fixed') || 'percentage';
                        const value = Number(row.data?.value || 0);
                        const note = (row.data?.documentation as string)
                          || (row.data?.required_documentation as string)
                          || (row.data?.approval_process as string)
                          || (row.data?.explanatory_text as string)
                          || (row.data?.note as string) || undefined;
                        const amount = rateType === 'percentage' ? -(subtotal * (value / 100)) : -Math.abs(value);
                        const labelWithPct = rateType === 'percentage' && value > 0 ? `${label} (${value}%)` : label;
                        return { id: row.id, label: labelWithPct, amount, note };
                      });

                      const subtotalWithUser = subtotal + userDiscountLines.reduce((sum, line) => sum + line.amount, 0);
                      const bookingFee = feeType === 'percentage' ? (quote.base * (feeValue / 100)) : feeValue;
                      const taxedBase = subtotalWithUser + bookingFee;
                      const taxAmount = taxRate > 0 ? (taxedBase * (taxRate / 100)) : 0;
                      const grandTotal = taxedBase + taxAmount;

                      const calcLabel = describeBaseCalculation(
                        (quote as any)?.meta?.tier as PricingTier | undefined,
                        (quote as any)?.meta?.spans as number | undefined,
                        daysSelected,
                        quote.base,
                      );

                      let longTermLine: { label: string; amount: number } | null = null;
                      if (derivedDailyRate != null && ((quote as any)?.meta?.tier === 'daily' || !(quote as any)?.meta?.tier)) {
                        const baseGross = derivedDailyRate * daysSelected;
                        if (yearlyRateType === 'percentage' && yearlyRateValue > 0 && daysSelected >= 365) {
                          longTermLine = { label: `${yearlyRateValue}% yearly discount`, amount: -(baseGross * (yearlyRateValue / 100)) };
                        } else if (monthlyRateType === 'percentage' && monthlyRateValue > 0 && daysSelected >= 30) {
                          longTermLine = { label: `${monthlyRateValue}% monthly discount`, amount: -(baseGross * (monthlyRateValue / 100)) };
                        } else if (weeklyRateType === 'percentage' && weeklyRateValue > 0 && daysSelected >= 7) {
                          longTermLine = { label: `${weeklyRateValue}% weekly discount`, amount: -(baseGross * (weeklyRateValue / 100)) };
                        }
                      }

                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between"><span>Base ({calcLabel})</span><span>{`$${quote.base.toFixed(2)}`}</span></div>
                          {qbAdjustments.length > 0 && (
                            <div className="space-y-1">
                              {qbAdjustments.map((adj) => {
                                const src = (orgAdjustments as any[]).find((row) => row.id === adj.id);
                                const note: string | undefined = src?.data?.note || src?.data?.explanatory_text || undefined;
                                const displayLabel = (src?.data?.name as string) || adj.label;
                                const displayAmount = `${adj.amount < 0 ? '-' : ''}$${Math.abs(adj.amount).toFixed(2)}`;
                                return (
                                  <div key={adj.id} className="flex justify-between">
                                    <span>
                                      {displayLabel}
                                      {note ? (
                                        <Tooltip content={<div className="max-w-xs whitespace-normal">{note}</div>}>
                                          <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                                        </Tooltip>
                                      ) : null}
                                    </span>
                                    <span>{displayAmount}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {userDiscountLines.length > 0 && (
                            <div className="space-y-1">
                              {userDiscountLines.map((line) => {
                                const displayAmount = `${line.amount < 0 ? '-' : ''}$${Math.abs(line.amount).toFixed(2)}`;
                                return (
                                  <div key={line.id} className="flex justify-between">
                                    <span>
                                      {line.label}
                                      {line.note ? (
                                        <Tooltip content={<div className="max-w-xs whitespace-normal">{line.note}</div>}>
                                          <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-maroon-400 align-middle" />
                                        </Tooltip>
                                      ) : null}
                                    </span>
                                    <span>{displayAmount}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {longTermLine && (
                            <div className="flex justify-between">
                              <span>{longTermLine.label}</span>
                              <span>{`-$${Math.abs(longTermLine.amount).toFixed(2)}`}</span>
                            </div>
                          )}
                          {bookingFee > 0 && (
                            <div className="flex justify-between">
                              <span>{feeDescription || 'Booking fee'}</span>
                              <span>{`$${bookingFee.toFixed(2)}`}</span>
                            </div>
                          )}
                          <div className="flex justify-between"><span>Tax{taxRate ? ` (${taxRate}%)` : ''}</span><span>{`$${taxAmount.toFixed(2)}`}</span></div>
                          <div className="mt-1 font-semibold flex justify-between"><span>Estimated Total</span><span>{`$${grandTotal.toFixed(2)}`}</span></div>
                          <div className="text-xs text-maroon-600">This is an estimate; final quote may vary.</div>
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              </div>
            </>
          )}

          {!user && (
            <div
              className="relative grid gap-4 md:grid-cols-2"
              onMouseEnter={() => {
                // Cancel any pending hide and show unless dismissed
                if (hideLoginPromptTimer.current) {
                  window.clearTimeout(hideLoginPromptTimer.current);
                  hideLoginPromptTimer.current = null;
                }
                try {
                  const dismissed = localStorage.getItem('dismissLoginPrompt') === '1';
                  if (!dismissed) setShowLoginPrompt(true);
                } catch { setShowLoginPrompt(true); }
              }}
              onMouseLeave={() => {
                // Hide with a short delay so users can move the cursor to the prompt
                if (hideLoginPromptTimer.current) window.clearTimeout(hideLoginPromptTimer.current);
                hideLoginPromptTimer.current = window.setTimeout(() => {
                  setShowLoginPrompt(false);
                  hideLoginPromptTimer.current = null;
                }, 400);
              }}
            >
              {/* Floating sign-in prompt */}
              {showLoginPrompt && !user && (
                <div
                  className="absolute -top-10 left-2 z-50"
                  onMouseEnter={() => {
                    if (hideLoginPromptTimer.current) {
                      window.clearTimeout(hideLoginPromptTimer.current);
                      hideLoginPromptTimer.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    if (hideLoginPromptTimer.current) window.clearTimeout(hideLoginPromptTimer.current);
                    hideLoginPromptTimer.current = window.setTimeout(() => {
                      setShowLoginPrompt(false);
                      hideLoginPromptTimer.current = null;
                    }, 300);
                  }}
                >
                  <div className="relative bg-white text-maroon-900 border border-maroon-200 shadow-lg rounded-lg px-3 py-2 text-sm">
                    <button
                      type="button"
                      aria-label="Dismiss"
                      title="Dismiss"
                      onClick={() => {
                        setShowLoginPrompt(false);
                        try { localStorage.setItem('dismissLoginPrompt', '1'); } catch {}
                      }}
                      className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-maroon-700 text-white text-sm font-bold flex items-center justify-center shadow-lg ring-2 ring-white border border-maroon-800 hover:bg-maroon-800 focus:outline-none focus:ring-4 focus:ring-maroon-300"
                    >
                      ×
                    </button>
                    <div className="whitespace-nowrap">
                      Do you have an account?{' '}
                      <a
                        href={`/signin?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                        className="underline font-medium hover:text-maroon-700"
                      >
                        Sign in
                      </a>
                    </div>
                    {/* Arrow */}
                    <div className="absolute left-4 -bottom-1 h-3 w-3 bg-white border-b border-r border-maroon-200 rotate-45"></div>
                  </div>
                </div>
              )}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-[#620E28] mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  placeholder="Jane Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-[#620E28] mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  placeholder="you@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
          )}

          {/* Survey disabled for art portfolio — see SURVEY_DISABLED.md */}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            size="lg"
            isLoading={loading}
            icon={<Send className="h-5 w-5 mr-2" />}
          >
            Submit Inquiry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default InquiryForm;