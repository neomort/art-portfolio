import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { parseAppliedAdjustmentTokens, isAdjustmentApplied } from '../lib/adjustments';
import { sendNotification } from '../lib/notifications';
import PriceSummary from '../components/pricing/PriceSummary';

interface Property {
  id: string;
  title: string;
  price_per_day?: number | null;
  price_per_hour?: number | null;
  currency: string | null;
  inquire_for_pricing: boolean;
  weekly_rate?: number | null;
  monthly_rate?: number | null;
  yearly_rate_value?: number | null;
  tax_rate?: number | null;
  capacity?: number | null;
  fee_type?: string | null;
  fee_value?: number | null;
  fee_description?: string | null;
  organization_id?: string;
  applied_adjustment_ids?: string[] | string;
  applied_adjustment_tokens?: string[] | string;
}

const OpenProposalPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = React.useState<Property | null>(null);
  const [selectedDates, setSelectedDates] = React.useState<{
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [formData, setFormData] = React.useState({
    guest_email: '',
    guest_name: '',
    message: '',
    price_total: 0,
    currency: 'USD',
    selected_adjustment_ids: [] as string[],
    discount_type: 'percentage' as 'percentage' | 'fixed' | '',
    discount_value: 0,
    headcount: 1,
    capacity_surcharge_applied: false,
    off_hours_surcharge_applied: false,
    expires_at: '', // Optional expiration date
  });
  const [hasCapacitySurcharge, setHasCapacitySurcharge] = React.useState(false);
  const [orgAdjustments, setOrgAdjustments] = React.useState<any[]>([]);
  const [appliedAdjustmentTokens, setAppliedAdjustmentTokens] = React.useState<string[]>([]);
  const [selectedUserDiscounts, setSelectedUserDiscounts] = React.useState<Record<string, boolean>>({});
  
  // Guest user lookup state
  const [guestUserLookup, setGuestUserLookup] = React.useState<{
    isSearching: boolean;
    found: boolean;
    user?: any;
  }>({
    isSearching: false,
    found: false,
  });

  // Function to check if guest email exists in the system
  const checkGuestEmail = async (email: string) => {
    if (!email || !email.includes('@')) {
      setGuestUserLookup({ isSearching: false, found: false });
      return;
    }

    setGuestUserLookup({ isSearching: true, found: false });

    try {
      // First try profiles table (has complete profile data)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', email.toLowerCase());

      if (!profileError && profileData && profileData.length > 0) {
        // User found in profiles
        const user = profileData[0];
        setGuestUserLookup({ isSearching: false, found: true, user });
        setFormData(prev => ({ ...prev, guest_name: user.full_name || '' }));
        return;
      }

      // If not found in profiles, try to get display name from auth.users
      const { data: displayNameData, error: displayNameError } = await supabase
        .rpc('get_user_display_name', { email_to_check: email.toLowerCase() });

      if (!displayNameError && displayNameData) {
        // Got real display name from auth.users
        const displayName = String(displayNameData);
        const tempUser = {
          id: 'temp-' + Date.now(),
          full_name: displayName,
          email: email.toLowerCase()
        };
        setGuestUserLookup({ isSearching: false, found: true, user: tempUser });
        setFormData(prev => ({ ...prev, guest_name: displayName }));
        return;
      }

      // If no display name found, user doesn't exist in auth.users either
      // This is a new user - we'll create them when they click the magic link
      setGuestUserLookup({ isSearching: false, found: false });

    } catch (err) {
      console.error('Error checking guest email:', err);
      setGuestUserLookup({ isSearching: false, found: false });
    }
  };

  // Generate magic link for new users
  const generateMagicLinkForProposal = async (proposalId: string, email: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/proposal/${proposalId}/finalize`
        }
      });
      
      if (error) {
        console.error('Error generating magic link:', error);
        return null;
      }
      
      // Return the redirect URL that will be used in the magic link
      return `${window.location.origin}/proposal/${proposalId}/finalize`;
    } catch (err) {
      console.error('Error in generateMagicLinkForProposal:', err);
      return null;
    }
  };

  // Fetch organizational adjustments when property is selected
  React.useEffect(() => {
    if (!selectedProperty?.organization_id) return;

    const fetchOrgAdjustments = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_adjustments')
          .select('*')
          .eq('organization_id', selectedProperty.organization_id!);

        if (error) {
          console.error('Error fetching adjustments:', error);
          throw error;
        }

        setOrgAdjustments(data || []);

        // Check for different adjustment types
        const capacitySurcharge = data?.find(adj => adj.type === 'capacity_surcharge');
        const offHoursAdjustment = data?.find(adj => adj.type === 'off_hours_adjustment');
        const offDaysAdjustment = data?.find(adj => adj.type === 'off_days_adjustment');
        const userDiscounts = data?.filter(adj => adj.type === 'user_selected_discount');
        
        setHasCapacitySurcharge(!!capacitySurcharge);

        // Set applied adjustment tokens from property (stable keys or legacy ids)
        const tokens = parseAppliedAdjustmentTokens(selectedProperty.applied_adjustment_tokens);
        const ids = parseAppliedAdjustmentTokens(selectedProperty.applied_adjustment_ids);
        const merged = Array.from(new Set([...tokens, ...ids]));
        setAppliedAdjustmentTokens(merged);
      } catch (error) {
        console.error('Error fetching organizational adjustments:', error);
      }
    };

    fetchOrgAdjustments();
  }, [selectedProperty]);

  const appliedAdjustmentTokenSet = React.useMemo(
    () => new Set(appliedAdjustmentTokens),
    [appliedAdjustmentTokens]
  );

  // Calculate base price based on dates
  const calculateBasePrice = () => {
    if (!selectedDates?.startDate || !selectedDates?.endDate || !selectedProperty) return 0;
    
    const start = new Date(selectedDates.startDate);
    const end = new Date(selectedDates.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (selectedProperty.price_per_hour && selectedDates?.startTime && selectedDates?.endTime) {
      const startTime = new Date(`${selectedDates.startDate}T${selectedDates.startTime}`);
      const endTime = new Date(`${selectedDates.endDate}T${selectedDates.endTime}`);
      const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
      return (selectedProperty.price_per_hour || 0) * hours;
    } else if (selectedProperty.price_per_day) {
      return (selectedProperty.price_per_day || 0) * Math.max(days, 1);
    }
    
    return 0;
  };

  // Calculate total with adjustments
  const calculateTotal = () => {
    const sd = selectedDates;
    const prop = selectedProperty;
    if (!sd?.startDate || !sd?.endDate || !prop) return 0;

    let total = calculateBasePrice();
    
    // Apply user-selected discounts first
    const selectedDiscountRows = orgAdjustments
      .filter(r => r.type === 'user_selected_discount' && selectedUserDiscounts[r.id] && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    
    for (const discount of selectedDiscountRows) {
      const rateType = (discount.data?.rateType as 'percentage' | 'fixed') || 'percentage';
      const discountAmount = Number(discount.data?.discountPercent || discount.data?.value || 0);
      if (rateType === 'percentage') {
        total -= total * (discountAmount / 100);
      } else {
        total -= Math.abs(discountAmount);
      }
    }
    
    // Store the discounted price for percentage-based surcharges
    const discountedPrice = total;
    
    // Apply capacity surcharge if applicable
    const capacityAdj = orgAdjustments.find(r => r.type === 'capacity_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (capacityAdj) {
      const bracketSize = Number(capacityAdj.data?.perHeadcount);
      const surchargePerBracket = Number(capacityAdj.data?.surchargeAmount);
      const rateType = (capacityAdj.data?.rateType as 'percentage' | 'fixed') || 'fixed';
      
      if (rateType === 'fixed') {
        const includedPeople = Number(capacityAdj.data?.perHeadcount);
        const excessPeople = Math.max(0, formData.headcount - includedPeople);
        const brackets = Math.ceil(excessPeople / bracketSize);
        const hours = prop.price_per_hour && sd.startTime && sd.endTime
          ? (() => {
              const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
              const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
              return Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            })()
          : 1;
        
        const capacitySurchargeAmount = brackets * surchargePerBracket * hours;
        total += capacitySurchargeAmount;
      } else {
        const includedPeople = Number(capacityAdj.data?.perHeadcount);
        const excessPeople = Math.max(0, formData.headcount - includedPeople);
        const brackets = Math.ceil(excessPeople / bracketSize);
        const hours = prop.price_per_hour && sd.startTime && sd.endTime
          ? (() => {
              const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
              const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
              return Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            })()
          : 1;
        
        const bracketSurcharge = brackets * Number(capacityAdj.data?.value || 0);
        total += discountedPrice * (bracketSurcharge / 100);
      }
    }
    
    // Apply off-hours adjustment if applicable
    const offHoursAdj = orgAdjustments.find(r => r.type === 'off_hours_adjustment' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (offHoursAdj) {
      const isOffHours = (() => {
        if (!sd.startTime || !sd.endTime) return false;
        
        const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
        const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
        
        const startHour = startTime.getHours();
        const endHour = endTime.getHours();
        
        const outsideStart = Number(offHoursAdj.data?.outsideStart?.split(':')[0]) || 9;
        const outsideEnd = Number(offHoursAdj.data?.outsideEnd?.split(':')[0]) || 17;
        
        return startHour < outsideStart || endHour > outsideEnd;
      })();
      
      if (isOffHours) {
        const rateType = (offHoursAdj.data?.rateType as 'percentage' | 'fixed') || 'fixed';
        const adjustment = (offHoursAdj.data?.adjustment as 'surcharge' | 'discount') || 'surcharge';
        const rateAmount = Number(offHoursAdj.data?.rateAmount || 0);
        
        if (rateType === 'percentage') {
          if (adjustment === 'surcharge') {
            total += discountedPrice * (rateAmount / 100);
          } else {
            total -= discountedPrice * (rateAmount / 100);
          }
        } else {
          if (adjustment === 'surcharge') {
            total += rateAmount;
          } else {
            total -= Math.abs(rateAmount);
          }
        }
      }
    }
    
    // Apply off-days adjustment if applicable
    const offDaysAdj = orgAdjustments.find(r => r.type === 'off_days_adjustment' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (offDaysAdj) {
      const isOffDays = (() => {
        if (!sd.startDate || !sd.endDate) return false;
        
        const startDate = new Date(sd.startDate + 'T00:00:00Z');
        const endDate = new Date(sd.endDate + 'T00:00:00Z');
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dayOfWeek = date.getUTCDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            return true;
          }
        }
        return false;
      })();
      
      if (isOffDays) {
        const rateType = (offDaysAdj.data?.rateType as 'percentage' | 'fixed') || 'percentage';
        const adjustment = (offDaysAdj.data?.adjustment as 'surcharge' | 'discount') || 'discount';
        
        if (rateType === 'percentage') {
          const percent = Number(offDaysAdj.data?.ratePercent || 20);
          if (adjustment === 'surcharge') {
            total += discountedPrice * (percent / 100);
          } else {
            total -= discountedPrice * (percent / 100);
          }
        } else {
          const amount = Number(offDaysAdj.data?.rateAmount || 0);
          if (adjustment === 'surcharge') {
            total += amount;
          } else {
            total -= Math.abs(amount);
          }
        }
      }
    }
    
    // Apply fee if exists
    if (selectedProperty?.fee_value && selectedProperty.fee_value > 0) {
      if (selectedProperty.fee_type === 'percentage') {
        const feeAmount = total * (selectedProperty.fee_value / 100);
        total += feeAmount;
      } else {
        total += selectedProperty.fee_value;
      }
    }
    
    // Apply tax if exists
    if (selectedProperty?.tax_rate && selectedProperty.tax_rate > 0) {
      const taxAmount = total * (selectedProperty.tax_rate / 100);
      total += taxAmount;
    }
    
    // Apply discount (legacy - for backward compatibility)
    if (formData.discount_type && formData.discount_value > 0) {
      if (formData.discount_type === 'percentage') {
        total -= total * (formData.discount_value / 100);
      } else {
        total -= formData.discount_value;
      }
    }
    
    return total;
  };

  // Calculate pre-tax total for Price Summary
  const calculatePreTaxTotal = () => {
    const sd = selectedDates;
    const prop = selectedProperty;
    if (!sd?.startDate || !sd?.endDate || !prop) return 0;

    let total = calculateBasePrice();
    
    // Apply user-selected discounts first
    const selectedDiscountRows = orgAdjustments
      .filter(r => r.type === 'user_selected_discount' && selectedUserDiscounts[r.id] && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    
    for (const discount of selectedDiscountRows) {
      const rateType = (discount.data?.rateType as 'percentage' | 'fixed') || 'percentage';
      const discountAmount = Number(discount.data?.discountPercent || discount.data?.value || 0);
      if (rateType === 'percentage') {
        total -= total * (discountAmount / 100);
      } else {
        total -= Math.abs(discountAmount);
      }
    }
    
    // Store the discounted price for percentage-based surcharges
    const discountedPrice = total;
    
    // Apply capacity surcharge if applicable
    const capacityAdj = orgAdjustments.find(r => r.type === 'capacity_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (capacityAdj) {
      const bracketSize = Number(capacityAdj.data?.perHeadcount);
      const surchargePerBracket = Number(capacityAdj.data?.surchargeAmount);
      const rateType = (capacityAdj.data?.rateType as 'percentage' | 'fixed') || 'fixed';
      
      if (rateType === 'fixed') {
        const includedPeople = Number(capacityAdj.data?.perHeadcount);
        const excessPeople = Math.max(0, formData.headcount - includedPeople);
        const brackets = Math.ceil(excessPeople / bracketSize);
        const hours = prop.price_per_hour && sd.startTime && sd.endTime
          ? (() => {
              const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
              const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
              return Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            })()
          : 1;
        
        const capacitySurchargeAmount = brackets * surchargePerBracket * hours;
        total += capacitySurchargeAmount;
      } else {
        const includedPeople = Number(capacityAdj.data?.perHeadcount);
        const excessPeople = Math.max(0, formData.headcount - includedPeople);
        const brackets = Math.ceil(excessPeople / bracketSize);
        const hours = prop.price_per_hour && sd.startTime && sd.endTime
          ? (() => {
              const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
              const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
              return Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            })()
          : 1;
        
        const bracketSurcharge = brackets * Number(capacityAdj.data?.value || 0);
        total += discountedPrice * (bracketSurcharge / 100);
      }
    }
    
    // Apply off-hours adjustment if applicable
    const offHoursAdj = orgAdjustments.find(r => r.type === 'off_hours_adjustment' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (offHoursAdj) {
      const isOffHours = (() => {
        if (!sd.startTime || !sd.endTime) return false;
        
        const startTime = new Date(`${sd.startDate}T${sd.startTime}`);
        const endTime = new Date(`${sd.endDate}T${sd.endTime}`);
        
        const startHour = startTime.getHours();
        const endHour = endTime.getHours();
        
        const outsideStart = Number(offHoursAdj.data?.outsideStart?.split(':')[0]) || 9;
        const outsideEnd = Number(offHoursAdj.data?.outsideEnd?.split(':')[0]) || 17;
        
        return startHour < outsideStart || endHour > outsideEnd;
      })();
      
      if (isOffHours) {
        const rateType = (offHoursAdj.data?.rateType as 'percentage' | 'fixed') || 'fixed';
        const adjustment = (offHoursAdj.data?.adjustment as 'surcharge' | 'discount') || 'surcharge';
        const rateAmount = Number(offHoursAdj.data?.rateAmount || 0);
        
        if (rateType === 'percentage') {
          if (adjustment === 'surcharge') {
            total += discountedPrice * (rateAmount / 100);
          } else {
            total -= discountedPrice * (rateAmount / 100);
          }
        } else {
          if (adjustment === 'surcharge') {
            total += rateAmount;
          } else {
            total -= Math.abs(rateAmount);
          }
        }
      }
    }
    
    // Apply off-days adjustment if applicable
    const offDaysAdj = orgAdjustments.find(r => r.type === 'off_days_adjustment' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
    if (offDaysAdj) {
      const isOffDays = (() => {
        if (!sd.startDate || !sd.endDate) return false;
        
        const startDate = new Date(sd.startDate + 'T00:00:00Z');
        const endDate = new Date(sd.endDate + 'T00:00:00Z');
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dayOfWeek = date.getUTCDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            return true;
          }
        }
        return false;
      })();
      
      if (isOffDays) {
        const rateType = (offDaysAdj.data?.rateType as 'percentage' | 'fixed') || 'percentage';
        const adjustment = (offDaysAdj.data?.adjustment as 'surcharge' | 'discount') || 'discount';
        
        if (rateType === 'percentage') {
          const percent = Number(offDaysAdj.data?.ratePercent || 20);
          if (adjustment === 'surcharge') {
            total += discountedPrice * (percent / 100);
          } else {
            total -= discountedPrice * (percent / 100);
          }
        } else {
          const amount = Number(offDaysAdj.data?.rateAmount || 0);
          if (adjustment === 'surcharge') {
            total += amount;
          } else {
            total -= Math.abs(amount);
          }
        }
      }
    }
    
    // Apply fee if exists
    if (selectedProperty?.fee_value && selectedProperty.fee_value > 0) {
      if (selectedProperty.fee_type === 'percentage') {
        const feeAmount = total * (selectedProperty.fee_value / 100);
        total += feeAmount;
      } else {
        total += selectedProperty.fee_value;
      }
    }
    
    // Apply discount (legacy - for backward compatibility)
    if (formData.discount_type && formData.discount_value > 0) {
      if (formData.discount_type === 'percentage') {
        total -= total * (formData.discount_value / 100);
      } else {
        total -= formData.discount_value;
      }
    }
    
    return total;
  };

  // Create formatted message content with price summary
  const createFormattedMessage = () => {
    let message = '';
    
    // Calculate pricing details
    const basePrice = calculateBasePrice();
    const subtotal = calculatePreTaxTotal();
    const taxAmount = selectedProperty?.tax_rate ? subtotal * (selectedProperty.tax_rate / 100) : 0;
    const total = calculateTotal();
    
    // Calculate hours from dates
    let hours = 0;
    if (selectedDates?.startTime && selectedDates?.endTime) {
      const start = new Date(`2026-01-01T${selectedDates.startTime}`);
      const end = new Date(`2026-01-01T${selectedDates.endTime}`);
      hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }
    
    // Debug the values
    console.log('createFormattedMessage debug:', {
      originalMessage: formData.message,
      basePrice,
      subtotal,
      taxAmount,
      total,
      hours,
      hourlyRate: hours > 0 ? basePrice / hours : 0
    });
    
    // Build the formatted message with double line breaks for paragraphs
    message += 'Proposed Time:\n\n';
    message += `${formatDateRange()}\n\n`;
    
    message += 'Price Summary:\n';
    message += `Base Price ($${selectedProperty?.price_per_hour || 25} x ${hours} hours): $${basePrice.toFixed(2)}\n`;
    
    if (subtotal !== basePrice) {
      message += `Subtotal: $${subtotal.toFixed(2)}\n`;
    }
    
    if (taxAmount > 0) {
      message += `Tax (${selectedProperty?.tax_rate}%): $${taxAmount.toFixed(2)}\n`;
    }
    
    message += `Total: $${total.toFixed(2)}\n\n`;
    
    // Add guest message if provided, preserving line breaks
    if (formData.message) {
      message += formData.message;
    }
    
    console.log('Final formatted message:', message);
    return message;
  };
  const formatDateRange = () => {
    if (!selectedDates?.startDate || !selectedDates?.endDate) return '';
    
    const startDate = new Date(`${selectedDates.startDate}${selectedDates.startTime ? 'T' + selectedDates.startTime : ''}`);
    const endDate = new Date(`${selectedDates.endDate}${selectedDates.endTime ? 'T' + selectedDates.endTime : ''}`);
    
    const sameDate = startDate.getFullYear() === endDate.getFullYear() && 
                   startDate.getMonth() === endDate.getMonth() && 
                   startDate.getDate() === endDate.getDate();
    
    const dateFmt = new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeFmt = new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    const startStr = `${dateFmt.format(startDate)}, ${timeFmt.format(startDate)}`;
    const endStr = sameDate ? `${timeFmt.format(endDate)}` : `${dateFmt.format(endDate)}, ${timeFmt.format(endDate)}`;
    
    return `${startStr} – ${endStr}`;
  };
  const getBasePriceBreakdown = () => {
    if (!selectedProperty) return 'Select dates to calculate';
    
    if (selectedProperty.price_per_hour && selectedDates?.startTime && selectedDates?.endTime) {
      const hours = (() => {
        if (!selectedDates?.startDate || !selectedDates?.endDate || !selectedDates?.startTime || !selectedDates?.endTime) return null;
        const startTime = new Date(`${selectedDates.startDate}T${selectedDates.startTime}`);
        const endTime = new Date(`${selectedDates.endDate}T${selectedDates.endTime}`);
        return Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
      })();
      return hours ? `($${selectedProperty.price_per_hour} x ${hours} hours)` : 'Select dates to calculate';
    } else if (selectedProperty.price_per_day) {
      const days = (() => {
        if (!selectedDates?.startDate || !selectedDates?.endDate) return null;
        const start = new Date(selectedDates.startDate);
        const end = new Date(selectedDates.endDate);
        return Math.max(Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 1);
      })();
      return days ? `($${selectedProperty.price_per_day} x ${days} days)` : 'Select dates to calculate';
    } else {
      return 'Select dates to calculate';
    }
  };
  const [showForm, setShowForm] = React.useState(false);

  // Read URL parameters on mount
  React.useEffect(() => {
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');


    if (startDate && endDate) {
      setSelectedDates({
        startDate,
        endDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      });
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!user) return;
    fetchUserProperties();
  }, [user]);

  // Auto-select single property if only one exists
  React.useEffect(() => {
    if (properties.length === 1 && !selectedProperty) {
      setSelectedProperty(properties[0]);
    }
  }, [properties, selectedProperty]);

  // Debug selected property changes
  React.useEffect(() => {
    if (selectedProperty) {
    }
  }, [selectedProperty]);

  const fetchUserProperties = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseSelect = 'id, title, price_per_day, price_per_hour, currency, inquire_for_pricing, weekly_rate, monthly_rate, yearly_rate_value, tax_rate, capacity, organization_id, applied_adjustment_ids, fee_type, fee_value, fee_description';
      const select = `${baseSelect}, applied_adjustment_tokens`;

      const trySelect = async (includeTokens: boolean) => {
        return await supabase
          .from('properties')
          .select(includeTokens ? select : baseSelect)
          .eq('venue_id', user!.id)
          .eq('published', true);
      };

      let { data: propertiesData, error: propertiesError } = await trySelect(true);
      if (propertiesError && /applied_adjustment_tokens|PGRST204|column/i.test(propertiesError.message || '')) {
        ({ data: propertiesData, error: propertiesError } = await trySelect(false));
      }
      if (propertiesError) throw propertiesError;

      setProperties(((propertiesData as any[]) || []) as unknown as Property[]);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
  };

  const handleDateSelect = (dates: typeof selectedDates) => {
    setSelectedDates(dates);
  };

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  const handleCancel = () => {
    // Clear form data
    setFormData({
      guest_email: '',
      guest_name: '',
      message: '',
      price_total: 0,
      currency: 'USD',
      selected_adjustment_ids: [] as string[],
      discount_type: '',
      discount_value: 0,
      headcount: 1,
      capacity_surcharge_applied: false,
      off_hours_surcharge_applied: false,
      expires_at: '',
    });
    setGuestUserLookup({ isSearching: false, found: false });
    setSelectedDates(null);
    setSelectedProperty(null);
    setError(null);
    
    // Navigate back to calendar
    navigate('/calendar');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return; // Prevent double submission
    
    if (!selectedDates?.startDate || !selectedDates?.endDate) {
      setError('Please select dates for the proposal');
      return;
    }

    // Validate guest email
    if (!formData.guest_email || !formData.guest_email.includes('@')) {
      setError('Please enter a valid guest email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Determine the guest user ID
      let guestUserId: string;
      
      if (guestUserLookup.found && guestUserLookup.user) {
        // Use existing user
        guestUserId = guestUserLookup.user.id;
      } else {
        // Create temporary profile for new user using RPC function
        // Set a temporary proposal ID that will be updated after proposal creation
        const tempProposalId = crypto.randomUUID();
        const guestProfileId = crypto.randomUUID();
        
        const { data: newProfile, error: profileError } = await supabase
          .rpc('create_guest_profile', {
            profile_id: guestProfileId,
            guest_email: formData.guest_email.toLowerCase(),
            guest_name: formData.guest_name || formData.guest_email.split('@')[0],
            temp_proposal_id: tempProposalId
          });
          
        if (profileError) {
          console.error('Profile creation failed:', {
            error: profileError,
            guestEmail: formData.guest_email,
            guestName: formData.guest_name,
            user: user?.id
          });
          throw new Error(`Failed to create guest profile: ${profileError.message}`);
        }
        
        // RPC returns an array, get the first result and extract the ID
        guestUserId = guestProfileId; // Use the ID we generated
        
        // Store the temp proposal ID to update later
        (window as any).tempProposalId = tempProposalId;
      }

      // First create an inquiry
      // Check if there's an active capacity surcharge to determine if we should save headcount
      const hasCapacitySurcharge = orgAdjustments.some(r => 
        r.type === 'capacity_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet)
      );
      
      // Create proper local timezone datetime strings
      const createLocalDateTime = (dateStr: string, timeStr: string) => {
        const date = new Date(dateStr);
        const [hours, minutes] = timeStr.split(':');
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return date.toISOString();
      };

      const inquiryInsertData = {
        property_id: selectedProperty!.id,
        user_id: guestUserId, // Use guest user ID
        start_date: selectedDates!.startDate,
        end_date: selectedDates!.endDate,
        start_at: selectedDates!.startTime ? createLocalDateTime(selectedDates!.startDate, selectedDates!.startTime) : null,
        end_at: selectedDates!.endTime ? createLocalDateTime(selectedDates!.endDate, selectedDates!.endTime) : null,
        headcount: hasCapacitySurcharge ? formData.headcount : null,
        message: formData.message,
        status: 'pending',
      };

      const { data: inquiryData, error: inquiryError } = await supabase
        .from('inquiries')
        .insert(inquiryInsertData)
        .select()
        .single();

      if (inquiryError) {
        throw inquiryError;
      }

      // Then create a proposal linked to the inquiry
      // Calculate expiration date
      const expiresAt = formData.expires_at 
        ? new Date(formData.expires_at + 'T00:00:00.000Z').toISOString() // Treat as UTC midnight
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
      
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          inquiry_id: inquiryData.id, // Use the actual inquiry ID
          price_total: calculateTotal(), // Use the calculated total
          currency: selectedProperty.currency || 'USD', // Use property currency
          message: formData.message,
          status: 'open',
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (proposalError) {
        throw proposalError;
      }

      // Update the guest profile with the actual proposal ID if this was a new user
      if (!guestUserLookup.found) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ invited_via_proposal_id: proposalData.id })
          .eq('id', guestUserId);
          
        if (profileUpdateError) {
          console.error('Error updating guest profile with proposal ID:', profileUpdateError);
          // Don't throw here - the proposal was created successfully
        }
        
        // Clean up the temporary proposal ID
        delete (window as any).tempProposalId;
      }

      // Update the inquiry status to reflect that a proposal has been created
      const { error: inquiryUpdateError } = await supabase
        .from('inquiries')
        .update({ status: 'converted_to_proposal' })
        .eq('id', inquiryData.id);

      if (inquiryUpdateError) {
        console.error('Error updating inquiry status:', inquiryUpdateError);
        // Don't throw here - the proposal was created successfully
      }

      // Handle email notification based on user status
      if (guestUserLookup.found && guestUserLookup.user) {
        // Existing user - send regular payment request email
        try {
          await sendNotification(
            'payment_request',
            {
              email: formData.guest_email,
              name: formData.guest_name || guestUserLookup.user.full_name || 'Guest'
            },
            {
              propertyTitle: selectedProperty!.title,
              inquiryId: inquiryData.id,
              proposalId: proposalData.id,
              priceTotal: calculateTotal(),
              currency: selectedProperty!.currency || 'USD',
              expiresAt: expiresAt,
              bookingDetailsUrl: `${window.location.origin}/messages?inquiry=${inquiryData.id}`,
              dateRange: formatDateRange(),
              startDate: selectedDates!.startDate,
              endDate: selectedDates!.endDate,
              startTime: selectedDates!.startTime,
              endTime: selectedDates!.endTime,
              message: formData.message,
              MESSAGE_CONTENT: createFormattedMessage(), // Try uppercase to match template
              dashboardUrl: `${window.location.origin}/messages?inquiry=${inquiryData.id}`,
            }
          );
        } catch (emailError) {
          console.error('Failed to send payment request email:', emailError);
          // Don't fail the whole process if email fails
        }
      } else {
        // New user - send invitation email with magic link
        try {
          // Generate magic link for new user
          const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
            email: formData.guest_email,
            options: {
              emailRedirectTo: `${window.location.origin}/proposal/${proposalData.id}/finalize`
            }
          });

          if (otpError) {
            console.error('Failed to generate magic link:', otpError);
            // Fallback to direct link if magic link fails
            var proposalLink = `${window.location.origin}/proposal/${proposalData.id}/finalize`;
            var needsMagicLink = false;
          } else {
            // Magic link generated successfully
            var proposalLink = `${window.location.origin}/proposal/${proposalData.id}/finalize`;
            var needsMagicLink = true;
            console.log('Magic link generated for new user:', formData.guest_email);
          }
          
          await sendNotification(
            'payment_request',
            {
              email: formData.guest_email,
              name: formData.guest_name || 'Guest'
            },
            {
              propertyTitle: selectedProperty!.title,
              inquiryId: inquiryData.id,
              proposalId: proposalData.id,
              priceTotal: calculateTotal(),
              currency: selectedProperty.currency || 'USD',
              expiresAt: expiresAt,
              bookingDetailsUrl: proposalLink,
              dateRange: formatDateRange(),
              startDate: selectedDates!.startDate,
              endDate: selectedDates!.endDate,
              startTime: selectedDates!.startTime,
              endTime: selectedDates!.endTime,
              message: formData.message,
              MESSAGE_CONTENT: createFormattedMessage(), // Try uppercase to match template
              isNewUser: true, // Flag for template customization
              needsMagicLink: needsMagicLink, // Flag to indicate magic link was sent
            }
          );
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Don't fail the whole process if email fails
        }
      }

      handleSuccess();
    } catch (error) {
      console.error('Error creating proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Please sign in to create proposals</h2>
          <a href="/signin" className="text-blue-600 hover:text-blue-800">Sign In</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Properties</h2>
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

  if (properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Properties Found</h2>
          <p className="text-gray-600 mb-4">You need to add properties before you can create proposals.</p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#620E28] mb-2">Open Proposal</h1>
        </div>

        {/* Property Selection */}
        {properties.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Property</h2>
            
            <div>
              <p className="text-gray-600 mb-4">Select a property to create a proposal for:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    onClick={() => handlePropertySelect(property)}
                    className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-[#620E28] hover:shadow-md transition-all"
                  >
                    <h3 className="font-semibold text-gray-900">{property.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {property.inquire_for_pricing ? 'Inquire for pricing' : 
                       property.price_per_day ? 
                         `Daily: ${formatCurrency(property.price_per_day, property.currency || 'USD')}` :
                         property.price_per_hour ?
                           `Hourly: ${formatCurrency(property.price_per_hour, property.currency || 'USD')}` :
                           'Contact for pricing'
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Combined Proposal Form */}
        {selectedProperty && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-semibold text-maroon-800 mb-6">Create Proposal</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Property Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedProperty.title}</h3>
                <p className="text-sm text-gray-600">
                  Base Price: {formatCurrency(selectedProperty.price_per_day || selectedProperty.price_per_hour || 0, selectedProperty.currency || undefined)} per {selectedProperty.price_per_hour ? 'hour' : 'day'}
                </p>
              </div>

              {/* Guest Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Guest Information</h3>
                
                {/* Email Field */}
                <div>
                  <label htmlFor="guest_email" className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="guest_email"
                    value={formData.guest_email}
                    onChange={(e) => {
                      const email = e.target.value;
                      setFormData(prev => ({ ...prev, guest_email: email }));
                      checkGuestEmail(email);
                    }}
                    className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:border-maroon-500 focus:outline-none"
                    placeholder="guest@example.com"
                    required
                  />
                  
                  {/* User Status Indicator */}
                  {formData.guest_email && (
                    <div className="mt-2">
                      {guestUserLookup.isSearching ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Checking...
                        </span>
                      ) : guestUserLookup.found ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Registered User
                        </span>
                      ) : formData.guest_email.includes('@') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          User will be invited to register
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Name Field */}
                <div>
                  <label htmlFor="guest_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="guest_name"
                    value={formData.guest_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
                    className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:border-maroon-500 focus:outline-none"
                    placeholder="John Doe"
                    disabled={guestUserLookup.found} // Disable if user is found (auto-populated)
                  />
                  {guestUserLookup.found && (
                    <p className="mt-1 text-xs text-gray-500">Name auto-populated from registered user profile</p>
                  )}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={selectedDates?.startDate || ''}
                      onChange={(e) => {
                        const newStartDate = e.target.value;
                        setSelectedDates((prev) => {
                          const base = prev ?? { startDate: newStartDate, endDate: newStartDate };
                          const endDate = base.endDate && new Date(base.endDate) < new Date(newStartDate)
                            ? newStartDate
                            : base.endDate;
                          return { ...base, startDate: newStartDate, endDate };
                        });
                      }}
                      className="w-full rounded-xl border-2 border-maroon-200 p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={selectedDates?.endDate || ''}
                      onChange={(e) => {
                        const newEndDate = e.target.value;
                        setSelectedDates((prev) => {
                          const base = prev ?? { startDate: newEndDate, endDate: newEndDate };
                          const startDate = base.startDate && new Date(base.startDate) > new Date(newEndDate)
                            ? newEndDate
                            : base.startDate;
                          return { ...base, endDate: newEndDate, startDate };
                        });
                      }}
                      min={selectedDates?.startDate || ''}
                      className="w-full rounded-xl border-2 border-maroon-200 p-2"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Time Selection for Hourly */}
              {selectedProperty.price_per_hour && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-900">Time Selection</h4>
                    <button
                      type="button"
                      onClick={() => setSelectedDates(prev => (prev ? { ...prev, startTime: undefined, endTime: undefined } : null))}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear Times
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={selectedDates?.startTime || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedDates((prev) => {
                            if (prev) return { ...prev, startTime: v };
                            const startDate = selectedDates?.startDate ?? '';
                            const endDate = selectedDates?.endDate ?? startDate;
                            return { startDate, endDate, startTime: v, endTime: '' };
                          });
                        }}
                        className="w-full rounded-xl border-2 border-maroon-200 p-2"
                        step="900"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={selectedDates?.endTime || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedDates((prev) => {
                            if (prev) return { ...prev, endTime: v };
                            const startDate = selectedDates?.startDate ?? '';
                            const endDate = selectedDates?.endDate ?? startDate;
                            return { startDate, endDate, startTime: '', endTime: v };
                          });
                        }}
                        className="w-full rounded-xl border-2 border-maroon-200 p-2"
                        step="900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Adjustments */}
              {(() => {
                // Check if there are any active pricing adjustments that require user input
                const hasUserDiscounts = orgAdjustments.some(r => 
                  r.type === 'user_selected_discount' && 
                  ((r.data as any)?.active ?? true) !== false && 
                  isAdjustmentApplied(r, appliedAdjustmentTokenSet)
                );
                
                const hasCapacitySurcharge = orgAdjustments.some(r => 
                  r.type === 'capacity_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet)
                );
                
                const hasOffHoursSurcharge = orgAdjustments.some(r => 
                  r.type === 'off_hours_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet)
                );
                
                // Only show the section if there are any adjustments that need user input
                if (!hasUserDiscounts && !hasCapacitySurcharge && !hasOffHoursSurcharge) {
                  return null;
                }
                
                return (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Pricing Adjustments</h3>
                    
                    {/* Headcount - only show if capacity surcharge is active */}
                    {hasCapacitySurcharge && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Headcount *
                        </label>
                        <input
                          type="number"
                          value={formData.headcount}
                          onChange={(e) => setFormData(prev => ({ ...prev, headcount: Number(e.target.value) }))}
                          className="w-full rounded-xl border-2 border-maroon-200 p-2"
                          min="1"
                          step="1"
                        />
                        {selectedProperty.capacity && (
                          <p className="text-xs text-gray-500 mt-1">
                            Property capacity: {selectedProperty.capacity} people
                          </p>
                        )}
                      </div>
                    )}

                    {/* Discount Options (user-selected) — only if applied on this property */}
                    {hasUserDiscounts && (() => {
                      try {
                        const userDiscounts = orgAdjustments
                          .filter(r => {
                            const d = (r?.data ?? {}) as any;
                            return r.type === 'user_selected_discount' && ((d?.active ?? true) !== false) && isAdjustmentApplied(r, appliedAdjustmentTokenSet);
                          });
                        if (!userDiscounts.length) return null;
                        return (
                          <div className="mt-4 px-4 py-3 border border-maroon-200 rounded-xl bg-white">
                            <h4 className="text-sm font-semibold text-maroon-800 mb-2">Discount Options</h4>
                            <div className="space-y-2">
                              {userDiscounts.map((row) => {
                                const label = (row.data?.name as string) || 'User-selected discount';
                                const requiredDoc = (row.data?.requiredDocumentation as string);
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
                                      {requiredDoc ? (
                                        <div className="text-xs text-maroon-600 mt-0.5">Required Documentation: {requiredDoc}</div>
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

                    {/* Off-Hours Adjustment */}
                    {hasOffHoursSurcharge && (() => {
                      const offHoursAdj = orgAdjustments.find(r => r.type === 'off_hours_surcharge' && isAdjustmentApplied(r, appliedAdjustmentTokenSet));
                      if (!offHoursAdj) return null;
                      
                      return (
                        <div>
                          <label className="flex items-center text-sm text-gray-700 mb-1">
                            <input
                              type="checkbox"
                              checked={formData.off_hours_surcharge_applied}
                              onChange={(e) => setFormData(prev => ({ ...prev, off_hours_surcharge_applied: e.target.checked }))}
                              className="mr-2"
                            />
                            Apply Off-Hours Surcharge
                            {offHoursAdj.data?.name && (
                              <span className="ml-1 text-xs text-gray-500">({offHoursAdj.data.name})</span>
                            )}
                          </label>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Price Summary */}
              <PriceSummary
                basePrice={calculateBasePrice()}
                subtotal={calculatePreTaxTotal()}
                total={calculateTotal()}
                currency={selectedProperty.currency || 'USD'}
                discount={formData.discount_type && formData.discount_value > 0 ? {
                  type: formData.discount_type as 'percentage' | 'fixed',
                  value: formData.discount_value
                } : undefined}
                fee={selectedProperty.fee_value ? {
                  description: selectedProperty.fee_description || undefined,
                  type: selectedProperty.fee_type as 'percentage' | 'fixed',
                  value: selectedProperty.fee_value
                } : undefined}
                taxRate={selectedProperty.tax_rate || undefined}
                basePriceBreakdown={getBasePriceBreakdown()}
              />

              {/* Optional Expiration Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proposal Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  min={new Date().toISOString().split('T')[0]} // Can't set expiration in the past
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank for 30-day default expiration
                </p>
              </div>

              {/* Message to Guest - Non-mandatory, moved to bottom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message to Guest
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-3"
                  rows={4}
                  placeholder="Optional message to the guest..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedDates?.startDate || !selectedDates?.endDate}
                  className="bg-[#620E28] text-white px-4 py-2 rounded-md hover:bg-[#4A5F25] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating Proposal...' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenProposalPage;
