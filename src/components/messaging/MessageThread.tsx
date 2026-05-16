import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, ArrowLeft, ReceiptText, X, RefreshCw, CreditCard, Lock, Home, Archive, ArchiveRestore, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import { Card } from '../ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatDate, calculateDays, formatCurrency } from '../../lib/utils';
import { computeQuote } from '../../lib/pricing';
import { sendNotification } from '../../lib/notifications';
import { isAdjustmentApplied, parseAppliedAdjustmentTokens } from '../../lib/adjustments';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface MessageThreadProps {
  inquiryId: string;
  onClose?: () => void;
  onInquiryStatusChange?: () => void; // Add callback for status changes
}

const MessageThread: React.FC<MessageThreadProps> = ({ inquiryId, onClose, onInquiryStatusChange }) => {
  const { user, refreshSession } = useAuth();
  // Use a loosely typed alias to avoid Postgrest generics causing TS 'never' issues on insert/update.
  const sb: any = supabase;
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [sending, setSending] = useState(false); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemMessages, setSystemMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inquiry, setInquiry] = useState<any>(null);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  const [approvalFormError, setApprovalFormError] = useState<string | null>(null);
  const [approvalForm, setApprovalForm] = useState({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    basePrice: 0,
    taxes: 0,
    fees: 0,
    feeLabel: '',
    taxRate: 0,
    adjustments: [] as Array<{ id: string; label: string; amount: number }>,
    headcount: '' as string | number,
    // Optional hourly timestamps (ISO). If provided, backend will create an hourly booking.
    startAt: '',
    endAt: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  // Track which user-selected discounts are enabled in the modal
  const [selectedDiscountEnabled, setSelectedDiscountEnabled] = useState<Record<string, boolean>>({});
  // Whether to render hourly time inputs
  const [showTimeInputs, setShowTimeInputs] = useState(false);
  // Whether capacity surcharge is active for this org/listing
  const [showHeadcount, setShowHeadcount] = useState(false);

  // Recompute base, adjustments, and taxes using computeQuote when dates/times/headcount/fees change
  const recomputeQuoteInModal = async (next: Partial<typeof approvalForm>) => {
    try {
      const ownerOrgId = inquiry?.property?.profiles?.primary_organization_id;
      const draft = { ...approvalForm, ...next } as typeof approvalForm;
      const hasTimes = !!draft.startTime && !!draft.endTime;
      const baseHourly = Number(inquiry?.property?.price_per_hour || 0);
      const baseDaily = Number(inquiry?.property?.price_per_day || 0);
      const taxRate = Number(inquiry?.property?.tax_rate || 0);

      const toISO = (d?: string, t?: string) => (d && t) ? new Date(`${d}T${t}:00`).toISOString() : '';
      const startISO = toISO(draft.startDate, draft.startTime);
      const endISO = toISO(draft.endDate, draft.endTime);

      let qb: any = null;
      let basePrice = 0;
      if (hasTimes && baseHourly > 0) {
        // Hourly quote
        const { data: orgRows } = ownerOrgId ? await supabase
          .from('organization_adjustments')
          .select('id, type, data, sort_order')
          .eq('organization_id', ownerOrgId)
          .order('sort_order', { ascending: true, nullsFirst: true }) : { data: [] } as any;
        const hc = (next.headcount !== undefined && next.headcount !== '')
          ? Number(next.headcount as any)
          : (approvalForm.headcount !== '' ? Number(approvalForm.headcount as any) : null);
        qb = computeQuote({
          mode: 'hourly',
          baseHourly,
          startISO,
          endISO,
          timezone: null as any,
          headcount: hc,
          adjustments: (orgRows as any[]) || [],
        });
        basePrice = Number(qb.base || 0);
      } else {
        // Daily fallback (inclusive day count)
        const rawDays = draft.startDate && draft.endDate ? calculateDays(draft.startDate, draft.endDate) : 0;
        const days = Math.max(1, rawDays + (draft.startDate && draft.endDate && draft.startDate !== draft.endDate ? 1 : 0));
        basePrice = baseDaily * days;
        const { data: orgRows } = ownerOrgId && days > 0 ? await supabase
          .from('organization_adjustments')
          .select('id, type, data, sort_order')
          .eq('organization_id', ownerOrgId)
          .order('sort_order', { ascending: true, nullsFirst: true }) : { data: [] } as any;
        if (days > 0) {
          const hc = (next.headcount !== undefined && next.headcount !== '')
            ? Number(next.headcount as any)
            : (approvalForm.headcount !== '' ? Number(approvalForm.headcount as any) : null);
          qb = computeQuote({
            mode: 'daily',
            baseDaily,
            days,
            timezone: null as any,
            headcount: hc,
            adjustments: (orgRows as any[]) || [],
          });
        }
      }

      // Build adjustment lines
      let adjLines: Array<{ id: string; label: string; amount: number }> = [];
      if (qb) {
        // fetch for labels
        const orgRowsAll: any[] = [];
        try {
          if (ownerOrgId) {
            const { data } = await supabase
              .from('organization_adjustments')
              .select('id, data, type')
              .eq('organization_id', ownerOrgId);
            if (data) orgRowsAll.push(...(data as any[]));
          }
        } catch {}
        // Track user-selectable ids by type and whether capacity surcharge is configured AND applied on this listing
        const selectable = new Set<string>();
        let hasCapacity = false;
        const tokenPart = parseAppliedAdjustmentTokens((inquiry?.property as any)?.applied_adjustment_tokens);
        const idPart = parseAppliedAdjustmentTokens(inquiry?.property?.applied_adjustment_ids);
        const appliedTokens = Array.from(new Set([...tokenPart, ...idPart]));
        const appliedTokenSet = new Set(appliedTokens);
        const haveAppliedGate = appliedTokens.length > 0;
        const capacityIds = new Set<string>();
        for (const r of orgRowsAll) {
          const rData = (r?.data ?? {}) as Record<string, any>;
          if (r?.type === 'user_selected_discount' || rData.userSelectable === true || rData.allowUserToggle === true) selectable.add(r.id);
          if (r?.type === 'capacity_surcharge') {
            capacityIds.add(r.id);
            if (haveAppliedGate && isAdjustmentApplied(r, appliedTokenSet)) hasCapacity = true;
          }
        }
        // If there is no applied list on the property, but the org has a capacity surcharge and the quote produced a capacity line, show headcount.
        if (!haveAppliedGate && (qb.adjustments || []).some((l: any) => capacityIds.has(l.id))) {
          hasCapacity = true;
        }
        // Or if there's no applied list at all, but org has at least one capacity adjustment, default to showing headcount to avoid missing required input.
        if (!haveAppliedGate && capacityIds.size > 0) {
          hasCapacity = true;
        }
        setShowHeadcount(hasCapacity);
        // Only include adjustments that are backed by active org adjustments AND applied on this property
        adjLines = (qb.adjustments || [])
          .map((l: any) => {
            const src = (orgRowsAll || []).find((r: any) => r.id === l.id);
            if (!src) return null; // drop if not active in org
            // For non-user-selected adjustments, require that the property has this adjustment applied when we have an applied list.
            if (src.type !== 'user_selected_discount' && haveAppliedGate && !isAdjustmentApplied(src, appliedTokenSet)) return null;
            const label = (src?.data?.name as string) || l.label;
            return { id: l.id, label: Math.round(l.amount * 100) / 100 === 0 ? (src?.data?.name as string) || l.label : label, amount: Math.round(l.amount * 100) / 100 };
          })
          .filter(Boolean) as Array<{ id: string; label: string; amount: number }>;

        // Merge user-selected discount ids saved on inquiry (respect checkbox state)
        const selectedIds: string[] = Array.isArray(inquiry?.selected_adjustment_ids) ? inquiry.selected_adjustment_ids : [];
        if (selectedIds.length > 0) {
          const subtotal = Number(qb.total || 0);
          for (const id of selectedIds) {
            if (selectedDiscountEnabled && selectedDiscountEnabled[id] === false) continue;
            const row = (orgRowsAll || []).find((r: any) => r.id === id);
            if (!row) continue;
            const rowData = (row.data ?? {}) as Record<string, any>;
            const name = (rowData.name as string) || 'User-selected discount';
            const typ = row.type;
            if (typ === 'user_selected_discount') {
              const rateType: 'percentage' | 'fixed' = (rowData.rateType as 'percentage' | 'fixed') || 'percentage';
              const value = Number(rowData.value || 0);
              const sign = -1; // discount
              const amt = rateType === 'percentage' ? subtotal * (value / 100) * sign : value * sign;
              adjLines.push({ id, label: name, amount: Math.round(amt * 100) / 100 });
            }
          }
        }
        // If no selected ids saved, still allow toggling for user-selectable lines: initialize map if missing
        if (selectedIds.length === 0 && selectable.size > 0) {
          setSelectedDiscountEnabled(prev => {
            const next = { ...prev } as Record<string, boolean>;
            for (const id of selectable) if (!(id in next)) next[id] = false; // default off
            return next;
          });
        }
      }

      // Compute fees from property settings
      const feeType = inquiry.property?.fee_type || 'percentage';
      const feeValue = Number(inquiry.property?.fee_value || 0);
      let fees = 0;
      if (feeValue > 0) {
        fees = feeType === 'percentage' ? Math.round(basePrice * (feeValue / 100)) : feeValue;
      }

      // Recompute taxes on (base + adjustments + fees) with cents precision
      const interim = basePrice + adjLines.reduce((s, l) => s + l.amount, 0) + fees;
      const taxCents = taxRate > 0 ? Math.round(interim * (taxRate / 100) * 100) : 0;
      const newTaxes = taxCents / 100;

      // If times present, set startAt/endAt for edge function
      const nextForm = {
        ...draft,
        basePrice,
        adjustments: adjLines,
        fees,
        taxes: newTaxes,
        startAt: startISO || draft.startAt,
        endAt: endISO || draft.endAt,
      } as typeof approvalForm;
      setApprovalForm(nextForm);
    } catch {}
  };

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    loadMessages();
    
    // Set up real-time subscription only if we have access
    const channel = supabase.channel(`messages:${inquiryId}`);
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Only add the message if it's not from the current user
          if (newMessage.sender_id !== user.id) {
            setMessages(current => [...current, newMessage]);
            
            // Update inquiry status if needed
            if (inquiry?.status === 'pending') {
              const { error } = await supabase
                .from('inquiries')
                .update({
                  status: 'responded',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', inquiryId);
              
              if (error) {
                console.error('Error updating inquiry status:', error);
              } else {
                // Notify parent component about status change
                onInquiryStatusChange?.();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [inquiryId, user?.id, inquiry?.status, onInquiryStatusChange, navigate]);

  const loadMessages = async () => {
    try {
      // Verify authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        setError('Authentication error. Please sign in again.');
        return;
      }
      
      if (!session || !session.user) {
        setError('No active session. Please sign in again.');
        return;
      }

      console.log('Current user ID:', session.user.id);
      console.log('Requested inquiry ID:', inquiryId);

      // First, try to fetch the inquiry with minimal data to check permissions
      const { data: basicInquiryArray, error: basicError } = await sb
        .from('inquiries')
        .select('id, user_id, property_id, status')
        .eq('id', inquiryId)
        .limit(1);

      if (basicError) {
        console.error('Basic inquiry query error:', basicError);
        setError(`Database error: ${basicError.message}`);
        return;
      }

      const basicInquiry = basicInquiryArray?.[0] || null;

      if (!basicInquiry) {
        console.log('No inquiry found with basic query - likely RLS access denied');
        setAccessDenied(true);
        return;
      }

      console.log('Basic inquiry found:', basicInquiry);

      // Now load inquiry details with separate queries to avoid timeout
      const { data: inquiryDataArray, error: inquiryError } = await sb
        .from('inquiries')
        .select('*')
        .eq('id', inquiryId)
        .limit(1);

      if (inquiryError) {
        console.error('Inquiry query error:', inquiryError);
        setError(`Failed to load inquiry details: ${inquiryError.message}`);
        return;
      }

      const inquiryData = (inquiryDataArray as any)?.[0] || null;

      if (!inquiryData) {
        console.error('No inquiry found');
        setError('Inquiry not found');
        return;
      }

      // Load property data separately
      let propertyData = null;
      if (inquiryData.property_id) {
        const { data: propertyArray, error: propertyError } = await sb
          .from('properties')
          .select(`
            id,
            title,
            venue_id,
            price_per_day,
            price_per_hour,
            tax_rate,
            fee_type,
            fee_value,
            fee_description,
            applied_adjustment_ids,
            applied_adjustment_tokens,
            weekly_rate_type,
            weekly_rate_value,
            monthly_rate_type,
            monthly_rate_value,
            yearly_rate_type,
            yearly_rate_value
          `)
          .eq('id', inquiryData.property_id)
          .limit(1);
        
        if (!propertyError && propertyArray) {
          propertyData = propertyArray[0];
        }
      }

      // Load proposals separately
      let proposalsData = [];
      const { data: proposalsArray, error: proposalsError } = await sb
        .from('proposals')
        .select(`
          id, 
          price_total, 
          currency, 
          expires_at
        `)
        .eq('inquiry_id', inquiryId);

      if (!proposalsError && proposalsArray) {
        proposalsData = proposalsArray;
      }

      // Load user data separately
      let userData = null;
      if (inquiryData.user_id) {
        const { data: userArray, error: userError } = await sb
          .from('profiles')
          .select('full_name')
          .eq('id', inquiryData.user_id)
          .limit(1);

        if (!userError && userArray) {
          userData = userArray[0];
        }
      }

      // Combine all data
      const combinedInquiryData = {
        ...inquiryData,
        property: propertyData,
        proposals: proposalsData,
        user: userData
      };

      if (!combinedInquiryData) {
        setError('Failed to load complete inquiry data');
        return;
      }

      setInquiry(combinedInquiryData);

      // Determine if current user is a member of the venue owner's organization
      try {
        const ownerOrgId = combinedInquiryData?.property?.profiles?.primary_organization_id;
        if (ownerOrgId && session.user?.id) {
          const { data: memRows, error: memErr } = await sb
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', ownerOrgId)
            .eq('user_id', session.user.id)
            .limit(1);
          if (!memErr) {
            setIsOrgMember((memRows || []).length > 0);
          } else {
            setIsOrgMember(false);
          }
        } else {
          setIsOrgMember(false);
        }
      } catch {
        setIsOrgMember(false);
      }

      // Create system messages from inquiry details
      const systemMsgs: Message[] = [];

      // Decide whether to show daily dates or hourly times
      const hasHourly = Boolean(inquiryData.start_at && inquiryData.end_at);
      if (hasHourly) {
        try {
          const s = new Date(inquiryData.start_at);
          const e = new Date(inquiryData.end_at);
          
          const fmt: Intl.DateTimeFormatOptions = { 
            month: 'short', 
            day: '2-digit', 
            year: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true // Use 12-hour format
          };
          // Use user's locale and timezone
          const sStr = s.toLocaleString(undefined, fmt);
          const eStr = e.toLocaleString(undefined, fmt);
          
          const timeLabel = inquiryData.status === 'converted_to_proposal' || inquiryData.status === 'payment_completed' 
            ? 'Proposed Time (Local):' 
            : 'Requested Time (Local):';
          
          systemMsgs.push({
            id: 'times',
            sender_id: inquiryData.user_id,
            content: `${timeLabel}\n${sStr} - ${eStr}`,
            created_at: inquiryData.created_at
          });
        } catch {}
      } else if (inquiryData.start_date || inquiryData.end_date) {
        let dateMsg = 'Requested dates: ';
        if (inquiryData.start_date) {
          dateMsg += formatDate(inquiryData.start_date);
        }
        if (inquiryData.end_date) {
          dateMsg += ' to ' + formatDate(inquiryData.end_date);
        }
        systemMsgs.push({
          id: 'dates',
          sender_id: inquiryData.user_id,
          content: dateMsg,
          created_at: inquiryData.created_at
        });
      }

      // Load organization adjustments for labeling and capacity detection
      let orgAdjustments: Array<{ id: string; type: string; data: any }> = [];
      try {
        const ownerOrgId = inquiryData?.property?.profiles?.primary_organization_id;
        if (ownerOrgId) {
          const { data: orgRows } = await sb
            .from('organization_adjustments')
            .select('id, type, data')
            .eq('organization_id', ownerOrgId);
          orgAdjustments = (orgRows as any[]) || [];
        }
      } catch {}

      // If capacity surcharge is applied on this property and headcount exists, add Estimated Headcount
      try {
        const tokenPart = parseAppliedAdjustmentTokens((inquiryData?.property as any)?.applied_adjustment_tokens);
        const idPart = parseAppliedAdjustmentTokens(inquiryData?.property?.applied_adjustment_ids);
        const applied = Array.from(new Set([...tokenPart, ...idPart]));
        const appliedSet = new Set(applied);
        const hasCapacityApplied = orgAdjustments.some((row) => row.type === 'capacity_surcharge' && isAdjustmentApplied(row, appliedSet));
        const headcount = inquiryData?.headcount;
        if (hasCapacityApplied && typeof headcount === 'number' && Number.isFinite(headcount) && headcount > 0) {
          systemMsgs.push({
            id: 'headcount',
            sender_id: inquiryData.user_id,
            content: `Estimated Headcount:\n${headcount}`,
            created_at: inquiryData.created_at
          });
        }
      } catch {}

      // If user-selected discounts were requested, add a message per discount: "[Name]: requested"
      try {
        const selected: string[] = Array.isArray(inquiryData?.selected_adjustment_ids)
          ? inquiryData.selected_adjustment_ids
          : [];
        if (selected.length > 0 && orgAdjustments.length > 0) {
          for (const id of selected) {
            const row = orgAdjustments.find((r) => r.id === id && r.type === 'user_selected_discount');
            if (!row) continue;
            const name = (row.data?.name as string) || 'User-selected discount';
            systemMsgs.push({
              id: `usd-${id}`,
              sender_id: inquiryData.user_id,
              content: `${name}:\nrequested`,
              created_at: inquiryData.created_at
            });
          }
        }
      } catch {}

      // Add proposal price summary if a proposal exists
      try {
        const proposals = (combinedInquiryData as any)?.proposals || [];
        if (proposals.length > 0) {
          const proposal = proposals[0]; // Take the first proposal
          const currency = proposal.currency || 'USD';
          const total = Number(proposal.price_total) || 0;
          
          // Calculate detailed price breakdown using the same logic as PriceSummary
          const property = (combinedInquiryData as any)?.property;
          
          if (!property) {
            return;
          }
          
          let basePrice = 0;
          let adjustments: Array<{ label: string; amount: number; type?: 'discount' | 'surcharge' }> = [];
          let taxRate = 0;
          let subtotal = total;
          
          // Calculate base price
          if (property.price_per_hour && inquiryData.start_at && inquiryData.end_at) {
            const startTime = new Date(inquiryData.start_at);
            const endTime = new Date(inquiryData.end_at);
            const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            basePrice = property.price_per_hour * hours;
          } else if (property.price_per_day && inquiryData.start_date && inquiryData.end_date) {
            const rawDays = calculateDays(inquiryData.start_date, inquiryData.end_date);
            const days = Math.max(1, rawDays + (inquiryData.start_date !== inquiryData.end_date ? 1 : 0));
            basePrice = property.price_per_day * days;
          }
          
          // Get adjustments from organization
          if (orgAdjustments.length > 0) {
            // Calculate adjustments
            const quote = computeQuote({
              mode: property.price_per_hour ? 'hourly' : 'daily',
              baseHourly: property.price_per_hour || 0,
              baseDaily: property.price_per_day || 0,
              startISO: property.price_per_hour ? inquiryData.start_at : undefined,
              endISO: property.price_per_hour ? inquiryData.end_at : undefined,
              days: property.price_per_day ? Math.max(1, calculateDays(inquiryData.start_date, inquiryData.end_date) + (inquiryData.start_date !== inquiryData.end_date ? 1 : 0)) : 0,
              timezone: null as any,
              headcount: inquiryData.headcount,
              adjustments: orgAdjustments as any,
            });
            
            if (quote?.adjustments) {
              adjustments = quote.adjustments.map((adj: any) => ({
                label: adj.label,
                amount: adj.amount,
                type: adj.amount < 0 ? 'discount' : 'surcharge'
              }));
            }
          }
          
          // Get tax rate
          taxRate = property.tax_rate || 0;
          
          // Calculate subtotal (total before tax)
          // If we have tax, subtotal = total / (1 + taxRate/100)
          // If no tax, subtotal = total
          subtotal = taxRate > 0 ? total / (1 + taxRate / 100) : total;
          
          // Build detailed price summary content
          let priceContent = `Price Summary:\n`;
          priceContent += `Base Price: ${formatCurrency(basePrice, currency)}\n`;
          
          // Add adjustments
          adjustments.forEach(adj => {
            const sign = adj.type === 'discount' ? '-' : '+';
            priceContent += `${adj.label}: ${sign}${formatCurrency(Math.abs(adj.amount), currency)}\n`;
          });
          
          // Add fee if exists
          if (property.fee_value && property.fee_value > 0) {
            const feeAmount = property.fee_type === 'percentage' 
              ? basePrice * (property.fee_value / 100)
              : property.fee_value;
            priceContent += `Fee: ${formatCurrency(feeAmount, currency)}\n`;
          }
          
          priceContent += `Subtotal: ${formatCurrency(subtotal, currency)}\n`;
          
          // Add tax if exists
          if (taxRate > 0) {
            const taxAmount = subtotal * (taxRate / 100);
            priceContent += `Tax (${taxRate}%): ${formatCurrency(taxAmount, currency)}\n`;
          }
          
          priceContent += `Total: ${formatCurrency(total, currency)}`;
          
          systemMsgs.push({
            id: 'proposal-price',
            sender_id: inquiryData.user_id,
            content: priceContent,
            created_at: proposal.created_at || inquiryData.created_at
          });
          
          // Add custom expiration message if different from default 30 days
          const proposalCreatedAt = new Date(proposal.created_at || inquiryData.created_at);
          const defaultExpiration = new Date(proposalCreatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
          const actualExpiration = new Date(proposal.expires_at);
          
          // Check if expiration is significantly different from 30-day default (allowing for small time differences)
          const daysDifference = Math.abs((actualExpiration.getTime() - defaultExpiration.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDifference > 1) { // More than 1 day difference means custom expiration
            const expiryFmt: Intl.DateTimeFormatOptions = { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric',
              timeZone: 'UTC' // Use UTC to avoid timezone shifting
            };
            const expiryStr = actualExpiration.toLocaleDateString('en-US', expiryFmt);
            
            systemMsgs.push({
              id: 'proposal-expiration',
              sender_id: inquiryData.user_id,
              content: `This proposal and price quote expire on: ${expiryStr}`,
              created_at: proposal.created_at || inquiryData.created_at
            });
          }
        } else {
          // No proposals found - do nothing
        }
      } catch (error) {
        // Error generating price summary - continue without it
      }

      // Add message to guest if it exists
      try {
        const message = inquiryData.message;
        if (typeof message === 'string' && message.trim().length > 0) {
          // Check if it's not just questionnaire content
          const hasQuestionnaireHeader = /^---\s*questionnaire\s*---$/i.test(message.trim());
          const hasStructuredBlocks = message.split(/\n\n+/).some(part => {
            const trimmed = part.trim();
            return trimmed && trimmed.includes(':') && !trimmed.startsWith('---');
          });
          
          // If it's a simple message (not questionnaire), display it without header
          if (!hasQuestionnaireHeader && !hasStructuredBlocks) {
            systemMsgs.push({
              id: 'message-to-guest',
              sender_id: inquiryData.user_id,
              content: message.trim(), // Just the message content, no header
              created_at: inquiryData.created_at
            });
          }
        }
      } catch {}

      // Parse the message field for questionnaire blocks.
      // Each block is separated by a blank line and formatted as: "Title:\nResponse".
      // Skip any legacy header like "--- Questionnaire ---".
      if (typeof inquiryData.message === 'string' && inquiryData.message.trim().length > 0) {
        const messageParts = inquiryData.message.split(/\n\n+/);
        messageParts.forEach((part: string, index: number) => {
          const trimmed = part.trim();
          if (!trimmed || /^---\s*questionnaire\s*---$/i.test(trimmed)) return;
          const [title, ...content] = trimmed.split(/:\n?/);
          const body = content.join('\n').trim();
          if (title && body) {
            systemMsgs.push({
              id: `message-${index}-${Date.now()}`,
              sender_id: inquiryData.user_id,
              content: `${title}:\n${body}`,
              created_at: inquiryData.created_at
            });
          }
        });
      }

      setSystemMessages(systemMsgs);

      // Load messages
      const { data: messagesData, error: messagesError } = await sb
        .from('messages')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Messages query error:', messagesError);
        setError(`Failed to load messages: ${messagesError.message}`);
        return;
      }
      
      setMessages(messagesData || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      setArchiveLoading(true);
      setError(null);

      const isInitiator = user?.id === inquiry?.user_id;
      const isResponder = user?.id === inquiry?.property?.venue_id;
      if (!isInitiator && !isResponder) {
        throw new Error('You do not have permission to archive this inquiry');
      }

      const updateField = isInitiator ? 'initiator_deleted' : 'responder_deleted';
      const currentValue = isInitiator ? inquiry?.initiator_deleted : inquiry?.responder_deleted;
      const newValue = !currentValue;

      const { error: updateError } = await sb
        .from('inquiries')
        .update({
          [updateField]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inquiryId)
        .select();

      if (updateError) {
        console.error('Error updating archive status:', updateError);
        throw updateError;
      }

      // Notify parent and navigate back to list
      onInquiryStatusChange?.();
      navigate('/messages');
    } catch (err) {
      console.error('Error toggling archive status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update archive status');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    // Refresh session to ensure we have a valid token
    const refreshResult = await refreshSession();
    if (!refreshResult) {
      console.error('Failed to refresh session - redirecting to sign in');
      const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`/signin?returnTo=${returnUrl}`, {
        state: { message: 'Your session has expired. Please sign in again to continue.' }
      });
      return;
    }

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      // Generate a unique request ID for tracing
      const requestId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      console.log(`[MessageThread] Sending message with requestId: ${requestId}`);
      
      const { data: newMessageData, error: sendError } = await sb
        .from('messages')
        .insert({
          inquiry_id: inquiryId,
          sender_id: user!.id,
          content: messageContent,
        })
        .select()
        .single();

      if (sendError) throw sendError;

      console.log(`[MessageThread] Message saved to database: ${newMessageData.id}`);
      
      // Add the new message to the list immediately
      setMessages(current => [...current, newMessageData]);
      
      // Update inquiry's updated_at timestamp
      const { error: updateError } = await sb
        .from('inquiries')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', inquiryId);

      if (updateError) {
        console.error('Error updating inquiry timestamp:', updateError);
      } else {
        // Notify parent about potential status change
        onInquiryStatusChange?.();
        
        // Send notification to the recipient
        try {
          // Determine recipient (the other party in the conversation)
          const isInitiator = user?.id === inquiry?.user_id;
          const recipientId = isInitiator ? inquiry?.property?.venue_id : inquiry?.user_id;
          
          // Get recipient profile
          const { data: recipientProfile } = await sb
            .from('profiles')
            .select('email, full_name')
            .eq('id', recipientId)
            .single();
            
          if (recipientProfile?.email) {
            console.log(`[MessageThread] Sending notification to ${recipientProfile.email} with requestId: ${requestId}`);
            
            await sendNotification(
              'message_received',
              { 
                email: recipientProfile.email, 
                name: recipientProfile.full_name || 'User' 
              },
              {
                requestId: `message_notification_${newMessageData.id}`,
                senderName: user?.full_name || 'Art Portfolio User',
                propertyTitle: inquiry?.property?.title || 'Property',
                messageContent: messageContent,
                replyLink: `${window.location.origin}/messages?inquiry=${inquiryId}`
              }
            );
            
            console.log(`[MessageThread] Notification sent successfully with requestId: ${requestId}`);
          } else {
            console.warn(`[MessageThread] Could not send notification: recipient profile not found for ID ${recipientId}`);
          }
        } catch (notificationError) {
          console.error(`[MessageThread] Error sending notification with requestId ${requestId}:`, notificationError);
          // Don't throw error here - we don't want to fail the message send if notification fails
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setNewMessage(messageContent); // Restore message if send failed
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: 'closed' | 'responded') => {
    setStatusLoading(true);
    try {
      // Update inquiry status
      const { error: updateError } = await sb
        .from('inquiries')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inquiryId);

      if (updateError) throw updateError;

      // Reload messages and inquiry data to reflect new status
      await loadMessages();

      // Notify parent component about the change
      onInquiryStatusChange?.();
    } catch (err) {
      console.error('Error toggling archive status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update archive status');
    } finally {
      setArchiveLoading(false);
    }
  };

  // Navigate to payment page for the booking associated with this inquiry
  const handleMakePayment = async () => {
    setPaymentLoading(true);
    try {
      setError(null);
      // Find the booking associated with this inquiry
      const { data: booking, error: bookingError } = await sb
        .from('bookings')
        .select('id, payment_status, price_total, currency')
        .eq('user_id', user!.id)
        .eq('property_id', inquiry.property_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bookingError) throw bookingError;
      
      if (!booking) {
        console.error('No booking found for this inquiry');
        setError('No booking found for this inquiry. Please contact the property owner to create a booking.');
        return;
      }

      if (booking.payment_status === 'paid') {
        setError('This booking has already been paid.');
        return;
      }

      // Refresh the session to ensure we have a valid token
      const refreshResult = await refreshSession();
      if (!refreshResult) {
        console.error('Failed to refresh session');
        navigate('/signin');
        return;
      }

      // Get current session after refresh
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Your session has expired. Please sign in again to continue with payment.');
      }

      // Create payment intent
      console.log('Creating payment intent for booking:', booking.id);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          userId: user!.id,
          amount: booking.price_total,
          currency: booking.currency,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create payment intent';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      const clientSecret = responseData.clientSecret;
      
      if (!clientSecret) {
        throw new Error('No client secret received from payment service');
      }

      console.log('Successfully created payment intent, navigating to payment page');
      
      // Navigate to payment page with client secret
      navigate(`/payment/${booking.id}?client_secret=${clientSecret}`);
      
    } catch (err) {
      console.error('Error creating payment intent:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate payment';
      setError(errorMessage);
      
      // Show more detailed error for debugging
      if (import.meta.env.DEV) {
        console.error('Detailed payment error:', err);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  // Calculate base price based on property price and selected dates
  const calculateBasePrice = () => {
    if (!inquiry || !inquiry.property) return 0;

    // Prefer hourly if we have a valid hourly rate and times
    const ph = Number(inquiry.property.price_per_hour || 0);
    const haveTimes = !!approvalForm.startTime && !!approvalForm.endTime && !!(approvalForm.startDate || inquiry.start_date) && !!(approvalForm.endDate || inquiry.end_date);
    if (ph > 0 && haveTimes) {
      try {
        const d = (approvalForm.startDate || inquiry.start_date);
        const e = (approvalForm.endDate || inquiry.end_date);
        const s = `${d}T${approvalForm.startTime}:00`;
        const t = `${e}T${approvalForm.endTime}:00`;
        const hours = Math.max(0, (new Date(t).getTime() - new Date(s).getTime()) / (1000*60*60));
        return Math.round(ph * hours * 100) / 100;
      } catch {}
    }

    // Fallback to daily
    const pd = Number(inquiry.property.price_per_day || 0);
    const startDate = approvalForm.startDate || inquiry.start_date;
    const endDate = approvalForm.endDate || inquiry.end_date;
    if (!startDate || !endDate || pd <= 0) return 0;
    // Inclusive day count: count both start and end dates when they differ
    const rawDays = calculateDays(startDate, endDate);
    const days = Math.max(1, rawDays + (startDate !== endDate ? 1 : 0));
    return days * pd;
  };

  // Open the approval modal and set initial values
  const handleOpenApprovalModal = async () => {
    console.log('[ApproveModal] opening modal');
    const calculatedBasePrice = calculateBasePrice();
    
    // Get tax rate from property (default to 0 if not set) 
    const taxRate = inquiry.property?.tax_rate || 0;
    const taxOpenCents = taxRate > 0 ? Math.round(calculatedBasePrice * (taxRate / 100) * 100) : 0;
    const calculatedTaxes = taxOpenCents / 100;
    
    // Get fee settings from property
    const feeType = inquiry.property?.fee_type || 'percentage';
    const feeValue = inquiry.property?.fee_value || 0;
    const feeLabel = inquiry.property?.fee_description || 'Booking fee';
    
    // Calculate fees based on type
    let calculatedFees = 0;
    if (feeValue > 0) {
      if (feeType === 'percentage') {
        calculatedFees = Math.round(calculatedBasePrice * (feeValue / 100));
      } else {
        calculatedFees = feeValue;
      }
    }
    // Prefill adjustments by computing a daily quote from org adjustments (if any),
    // merging in selected user discounts and longer-term discounts as separate lines
    let adjLines: Array<{ id: string; label: string; amount: number }> = [];
    try {
      const ownerOrgId = inquiry?.property?.profiles?.primary_organization_id;
      if (ownerOrgId) {
        const { data: orgRows } = await supabase
          .from('organization_adjustments')
          .select('id, type, data, sort_order')
          .eq('organization_id', ownerOrgId)
          .order('sort_order', { ascending: true, nullsFirst: true });
        const days = calculateDays(inquiry.start_date || approvalForm.startDate, inquiry.end_date || approvalForm.endDate);
        if (inquiry?.property?.price_per_day && days > 0) {
          const qb = computeQuote({
            mode: 'daily',
            baseDaily: inquiry.property.price_per_day,
            days,
            timezone: null as any,
            headcount: null,
            adjustments: (orgRows as any[]) || [],
          });
          // Automatic org adjustments
          adjLines = (qb.adjustments || []).map((l: any) => {
            const src = (orgRows || []).find((r: any) => r.id === l.id);
            const srcData = (src?.data ?? {}) as Record<string, any>;
            const label = (srcData.name as string) || l.label;
            return { id: l.id, label, amount: Math.round(l.amount * 100) / 100 };
          });

          // Merge user-selected discounts saved on inquiry (always show line; user can zero it out manually)
          const selectedIds: string[] = Array.isArray(inquiry?.selected_adjustment_ids) ? inquiry.selected_adjustment_ids : [];
          if (selectedIds.length > 0) {
            const subtotal = Number(qb.total || 0);
            for (const id of selectedIds) {
              const row = (orgRows || []).find((r: any) => r.id === id);
              if (!row) continue;
              const rowData = (row.data ?? {}) as Record<string, any>;
              const name = (rowData.name as string) || 'User-selected discount';
              const rateType = (rowData.rateType as 'percentage'|'fixed') || 'percentage';
              const value = Number(rowData.value || 0);
              const rawAmt = rateType === 'percentage' ? -(subtotal * (value / 100)) : -Math.abs(value);
              const amount = Math.round(rawAmt * 100) / 100;
              const label = rateType === 'percentage' && value > 0 ? `${name} (${value}%)` : name;
              adjLines.push({ id, label, amount });
            }
          }

          // Longer-term percentage discounts (weekly/monthly/yearly)
          const p = inquiry.property || {} as any;
          const baseGross = (inquiry.property.price_per_day || 0) * days;
          if (p.yearly_rate_type === 'percentage' && Number(p.yearly_rate_value) > 0 && days >= 365) {
            const v = Number(p.yearly_rate_value);
            adjLines.push({ id: 'longterm_yearly', label: `${v}% yearly discount`, amount: -Math.round(baseGross * (v/100) * 100)/100 });
          } else if (p.monthly_rate_type === 'percentage' && Number(p.monthly_rate_value) > 0 && days >= 30) {
            const v = Number(p.monthly_rate_value);
            adjLines.push({ id: 'longterm_monthly', label: `${v}% monthly discount`, amount: -Math.round(baseGross * (v/100) * 100)/100 });
          } else if (p.weekly_rate_type === 'percentage' && Number(p.weekly_rate_value) > 0 && days >= 7) {
            const v = Number(p.weekly_rate_value);
            adjLines.push({ id: 'longterm_weekly', label: `${v}% weekly discount`, amount: -Math.round(baseGross * (v/100) * 100)/100 });
          }
        }
      }
    } catch {}
    
    // Prefill from DB hourly timestamps if present; fallback to parsing message
    let parsedStartTime = '';
    let parsedEndTime = '';
    let parsedStartDate = '';
    let parsedEndDate = '';
    let parsedHeadcount: string = '';
    try {
      // Prefer DB columns if available
      const startAt = (inquiry as any)?.start_at as string | undefined;
      const endAt = (inquiry as any)?.end_at as string | undefined;
      if (startAt && endAt) {
        const sd = new Date(startAt);
        const ed = new Date(endAt);
        // Use UTC methods to preserve the original time that was stored
        const toUTCHM = (d: Date) => `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
        parsedStartTime = toUTCHM(sd);
        parsedEndTime = toUTCHM(ed);
        const toUTCYMD = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        parsedStartDate = toUTCYMD(sd);
        parsedEndDate = toUTCYMD(ed);
      }

      const msg: string = String(inquiry?.message || '');
      const marker = 'Requested Time (Local):';
      const idx = msg.indexOf(marker);
      if (!parsedStartTime && idx >= 0) {
        const line = msg.slice(idx + marker.length).split('\n')[0].trim();
        // Accept formats like:
        //   "Dec 06, 2025, 7 00 AM (America/Denver) - Dec 06, 2025, 9 00 AM (America/Denver)"
        //   "12/06/2025, 07:00 AM - 09:00 AM"
        // Extract just the time tokens on both sides; allow either ':' or ' ' between hour and minutes
        const timePairMatch = line.match(/(\d{1,2})[:\s](\d{2})\s*([AP]M).*?-.*?(\d{1,2})[:\s](\d{2})\s*([AP]M)/i);
        if (timePairMatch) {
          const to24hm = (hhStr: string, mmStr: string, apStr: string) => {
            let hh = parseInt(hhStr, 10);
            const mm = mmStr;
            const ap = apStr.toUpperCase();
            if (ap === 'PM' && hh !== 12) hh += 12;
            if (ap === 'AM' && hh === 12) hh = 0;
            return `${String(hh).padStart(2,'0')}:${mm}`;
          };
          parsedStartTime = to24hm(timePairMatch[1], timePairMatch[2], timePairMatch[3]);
          parsedEndTime = to24hm(timePairMatch[4], timePairMatch[5], timePairMatch[6]);
          console.log('[ApproveModal] parsed times:', parsedStartTime, parsedEndTime);
        }
        // Extract Month Day, Year on both sides (if present)
        const monthMap: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', sept:'09', oct:'10', nov:'11', dec:'12' };
        const dateRegex = /([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4}).*?-.*?([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})/i;
        const dm = line.match(dateRegex);
        if (dm) {
          const sm = monthMap[dm[1].slice(0,3).toLowerCase()] || '';
          const sd = String(parseInt(dm[2],10)).padStart(2,'0');
          const sy = dm[3];
          const em = monthMap[dm[4].slice(0,3).toLowerCase()] || '';
          const ed = String(parseInt(dm[5],10)).padStart(2,'0');
          const ey = dm[6];
          if (sm && em) {
            parsedStartDate = `${sy}-${sm}-${sd}`;
            parsedEndDate = `${ey}-${em}-${ed}`;
            console.log('[ApproveModal] parsed dates:', parsedStartDate, parsedEndDate);
          }
        }
        // Also try to parse headcount if present in message
        const hcMatch = msg.match(/headcount\D+(\d{1,5})/i) || msg.match(/estimated\s+headcount\D+(\d{1,5})/i) || msg.match(/(\d{1,5})\s+people/i);
        if (hcMatch) {
          parsedHeadcount = hcMatch[1];
        }
      }
    } catch {}

    const hasHourly = Boolean(parsedStartTime && parsedEndTime);
    setShowTimeInputs(hasHourly);
    setApprovalForm({
      startDate: parsedStartDate || inquiry.start_date || '',
      endDate: parsedEndDate || inquiry.end_date || '',
      // Clear times unless we actually parsed them
      startTime: hasHourly ? parsedStartTime : '',
      endTime: hasHourly ? parsedEndTime : '',
      basePrice: calculatedBasePrice,
      taxes: calculatedTaxes,
      fees: calculatedFees,
      feeLabel,
      taxRate,
      adjustments: adjLines,
      headcount: String(inquiry.headcount ?? parsedHeadcount ?? ''),
      // Leave hourly timestamps empty by default; UI can set these when hourly ranges are used
      startAt: '',
      endAt: ''
    });

    // Trigger immediate recompute so base/adjustments populate without extra input.
    // Only include times if we actually parsed them; daily inquiries should not get default times.
    await recomputeQuoteInModal({
      startDate: parsedStartDate || inquiry.start_date || approvalForm.startDate,
      endDate: parsedEndDate || inquiry.end_date || approvalForm.endDate,
      ...(hasHourly ? { startTime: parsedStartTime, endTime: parsedEndTime } : {}),
      headcount: String(inquiry.headcount ?? parsedHeadcount ?? ''),
    });

    // Initialize enabled map for user-selected discounts (default to true)
    const selectedIds: string[] = Array.isArray(inquiry?.selected_adjustment_ids) ? inquiry.selected_adjustment_ids : [];
    const map: Record<string, boolean> = {};
    for (const id of selectedIds) map[id] = true;
    setSelectedDiscountEnabled(map);
    
    setShowApprovalModal(true);
  };

  // Generate a unique request ID for idempotency
  const generateRequestId = () => {
    return `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  };

  // Renders content with proper line breaks
  const formatMessageContent = (content: string) => {
    // Check if the content looks like an invoice/payment request
    const isInvoice = content.includes('Invoice date:') || content.includes('Total Amount Due:') || content.includes('Base Price:');
    
    // Check if it's a payment confirmation message
    const isPaymentConfirmation = content.includes('Payment of') && content.includes('has been received');
    
    // Check if it's a booking cancellation message
    const isCancellation = content.includes('Booking has been canceled by') && content.includes('Reason:');
    
    if (isPaymentConfirmation) {
      // For payment confirmation messages, add special styling
      const bookingIdMatch = content.match(/Booking ID:\s*([0-9a-fA-F-]{36})/);
      const bookingId = bookingIdMatch?.[1];
      return (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700">
            <div className="flex items-center mb-2">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <span className="font-medium">Payment Confirmed</span>
            </div>
            {content.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                <br />
              </React.Fragment>
            ))}
            {bookingId && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard?booking=${bookingId}`)}
                  className="text-maroon-700"
                >
                  View booking details
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    } else if (isCancellation) {
      // For cancellation messages, add special styling
      return (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
            <div className="flex items-center mb-2">
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              <span className="font-medium">Booking Canceled</span>
            </div>
            {content.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    } else if (isInvoice) {
      // Split by newlines and render each line
      return content.split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {line}
          <br />
        </React.Fragment>
      ));
    }
    
    // For regular messages, preserve whitespace but don't add extra formatting
    return content;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600" />
      </div>
    );
  }

  // Show access denied screen instead of error
  if (accessDenied) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <Lock className="h-16 w-16 text-maroon-300 mb-4" />
        <h3 className="text-xl font-semibold text-maroon-800 mb-2">
          Access Denied
        </h3>
        <p className="text-maroon-600 mb-6 max-w-md">
          You don't have permission to view this inquiry. You can only access inquiries that you created or inquiries for properties you own.
        </p>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate('/messages')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Messages</span>
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Button>
        </div>
      </Card>
    );
  }

  // Determine user roles
  const isInitiator = user?.id === inquiry?.user_id;
  const isResponder = user?.id === inquiry?.property?.venue_id; 
  const isResponderLike = isResponder || isOrgMember;
  const isArchived = isInitiator ? inquiry?.initiator_deleted : inquiry?.responder_deleted;
  
  // Check if payment is completed
  const isPaymentCompleted = inquiry?.status === 'payment_completed';

  return (
    <Card className="flex flex-col relative z-10" style={{ overflow: 'visible' }}>
      {/* Header */}
      {error && (
        <div className="p-4" style={{ overflow: 'visible' }}>
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      <div className="p-4 border-b border-gray-200 flex items-center" style={{ overflow: 'visible' }}>
        <Button
          variant="ghost"
          size="sm"
          className="mr-2 flex-shrink-0 lg:hidden"
          onClick={onClose}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1" style={{ overflow: 'visible' }}>
          <h3 className="font-semibold text-maroon-800">
            {inquiry?.property?.title}
          </h3>
          <p className="text-sm text-maroon-600">
            {inquiry?.status === 'converted_to_proposal' || inquiry?.status === 'payment_completed' 
              ? `Proposal for ${inquiry?.user?.full_name || 'Guest'}`
              : `Inquiry from ${inquiry?.user?.full_name}`
            }
          </p>
          {isArchived && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full mt-1">
              Archived
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2" style={{ overflow: 'visible' }}>
          {/* Approval button for venue owners */}
          {isResponderLike && (
            <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
              <Tooltip content={inquiry?.status === 'payment_completed' ? 'Payment completed' : 'Approve booking and request payment'}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-shrink-0 relative z-20"
                  onClick={handleOpenApprovalModal}
                  disabled={inquiry?.status === 'closed' || inquiry?.status === 'converted_to_proposal' || inquiry?.status === 'payment_completed'}
                >
                  <ReceiptText className="h-5 w-5" />
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Archive/Unarchive button for inquiry initiators */}
          {isInitiator && (
            <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
              <Tooltip content={isArchived ? 'Unarchive inquiry' : 'Archive inquiry'}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative z-20"
                  onClick={handleArchiveToggle}
                  disabled={archiveLoading}
                  isLoading={archiveLoading}
                >
                  {isArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Close/Reopen buttons only for responders (property owners) */}
          {isResponderLike && (
            <>
              {inquiry?.status !== 'closed' ? (
                <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
                  <Tooltip content="Close inquiry">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 relative z-20"
                      onClick={() => handleStatusChange('closed')}
                      isLoading={statusLoading}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </Tooltip>
                </div>
              ) : (
                <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
                  <Tooltip content="Reopen inquiry">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 relative z-20"
                      onClick={() => handleStatusChange('responded')}
                      isLoading={statusLoading}
                    >
                      <RefreshCw className="h-5 w-5" />
                    </Button>
                  </Tooltip>
                </div>
              )}

              {/* Delete button only for responders when inquiry is closed */}
              {inquiry?.status === 'closed' && (
                <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
                  <Tooltip content="Archive message thread">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 relative z-20"
                      onClick={handleArchiveToggle}
                      disabled={archiveLoading}
                      isLoading={archiveLoading}
                    >
                      <Archive className="h-5 w-5" />
                    </Button>
                  </Tooltip>
                </div>
              )}
            </>
          )}


          {/* Show payment button to inquiry initiators when proposal is ready */}
          {inquiry?.status === 'converted_to_proposal' && isInitiator && !isPaymentCompleted && (
            <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
              <Tooltip content="Make payment">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleMakePayment}
                  isLoading={paymentLoading}
                  icon={<CreditCard className="h-5 w-5" />}
                />
              </Tooltip>
            </div>
          )}
          
          {/* Show completed payment button when payment is completed */}
          {isPaymentCompleted && isInitiator && (
            <div className="inline-block" style={{ overflow: 'visible', position: 'relative' }}>
              <Tooltip content="Payment completed">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative z-20 bg-green-50 text-green-700 border-green-200"
                  disabled={true}
                >
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Payment pending banner for initiators - styled and positioned at top of messages */}
      {inquiry?.status === 'converted_to_proposal' && isInitiator && !isPaymentCompleted && (
  <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl bg-yellow-50 border border-yellow-100 text-yellow-900 text-sm" style={{ fontFamily: 'inherit', fontWeight: 500 }}>
    <div className="flex items-center gap-2">
      <span className="font-semibold text-yellow-900 text-sm">Booking Approved.</span>
      <span className="font-normal text-yellow-900 ml-2 text-sm">Complete payment to finalize the reservation.</span>
    </div>
    <Button
      variant="danger"
      size="sm"
      onClick={handleMakePayment}
      isLoading={paymentLoading}
    >
      <CreditCard className="h-5 w-5 mr-2" />
      Make Payment
    </Button>
  </div>
)}

      {/* Messages */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-maroon-50 border border-maroon-200 text-maroon-600 px-4 py-3 rounded-xl mb-4">
            <h4 className="font-semibold mb-1">Inquiry Details</h4>
          </div>
        )}

        {/* System Messages (Inquiry Details) */}
        {systemMessages.map((message) => (
          <div key={message.id} className="flex justify-start">
            <div className="max-w-[70%] rounded-xl px-4 py-2 bg-maroon-50 text-maroon-800 border border-maroon-100">
              <p className="whitespace-pre-line break-words">{message.content}</p>
              <p className="text-xs mt-1 text-maroon-500">
                {formatDate(message.created_at)} 
                {message.content.includes('Payment of') && message.content.includes('has been received') && (
                  <span className="ml-2 bg-green-100 text-green-700 px-1 py-0.5 rounded text-xs">Payment Confirmation</span>
                )}
              </p>
            </div>
          </div>
        ))}

        {/* Regular Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-xl px-4 py-2 ${
                message.sender_id === user?.id
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="break-words">{formatMessageContent(message.content)}</p>
              <p className={`text-xs mt-1 ${
                message.sender_id === user?.id
                  ? 'text-gray-500'
                  : 'text-gray-500'
              }`}>
                {formatDate(message.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input - hide if archived */}
      {!isArchived && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              isLoading={sending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Input - show read-only message if payment completed */}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-maroon-800 mb-4">
              Approve Booking and Request Payment
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={approvalForm.startDate || inquiry?.start_date || ''}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setApprovalForm(prev => {
                        // Recalculate base price when date changes
                        const newForm = {
                          ...prev,
                          startDate: newStartDate
                        };
                        
                        // Only auto-recalculate if price hasn't been manually edited
                        if (prev.basePrice === calculateBasePrice()) {
                          // we will recompute centrally below
                        }
                        
                        return newForm;
                      });
                      // Central recompute to keep base/fees/taxes/adjustments in sync
                      recomputeQuoteInModal({ startDate: newStartDate });
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={approvalForm.endDate || inquiry?.end_date || ''}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      setApprovalForm(prev => {
                        // Recalculate base price when date changes
                        const newForm = {
                          ...prev,
                          endDate: newEndDate
                        };
                        
                        // Only auto-recalculate if price hasn't been manually edited
                        if (prev.basePrice === calculateBasePrice()) {
                          // we will recompute centrally below
                        }
                        
                        return newForm;
                      });
                      // Central recompute to keep base/fees/taxes/adjustments in sync
                      recomputeQuoteInModal({ endDate: newEndDate });
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
              </div>

              {/* Start/End Time for hourly pricing */}
              {showTimeInputs && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    step={900}
                    value={approvalForm.startTime}
                    onFocus={(e) => {
                      // If minutes are not a 15-min increment, default to :00
                      let v = e.currentTarget.value;
                      if (!v) {
                        v = `00:00`;
                        e.currentTarget.value = v;
                        recomputeQuoteInModal({ startTime: v });
                        return;
                      }
                      const [hh, mm] = v.split(':');
                      const mins = Number(mm || '0');
                      if (![0,15,30,45].includes(mins)) {
                        const nv = `${hh}:${'00'}`;
                        e.currentTarget.value = nv;
                        recomputeQuoteInModal({ startTime: nv });
                      }
                    }}
                    onChange={(e) => {
                      let v = e.target.value;
                      const [hh, mm] = (v || '').split(':');
                      const mins = Number(mm || '0');
                      const buckets = [0, 15, 30, 45];
                      const closest = buckets.reduce((p,c)=> Math.abs(c-mins) < Math.abs(p-mins) ? c : p, 0);
                      v = `${hh || '00'}:${String(closest).padStart(2,'0')}`;
                      e.target.value = v;
                      recomputeQuoteInModal({ startTime: v });
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">End Time</label>
                  <input
                    type="time"
                    step={900}
                    value={approvalForm.endTime}
                    onFocus={(e) => {
                      let v = e.currentTarget.value;
                      if (!v) {
                        v = `00:00`;
                        e.currentTarget.value = v;
                        recomputeQuoteInModal({ endTime: v });
                        return;
                      }
                      const [hh, mm] = v.split(':');
                      const mins = Number(mm || '0');
                      if (![0,15,30,45].includes(mins)) {
                        const nv = `${hh}:${'00'}`;
                        e.currentTarget.value = nv;
                        recomputeQuoteInModal({ endTime: nv });
                      }
                    }}
                    onChange={(e) => {
                      let v = e.target.value;
                      const [hh, mm] = (v || '').split(':');
                      const mins = Number(mm || '0');
                      const buckets = [0, 15, 30, 45];
                      const closest = buckets.reduce((p,c)=> Math.abs(c-mins) < Math.abs(p-mins) ? c : p, 0);
                      v = `${hh || '00'}:${String(closest).padStart(2,'0')}`;
                      e.target.value = v;
                      recomputeQuoteInModal({ endTime: v });
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
              </div>
              )}

              <div>
                <label className="block text-sm font-medium text-maroon-700 mb-1">
                  Base Price
                </label>
                <input
                  type="number"
                  value={approvalForm.basePrice}
                  onChange={(e) => {
                    const newBasePrice = parseFloat(e.target.value);
                    setApprovalForm(prev => {
                      // Reset error when user changes values
                      setApprovalFormError(null);
                      
                      // Get tax rate and recalculate taxes
                      const taxRate = inquiry.property?.tax_rate || 0;
                      const newTaxes = taxRate > 0 ? Math.round(newBasePrice * (taxRate / 100)) : 0;
                      
                      // Recalculate fees if percentage-based
                      let newFees = prev.fees;
                      const feeType = inquiry.property?.fee_type || 'percentage';
                      const feeValue = inquiry.property?.fee_value || 0;
                      
                      if (feeType === 'percentage' && feeValue > 0) {
                        newFees = Math.round(newBasePrice * (feeValue / 100));
                      }
                      
                      return {
                        ...prev,
                        basePrice: newBasePrice,
                        taxes: newTaxes,
                        fees: feeType === 'percentage' ? newFees : prev.fees
                      };
                    });
                  }}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  min={0}
                />
              </div>

              {/* Headcount for capacity surcharge */}
              {showHeadcount && (
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">Estimated Headcount</label>
                  <input
                    type="number"
                    value={String(approvalForm.headcount || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      recomputeQuoteInModal({ headcount: v });
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                    min={0}
                  />
                </div>
              )}

              {/* Adjustments (each editable) */}
              {approvalForm.adjustments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">Adjustments</label>
                  <div className="space-y-2">
                    {approvalForm.adjustments.map((line, idx) => (
                      <div key={line.id} className="grid grid-cols-2 gap-2 items-center">
                        <div className="text-sm text-maroon-700 truncate" title={line.label}>{line.label}</div>
                        <input
                          type="number"
                          value={line.amount}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setApprovalForm(prev => {
                              const next = [...prev.adjustments];
                              next[idx] = { ...next[idx], amount: isNaN(v) ? 0 : v };
                              return { ...prev, adjustments: next };
                            });
                          }}
                          className="w-full rounded-xl border-2 border-maroon-200 p-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Only show fees input if fee value exists - shown before taxes */}
              {(inquiry.property?.fee_value > 0 || approvalForm.fees > 0) && (
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">
                    Fees ({inquiry.property?.fee_description || approvalForm.feeLabel || 'Fee'})
                  </label>
                  <input
                    type="number"
                    value={approvalForm.fees}
                    onChange={(e) => setApprovalForm({
                      ...approvalForm,
                      fees: parseFloat(e.target.value) || 0
                    })}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
              )}
              
              {/* Only show taxes input if tax rate exists */}
              {(inquiry.property?.tax_rate > 0 || approvalForm.taxes > 0) && (
                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-1">
                    Taxes ({inquiry.property?.tax_rate || 0}%)
                  </label>
                  <input
                    type="number"
                    value={approvalForm.taxes}
                    onChange={(e) => setApprovalForm({
                      ...approvalForm,
                      taxes: parseFloat(e.target.value) || 0
                    })}
                    className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  />
                </div>
              )}

              <div className="border-t border-maroon-200 pt-4 mt-4">
                <div className="flex justify-between text-lg font-semibold text-maroon-800">
                  <span>Total</span>
                  <span>
                    ${(() => {
                      const base = (isNaN(approvalForm.basePrice) ? 0 : approvalForm.basePrice);
                      const taxes = (isNaN(approvalForm.taxes) ? 0 : approvalForm.taxes);
                      const fees = (isNaN(approvalForm.fees) ? 0 : approvalForm.fees);
                      const adjs = (approvalForm.adjustments || []).reduce((s, l) => s + (isNaN(l.amount) ? 0 : l.amount), 0);
                      return (base + adjs + fees + taxes).toFixed(2);
                    })()}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Collapsible payout breakdown (estimated placeholders before booking exists) */}
            <div className="mt-3">
              <details className="group">
                <summary className="cursor-pointer select-none text-sm font-medium text-maroon-700 flex items-center">
                  <span className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3 text-maroon-700 transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    >
                      <path d="M7 5l6 5-6 5V5z" />
                    </svg>
                    <span>Payout breakdown</span>
                  </span>
                </summary>
                <div className="mt-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-maroon-600">Amount</span><span className="text-maroon-800 font-medium">${((isNaN(approvalForm.basePrice)?0:approvalForm.basePrice)+(isNaN(approvalForm.taxes)?0:approvalForm.taxes)+(isNaN(approvalForm.fees)?0:approvalForm.fees)).toFixed(2)}</span></div>
                    <div className="flex justify-between">
                      <span className="text-maroon-600">Platform commission</span>
                      <span className="text-maroon-800">
                        {(() => {
                          const amount = ((isNaN(approvalForm.basePrice)?0:approvalForm.basePrice)+(isNaN(approvalForm.taxes)?0:approvalForm.taxes)+(isNaN(approvalForm.fees)?0:approvalForm.fees));
                          const amountC = Math.round(amount * 100);
                          const start = approvalForm.startDate || inquiry?.start_date || '';
                          const end = approvalForm.endDate || inquiry?.end_date || '';
                          const threshold = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_THRESHOLD_DAYS ?? '365');
                          const basePct = Number(import.meta.env.VITE_PLATFORM_FEE_BASE_PERCENT ?? import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '15');
                          const longPct = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_PERCENT ?? '5');
                          const days = start && end ? calculateDays(start, end) : 0;
                          const pct = days >= threshold ? longPct : basePct;
                          const commissionC = Math.round(amountC * (pct / 100));
                          return `${pct}% ($${(commissionC/100).toFixed(2)})`;
                        })()}
                      </span>
                    </div>
                    {(() => {
                      const amount = ((isNaN(approvalForm.basePrice)?0:approvalForm.basePrice)+(isNaN(approvalForm.taxes)?0:approvalForm.taxes)+(isNaN(approvalForm.fees)?0:approvalForm.fees));
                      const amountC = Math.round(amount * 100);
                      const start = approvalForm.startDate || inquiry?.start_date || '';
                      const end = approvalForm.endDate || inquiry?.end_date || '';
                      const threshold = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_THRESHOLD_DAYS ?? '365');
                      const basePct = Number(import.meta.env.VITE_PLATFORM_FEE_BASE_PERCENT ?? import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '15');
                      const longPct = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_PERCENT ?? '5');
                      const days = start && end ? calculateDays(start, end) : 0;
                      const pct = days >= threshold ? longPct : basePct;
                      const commissionC = Math.round(amountC * (pct / 100));
                      const venueCredit = Number(inquiry?.property_owner_org_credit ?? 0);
                      const venueCreditC = Math.round(Math.max(0, venueCredit) * 100);
                      const creditAppliedC = Math.max(0, Math.min(venueCreditC, commissionC));
                      return creditAppliedC > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-maroon-600">Service credit applied</span>
                          <span className="text-maroon-800">+${(creditAppliedC/100).toFixed(2)}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex justify-between">
                      <span className="text-maroon-600">Stripe processing fee (est.)</span>
                      <span className="text-maroon-800">
                        {(() => {
                          const amount = ((isNaN(approvalForm.basePrice)?0:approvalForm.basePrice)+(isNaN(approvalForm.taxes)?0:approvalForm.taxes)+(isNaN(approvalForm.fees)?0:approvalForm.fees));
                          const amountC = Math.round(amount * 100);
                          const stripePct = Number(import.meta.env.VITE_STRIPE_PERCENT_FEE ?? '2.9');
                          const stripeFixedCents = Number(import.meta.env.VITE_STRIPE_FIXED_FEE_CENTS ?? '30');
                          const feeC = Math.round(amountC * (stripePct / 100)) + stripeFixedCents;
                          return `($${(feeC/100).toFixed(2)})`;
                        })()}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="flex justify-between">
                      <span className="text-maroon-800 font-semibold">Estimated payout to you</span>
                      <span className="text-maroon-800 font-semibold">
                        {(() => {
                          const amount = ((isNaN(approvalForm.basePrice)?0:approvalForm.basePrice)+(isNaN(approvalForm.taxes)?0:approvalForm.taxes)+(isNaN(approvalForm.fees)?0:approvalForm.fees));
                          const amountC = Math.round(amount * 100);
                          // Commission
                          const start = approvalForm.startDate || inquiry?.start_date || '';
                          const end = approvalForm.endDate || inquiry?.end_date || '';
                          const threshold = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_THRESHOLD_DAYS ?? '365');
                          const basePct = Number(import.meta.env.VITE_PLATFORM_FEE_BASE_PERCENT ?? import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '15');
                          const longPct = Number(import.meta.env.VITE_PLATFORM_FEE_LONG_TERM_PERCENT ?? '5');
                          const days = start && end ? calculateDays(start, end) : 0;
                          const pct = days >= threshold ? longPct : basePct;
                          const commissionC = Math.round(amountC * (pct / 100));
                          // Service credit applied
                          const venueCredit = Number(inquiry?.property_owner_org_credit ?? 0);
                          const venueCreditC = Math.round(Math.max(0, venueCredit) * 100);
                          const creditAppliedC = Math.max(0, Math.min(venueCreditC, commissionC));
                          const netPlatformFeeC = commissionC - creditAppliedC;
                          // Stripe fee estimate
                          const stripePct = Number(import.meta.env.VITE_STRIPE_PERCENT_FEE ?? '2.9');
                          const stripeFixedCents = Number(import.meta.env.VITE_STRIPE_FIXED_FEE_CENTS ?? '30');
                          const stripeFeeC = Math.round(amountC * (stripePct / 100)) + stripeFixedCents;
                          const payoutC = amountC - netPlatformFeeC - stripeFeeC;
                          return `$${(Math.max(0, payoutC) / 100).toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowApprovalModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (inquiry?.status === 'payment_completed') {
                    setApprovalFormError('Payment has already been completed for this inquiry.');
                    return;
                  }
                  try {
                    // Validate the total amount
                    const totalPrice = approvalForm.basePrice + approvalForm.taxes + approvalForm.fees + (approvalForm.adjustments || []).reduce((s,l)=>s+(isNaN(l.amount)?0:l.amount),0);
                    
                    // Reset previous error
                    setApprovalFormError(null);
                    
                    // Check if total price is valid and greater than zero
                    if (isNaN(totalPrice) || totalPrice <= 0) {
                      setApprovalFormError("Please enter an amount greater than 0");
                      return;
                    }
                    
                    setLoading(true);
                    const requestId = generateRequestId();
                    
                    console.log('Creating invoice and booking...', { 
                      totalPrice, 
                      inquiryId,
                      requestId 
                    });
                    
                    // Ensure we have a valid session
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    if (sessionError || !session) {
                      throw new Error('Session error: ' + (sessionError?.message || 'No active session'));
                    }
                    
                    // Call the edge function to create the invoice and booking
                    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice-and-booking`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        inquiryId,
                        totalPrice,
                        approvalForm,
                        requestId
                      }),
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to create invoice and booking');
                    }
                    
                    const result = await response.json();
                    console.log('Invoice and booking created successfully:', result);

                    setShowApprovalModal(false);
                    await loadMessages();
                    
                    // Notify parent component about status change
                    onInquiryStatusChange?.();
                  } catch (err) {
                    console.error('Error creating invoice and booking:', err);
                    setError(err instanceof Error ? err.message : 'Failed to create invoice and booking');
                  } finally {
                    setLoading(false);
                  }
                }}
                isLoading={loading}
                disabled={loading || inquiry?.status === 'payment_completed'}
              >
                Send Invoice
              </Button>
              
              {/* Error message for approval form */}
              {approvalFormError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium">{approvalFormError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MessageThread;