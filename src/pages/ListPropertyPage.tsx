import React, { useState, useEffect, useCallback } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, DollarSign, List, HelpCircle, ArrowLeft, ArrowRight, FileEdit, EyeIcon } from 'lucide-react';
import ImageUploader from '../components/ui/ImageUploader';
import { Button } from '../components/ui/button';
import PropertySchedule from '../components/property/PropertySchedule';
import { Input } from '../components/ui/input';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadPropertyImages } from '../lib/upload/r2Uploader';
import { SPACE_ATTRIBUTES } from '../types';
import { PROPERTY_TYPES, AMENITIES } from '../types';
import { getLogger } from '../lib/logger';

const ListPropertyPage: React.FC = () => {
  usePageHeaderTitle('List Your Space');
  const navigate = useNavigate();
  const { user, sessionUser, isImpersonating } = useAuth();
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ primary_organization_id: string | null } | null>(null);
  const [organizationStripeSetup, setOrganizationStripeSetup] = useState<{ hasStripe: boolean; chargesEnabled: boolean } | null>(null);
  // Removed unused propertyId state
  const [images, setImages] = useState<File[]>([]);
  const log = getLogger({ page: 'ListPropertyPage' });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    address_country: 'US',
    neighborhood: '',
    metro_area: '',
    price_per_day: '',
    price_per_hour: '',
    show_hourly: false,
    show_daily: true,
    inquire_for_pricing: false,
    square_feet: '',
    capacity: '',
    property_type: 'retail',
    amenities: [] as string[],
    space_attributes: [] as string[],
    weekly_rate_enabled: false,
    weekly_rate_type: 'percentage',
    weekly_rate_value: '',
    monthly_rate_enabled: false,
    monthly_rate_type: 'percentage',
    monthly_rate_value: '',
    yearly_rate_enabled: false,
    yearly_rate_type: 'percentage',
    yearly_rate_value: '',
  });

  // Feature-detect support for hourly column to avoid 400s if migration hasn't run yet
  const [supportsHourly, setSupportsHourly] = useState<boolean>(true);
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase
          .from('properties')
          .select('price_per_hour')
          .limit(1);
        if (error && /price_per_hour/i.test(error.message || '')) {
          setSupportsHourly(false);
        } else {
          setSupportsHourly(true);
        }
      } catch {
        // Default to true; we'll fail soft by omitting the field below if unsupported
        setSupportsHourly(true);
      }
    })();
  }, []);
  
  // Prepare form data for submission
  const prepareFormData = () => {
    // Create a new object with all form data
    const data = { ...formData };
    
    // Remove UI-only fields that shouldn't be sent to the database
    const {
      weekly_rate_enabled,
      monthly_rate_enabled,
      yearly_rate_enabled,
      show_daily,
      show_hourly,
      ...cleanData
    } = data;
    
    // Return a new object with only the fields we want to submit
    return {
      ...cleanData,
      // Only include rate fields if they are enabled
      weekly_rate_type: weekly_rate_enabled ? data.weekly_rate_type : undefined,
      weekly_rate_value: weekly_rate_enabled ? data.weekly_rate_value : undefined,
      monthly_rate_type: monthly_rate_enabled ? data.monthly_rate_type : undefined,
      monthly_rate_value: monthly_rate_enabled ? data.monthly_rate_value : undefined,
      yearly_rate_type: yearly_rate_enabled ? data.yearly_rate_type : undefined,
      yearly_rate_value: yearly_rate_enabled ? data.yearly_rate_value : undefined,
    };
  };

  // Import Schedule type from PropertySchedule
  type Schedule = {
    showStartDate: boolean;
    showEndDate: boolean;
    limitAvailability: boolean;
    available_from: string;
    available_until: string;
    availability: {
      [key: string]: {
        enabled: boolean;
        start: string;
        end: string;
      };
    };
  };

  const [schedule, setSchedule] = useState<Schedule>({
    showStartDate: false,
    showEndDate: false,
    limitAvailability: false,
    available_from: '',
    available_until: '',
    availability: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    },
  });

  // Handle navigation when user is not logged in
  useEffect(() => {
    if (user === null) {
      navigate('/signup?redirect=/list-property');
    }
  }, [user, navigate]);

  // Fetch user profile to check organization status
  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('primary_organization_id')
            .eq('id', user.id)
            .single();
          
          if (!profileError && profileData) {
            setUserProfile(profileData);
            
            // If user has an organization, check Stripe setup
            if (profileData.primary_organization_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('stripe_account_id, charges_enabled')
                .eq('id', profileData.primary_organization_id)
                .single();
              
              if (!orgError && orgData) {
                setOrganizationStripeSetup({
                  hasStripe: !!orgData.stripe_account_id,
                  chargesEnabled: !!orgData.charges_enabled
                });
              }
            }
          }
        } catch (err) {
          log.error('Error fetching user profile', { err });
        }
      };
      
      fetchUserProfile();
    }
  }, [user, log]);

  // Return null if user is not logged in to prevent rendering
  if (!user) {
    return null;
  }

  const handleImageChange = useCallback((selectedFiles: File[]) => {
    setImages(prev => [...prev, ...selectedFiles]);
  }, []);

  const handleSubmit = async (e: React.FormEvent, saveAsDraft: boolean = false, previewOnly: boolean = false) => {
    e.preventDefault();
    
    // Set the appropriate loading state
    if (previewOnly) {
      setPreviewLoading(true);
    } else if (saveAsDraft) {
      setDraftSaving(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    // Robust client-side validation for required fields
    const missingFields: string[] = [];
    if (!formData.title.trim()) missingFields.push('Property Title');
    if (!formData.description.trim()) missingFields.push('Description');
    if (!formData.address_street.trim()) missingFields.push('Street Address');
    if (!formData.address_city.trim()) missingFields.push('City');
    if (!formData.address_state.trim()) missingFields.push('State');
    if (!formData.address_postal_code.trim()) missingFields.push('Postal Code');
    if (!formData.square_feet.trim() || isNaN(Number(formData.square_feet)) || Number(formData.square_feet) <= 0) missingFields.push('Square Feet');
    if (!formData.property_type.trim()) missingFields.push('Property Type');
    if (!formData.inquire_for_pricing && formData.show_daily) {
      if (!formData.price_per_day.trim() || isNaN(Number(formData.price_per_day)) || Number(formData.price_per_day) < 0) {
        missingFields.push('Base daily rate');
      }
    }
    if (images.length === 0) missingFields.push('At least one Property Image');

    if (missingFields.length > 0) {
      setError(
        `Please complete the following required fields before proceeding:\n- ` + missingFields.join('\n- ')
      );
      setLoading(false);
      setDraftSaving(false);
      setPreviewLoading(false);
      return;
    }


    try {
      // Get coordinates from address using OpenStreetMap Nominatim API
      const address = `${formData.address_street}, ${formData.address_city}, ${formData.address_state} ${formData.address_postal_code}, ${formData.address_country}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const locationData = await response.json();

      if (!locationData?.[0]) {
        throw new Error('Could not geocode address. Please check the address and try again.');
      }

      // Prepare property data (insert WITHOUT images first)
      const formDataForInsert = prepareFormData();

      const shouldSaveSchedule = schedule.limitAvailability || schedule.showStartDate || schedule.showEndDate;
      const schedulePayloadBase = shouldSaveSchedule
        ? {
            limit_availability: schedule.limitAvailability,
            available_from: schedule.showStartDate ? schedule.available_from || null : null,
            available_until: schedule.showEndDate ? schedule.available_until || null : null,
            daily_schedule: schedule.limitAvailability ? schedule.availability : null,
          }
        : null;

      // Helper to safely parse numeric strings; returns null if NaN
      const toNumberOrNull = (v: any) => {
        const n = typeof v === 'string' ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : null;
      };

      // Longer-term pricing inputs (legacy)
      const weeklyRateType = formData.weekly_rate_enabled ? formData.weekly_rate_type : null;
      const weeklyRateValue = formData.weekly_rate_enabled ? parseFloat(formData.weekly_rate_value as string) || null : null;
      const monthlyRateType = formData.monthly_rate_enabled ? formData.monthly_rate_type : null;
      const monthlyRateValue = formData.monthly_rate_enabled ? parseFloat(formData.monthly_rate_value as string) || null : null;
      const yearlyRateType = formData.yearly_rate_enabled ? formData.yearly_rate_type : null;
      const yearlyRateValue = formData.yearly_rate_enabled ? parseFloat(formData.yearly_rate_value as string) || null : null;

      // Calculate new pricing fields based on base daily rate
      const basePerDay = formData.inquire_for_pricing ? null : (formData.show_daily ? toNumberOrNull(formData.price_per_day) : toNumberOrNull(formData.price_per_day));
      const calcFrom = (days: number, type: 'fixed' | 'percentage' | null, value: number | null) => {
        if (!basePerDay || !Number.isFinite(basePerDay) || !type || value == null) return { rate: null as number | null, percent: null as number | null };
        const base = (basePerDay as number) * days;
        if (base <= 0) return { rate: null, percent: null };
        if (type === 'percentage') {
          const pct = Math.max(0, Math.min(100, value));
          const rate = Number((base * (1 - pct / 100)).toFixed(2));
          const percent = Math.round(pct);
          return { rate, percent };
        } else {
          const fixed = Math.max(0, value);
          const rate = Number((fixed).toFixed(2));
          const pct = base > 0 ? ((1 - (fixed / base)) * 100) : 0;
          const percent = Math.round(Math.max(0, Math.min(100, pct)));
          return { rate, percent };
        }
      };
      const weeklyCalc = formData.weekly_rate_enabled ? calcFrom(7, weeklyRateType as any, weeklyRateValue) : { rate: null, percent: null };
      const monthlyCalc = formData.monthly_rate_enabled ? calcFrom(30, monthlyRateType as any, monthlyRateValue) : { rate: null, percent: null };
      const yearlyCalc = formData.yearly_rate_enabled ? calcFrom(365, yearlyRateType as any, yearlyRateValue) : { rate: null, percent: null };

      // Get user's primary organization ID and validate organization setup
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('primary_organization_id')
        .eq('id', user.id)
        .single();

      // Check if user has an organization set up
      if (!userProfile?.primary_organization_id) {
        throw new Error('You must set up an organization in your profile before creating a listing. Without an organization, you will not be able to receive bookings or payments. Please go to your profile and add an organization name first.');
      }

      // For published listings, check if organization has Stripe Connect set up
      if (!saveAsDraft && !previewOnly) {
        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .select('stripe_account_id, charges_enabled')
          .eq('id', userProfile.primary_organization_id)
          .single();

        if (orgError) {
          log.error('Error checking organization Stripe setup', { error: orgError.message });
          throw new Error('Unable to verify organization payment setup. Please try again.');
        }

        if (!organization?.stripe_account_id) {
          throw new Error('Your organization must set up Stripe Connect to publish listings and receive payments. Please go to your organization settings to complete the Stripe Connect setup. You can still save drafts without Stripe Connect.');
        }

        if (!organization.charges_enabled) {
          throw new Error('Your organization\'s Stripe Connect account is not fully enabled. Please complete the Stripe Connect setup in your organization settings before publishing listings. You can still save drafts.');
        }
      }


      const propertyData: any = {
        ...formDataForInsert,
        space_attributes: formData.space_attributes || [],
        venue_id: user.id, // Set venue_id to match user.id
        organization_id: userProfile?.primary_organization_id || null,
        images: [],
        latitude: parseFloat(locationData[0].lat),
        longitude: parseFloat(locationData[0].lon),
        neighborhood: formData.neighborhood?.trim() || null,
        metro_area: formData.metro_area?.trim() || null,
        price_per_day: formData.inquire_for_pricing ? null : (formData.show_daily ? (parseFloat(formData.price_per_day) || null) : null),
        // New calculated fields persisted on create
        weekly_rate: formData.inquire_for_pricing ? null : weeklyCalc.rate,
        weekly_percent: formData.inquire_for_pricing ? null : weeklyCalc.percent,
        monthly_rate: formData.inquire_for_pricing ? null : monthlyCalc.rate,
        monthly_percent: formData.inquire_for_pricing ? null : monthlyCalc.percent,
        yearly_rate: formData.inquire_for_pricing ? null : yearlyCalc.rate,
        yearly_percent: formData.inquire_for_pricing ? null : yearlyCalc.percent,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published: !saveAsDraft && !previewOnly, // Only mark as published if not a draft and not preview
      };

      if (supportsHourly) {
        propertyData.price_per_hour = formData.inquire_for_pricing
          ? null
          : (formData.show_hourly ? (parseFloat(formData.price_per_hour) || null) : null);
      }

      let insertedData: any = null;
      let scheduleHandledByEdge = false;

      if (isImpersonating && sessionUser?.is_admin) {
        log.info('Creating property via admin edge function', { actingAs: user.id, adminUser: sessionUser.id });
        const { data: fnDataRaw, error: fnError } = await supabase.functions.invoke('admin-create-property', {
          body: {
            property: propertyData,
            target_user_id: user.id,
            schedule: schedulePayloadBase,
          },
        });
        const fnData = fnDataRaw as any;
        if (fnError || !fnData?.ok || !fnData?.property) {
          log.error('admin_function_create_failed', { error: fnError?.message, details: fnData });
          const errorMessage = fnData?.error || fnError?.message || 'Failed to create property via admin function';
          throw new Error(errorMessage);
        }
        insertedData = fnData.property;
        scheduleHandledByEdge = true;
        if (fnData.schedule_error) {
          log.warn('admin_function_schedule_warning', { propertyId: insertedData?.id, warning: fnData.schedule_error });
        }
      } else {
        log.info('Creating property record');
        const { data, error } = await supabase
          .from('properties')
          .insert(propertyData)
          .select()
          .single();

        if (error) throw error;
        insertedData = data;
        log.info('Property created', { propertyId: insertedData?.id });
      }
      
      // Property inserted; upload images via shared service and update record
      if (insertedData?.id && images.length > 0) {
        try {
          const urls = await uploadPropertyImages(
            supabase,
            insertedData.id,
            images,
            {
              organizationId: userProfile?.primary_organization_id || null,
              actingUserId: isImpersonating && sessionUser?.id ? sessionUser.id : undefined,
            }
          );
          const { error: updateImagesError } = await supabase
            .from('properties')
            .update({ images: urls, updated_at: new Date().toISOString() })
            .eq('id', insertedData.id);
          if (updateImagesError) throw updateImagesError;
        } catch (imageError) {
          // Do NOT delete the property; inform the user and navigate away to avoid duplicates
          log.error('Image upload failed; keeping property and redirecting user', { propertyId: insertedData.id, error: imageError });
          const message = encodeURIComponent(
            'Your listing was created, but images failed to upload. You can add images from your dashboard. If you continue to experience issues, please contact support at https://splitspace.com/help.'
          );
          // Navigate to the dashboard properties page with a notice and deep link
          navigate(`/dashboard/properties?notice=${message}&property=${insertedData.id}`);
          return; // Stop further processing to prevent duplicate submissions
        }
      }

      // If any schedule/availability options are set, upsert into property_schedule (unless handled by edge function)
      if (!scheduleHandledByEdge && insertedData?.id && schedulePayloadBase) {
        const schedulePayload = {
          property_id: insertedData.id,
          ...schedulePayloadBase,
        };
        await supabase.from('property_schedule').upsert([schedulePayload], { onConflict: 'property_id' });
      }

      if (previewOnly && insertedData?.id) {
        // Open the property details page with a preview flag in a new tab
        window.open(`/property/${insertedData.id}?preview=true`, '_blank', 'noopener');
      } else {
        // Navigate to the dashboard properties page on full success
        navigate('/dashboard/properties');
      }
    } catch (err) {
      log.error('Error creating property', { err });
      setError(err instanceof Error ? err.message : 'Failed to create property. Please try again.');
    } finally {
      setLoading(false);
      setDraftSaving(false);
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-maroon-800 mb-4 font-display">
            List Your Space
          </h1>
          <p className="text-lg text-maroon-600">
            Share your commercial space with businesses looking for the perfect location
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {userProfile && !userProfile.primary_organization_id && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Organization Required
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      You must set up an organization in your profile before creating a listing. Without an organization, you will not be able to receive bookings or payments.
                    </p>
                    <p className="mt-1">
                      <a href="/profile" className="font-medium text-yellow-800 underline hover:text-yellow-900">
                        Go to your profile to add an organization name
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {userProfile && userProfile.primary_organization_id && organizationStripeSetup && !organizationStripeSetup.hasStripe && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Stripe Connect Required for Publishing
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Your organization must set up Stripe Connect to publish listings and receive payments. You can save drafts without Stripe Connect, but publishing requires payment setup.
                    </p>
                    <p className="mt-1">
                      <a href="/dashboard/organizations" className="font-medium text-yellow-800 underline hover:text-yellow-900">
                        Go to organization settings to set up Stripe Connect
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {userProfile && userProfile.primary_organization_id && organizationStripeSetup && organizationStripeSetup.hasStripe && !organizationStripeSetup.chargesEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Complete Stripe Connect Setup
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Your organization's Stripe Connect account is not fully enabled. Please complete the setup to publish listings and receive payments. You can still save drafts.
                    </p>
                    <p className="mt-1">
                      <a href="/dashboard/organizations" className="font-medium text-yellow-800 underline hover:text-yellow-900">
                        Complete Stripe Connect setup
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Property Title"
              required
              icon={<Building2 className="h-5 w-5" />}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-maroon-700 mb-2">
                Description
              </label>
              <textarea
                required
                className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Street Address"
                required
                icon={<MapPin className="h-5 w-5" />}
                value={formData.address_street}
                onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
              />

              <Input
                label="City"
                required
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
              />

              <Input
                label="State"
                required
                value={formData.address_state}
                onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
              />

              <Input
                label="Postal Code"
                required
                value={formData.address_postal_code}
                onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
              />
            </div>

            {/* Neighborhood and Metro Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              />
              <Input
                label="Metro Area"
                value={formData.metro_area}
                onChange={(e) => setFormData({ ...formData, metro_area: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              {/* Pricing Section */}
              <div className="col-span-2">
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-maroon-800 mb-4">Pricing</h3>
                  
                  <div className="w-full">
                    <div className="mb-3 text-sm text-maroon-700 font-medium">Pricing Options:</div>
                    <div className={`flex flex-wrap items-center gap-4 ${formData.inquire_for_pricing ? 'opacity-50' : ''}`}>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.show_hourly} onChange={(e)=> setFormData({ ...formData, show_hourly: e.target.checked })} disabled={formData.inquire_for_pricing} />
                        <span>Hourly</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.show_daily} onChange={(e)=> setFormData({ ...formData, show_daily: e.target.checked })} disabled={formData.inquire_for_pricing} />
                        <span>Daily</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={(formData.weekly_rate_enabled || formData.monthly_rate_enabled || formData.yearly_rate_enabled)} onChange={(e)=>{
                          const on = e.target.checked;
                          setFormData({
                            ...formData,
                            weekly_rate_enabled: on,
                            monthly_rate_enabled: on,
                            yearly_rate_enabled: on,
                          })
                        }} disabled={formData.inquire_for_pricing} />
                        <span>Longer-term</span>
                      </label>
                      <label className="inline-flex items-center gap-2 ml-auto">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.inquire_for_pricing} onChange={(e)=> setFormData({ ...formData, inquire_for_pricing: e.target.checked })} />
                        <span>"Inquire for pricing"</span>
                        <div className="relative inline-block group">
                          <HelpCircle className="h-4 w-4 text-maroon-400" />
                          <div className="absolute bottom-full right-0 transform mb-2 w-80 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            Select at least one pricing option, depending on your preferences. The "inquire for pricing" option will disable the other options, and not display any pricing for your listing. If you select this option, interested parties will be able to inquire and discuss details prior to agreeing on costs.
                            <div className="absolute top-full right-2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Hourly */}
                    {formData.show_hourly && (
                      <div className="mt-4">
                        <Input
                          label="Base hourly rate"
                          type="number"
                          icon={<DollarSign className="h-5 w-5" />}
                          disabled={formData.inquire_for_pricing}
                          value={formData.price_per_hour}
                          onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Daily */}
                    {formData.show_daily && (
                      <div className="mt-4">
                        <Input
                          label="Base daily rate"
                          type="number"
                          icon={<DollarSign className="h-5 w-5" />}
                          disabled={formData.inquire_for_pricing}
                          value={formData.price_per_day}
                          onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                          className="w-full"
                        />
                      </div>
                    )}

                  </div>
                  
                  {/* Longer term pricing section */}
                  <div className="mt-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                        checked={formData.weekly_rate_enabled || formData.monthly_rate_enabled || formData.yearly_rate_enabled}
                        onChange={(e) => {
                          const enableLongerTermPricing = e.target.checked;
                          setFormData({ 
                            ...formData, 
                            weekly_rate_enabled: enableLongerTermPricing,
                            monthly_rate_enabled: enableLongerTermPricing,
                            yearly_rate_enabled: enableLongerTermPricing
                          });
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-maroon-700">
                        Enable longer-term pricing and discounts
                      </span>
                    </label>
                    
                    {(formData.weekly_rate_enabled || formData.monthly_rate_enabled || formData.yearly_rate_enabled) && (
                      <div className="mt-4 space-y-6 bg-gray-50 p-4 rounded-xl">
                        {/* Weekly Rate */}
                        <div>
                          <label className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                              checked={formData.weekly_rate_enabled}
                              onChange={(e) => setFormData({ ...formData, weekly_rate_enabled: e.target.checked })}
                              disabled={formData.inquire_for_pricing}
                            />
                            <span className="ml-2 text-sm font-medium text-maroon-700">
                              Weekly Rate (7+ days)
                            </span>
                          </label>
                          
                          {formData.weekly_rate_enabled && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  Rate Type
                                </label>
                                <select
                                  value={formData.weekly_rate_type}
                                  onChange={(e) => setFormData({ ...formData, weekly_rate_type: e.target.value as 'fixed' | 'percentage' })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  disabled={formData.inquire_for_pricing}
                                >
                                  <option value="percentage">Percentage Discount</option>
                                  <option value="fixed">Fixed Weekly Rate</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  {formData.weekly_rate_type === 'percentage' ? 'Discount (%)' : 'Weekly Rate ($)'}
                                </label>
                                <input
                                  type="number"
                                  value={formData.weekly_rate_value}
                                  onChange={(e) => setFormData({ ...formData, weekly_rate_value: e.target.value })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  placeholder={formData.weekly_rate_type === 'percentage' ? 'e.g., 10' : 'e.g., 500'}
                                  disabled={formData.inquire_for_pricing}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Monthly Rate */}
                        <div>
                          <label className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                              checked={formData.monthly_rate_enabled}
                              onChange={(e) => setFormData({ ...formData, monthly_rate_enabled: e.target.checked })}
                              disabled={formData.inquire_for_pricing}
                            />
                            <span className="ml-2 text-sm font-medium text-maroon-700">
                              Monthly Rate (30+ days)
                            </span>
                          </label>
                          
                          {formData.monthly_rate_enabled && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  Rate Type
                                </label>
                                <select
                                  value={formData.monthly_rate_type}
                                  onChange={(e) => setFormData({ ...formData, monthly_rate_type: e.target.value as 'fixed' | 'percentage' })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  disabled={formData.inquire_for_pricing}
                                >
                                  <option value="percentage">Percentage Discount</option>
                                  <option value="fixed">Fixed Monthly Rate</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  {formData.monthly_rate_type === 'percentage' ? 'Discount (%)' : 'Monthly Rate ($)'}
                                </label>
                                <input
                                  type="number"
                                  value={formData.monthly_rate_value}
                                  onChange={(e) => setFormData({ ...formData, monthly_rate_value: e.target.value })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  placeholder={formData.monthly_rate_type === 'percentage' ? 'e.g., 20' : 'e.g., 1500'}
                                  disabled={formData.inquire_for_pricing}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Yearly Rate */}
                        <div>
                          <label className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                              checked={formData.yearly_rate_enabled}
                              onChange={(e) => setFormData({ ...formData, yearly_rate_enabled: e.target.checked })}
                              disabled={formData.inquire_for_pricing}
                            />
                            <span className="ml-2 text-sm font-medium text-maroon-700">
                              Yearly Rate (365+ days)
                            </span>
                          </label>
                          
                          {formData.yearly_rate_enabled && (
                            <div className="grid grid-cols-2 gap-4 ml-6">
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  Rate Type
                                </label>
                                <select
                                  value={formData.yearly_rate_type}
                                  onChange={(e) => setFormData({ ...formData, yearly_rate_type: e.target.value as 'fixed' | 'percentage' })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  disabled={formData.inquire_for_pricing}
                                >
                                  <option value="percentage">Percentage Discount</option>
                                  <option value="fixed">Fixed Yearly Rate</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-maroon-700 mb-1">
                                  {formData.yearly_rate_type === 'percentage' ? 'Discount (%)' : 'Yearly Rate ($)'}
                                </label>
                                <input
                                  type="number"
                                  value={formData.yearly_rate_value}
                                  onChange={(e) => setFormData({ ...formData, yearly_rate_value: e.target.value })}
                                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                                  placeholder={formData.yearly_rate_type === 'percentage' ? 'e.g., 30' : 'e.g., 15000'}
                                  disabled={formData.inquire_for_pricing}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    </div>
                    </div>
                  </div>
                </div>

<Input
  label="Square Feet"
  type="number"
  required
  value={formData.square_feet}
  onChange={(e) => setFormData({ ...formData, square_feet: e.target.value })}
/>

<div>
  <label className="block text-sm font-medium text-maroon-700 mb-2 flex items-center">
    Capacity
    <Tooltip
      content="Specify the maximum occupancy of the space, either the maximum you will allow, or per the fire code, whichever is lower."
    >
      <button
        type="button"
        className="ml-2 text-maroon-400 hover:text-maroon-600"
        aria-label="Capacity help"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </Tooltip>
  </label>
  <Input
    type="number"
    min={0}
    value={formData.capacity}
    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
  />
</div>
          <div>
            <label className="block text-sm font-medium text-maroon-700 mb-2">
              Property Type
            </label>
            <select
              required
              className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              value={formData.property_type}
              onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="col-span-2">
          {/* Space Attributes */}
          <div>
            <label className="block text-sm font-medium text-maroon-700 mb-2">Space Attributes</label>
            <div className="grid grid-cols-2 gap-2">
              {SPACE_ATTRIBUTES.map((attr) => (
                <label key={attr.value} className="inline-flex items-center gap-2 p-2 rounded-lg border border-maroon-200 hover:bg-maroon-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.space_attributes || []).includes(attr.value)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        space_attributes: checked
                          ? Array.from(new Set([...(prev.space_attributes || []), attr.value]))
                          : (prev.space_attributes || []).filter((v) => v !== attr.value),
                      }));
                    }}
                  />
                  <span>{attr.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-maroon-700 mb-2">
              Amenities
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map((amenity) => (
                <label key={amenity.value} className="inline-flex items-center gap-2 p-2 rounded-lg border border-maroon-200 hover:bg-maroon-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.amenities.includes(amenity.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          amenities: [...formData.amenities, amenity.value],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          amenities: formData.amenities.filter((a) => a !== amenity.value),
                        });
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-maroon-600">{amenity.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-maroon-700 mb-2">
            Property Images
          </label>
          <ImageUploader
            onFilesSelected={handleImageChange}
            maxCount={10}
            className="mt-1"
          />
          {images.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-maroon-600 mb-2">
                <span className="font-medium">Tip:</span> The first image will be the main image shown in listings. Use the arrows to reorder images.
              </p>
              <div className="grid grid-cols-3 gap-4">
              {Array.from(images).map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Preview ${index + 1}`}
                    className="h-24 w-full object-cover rounded-lg border-2 border-transparent group-hover:border-maroon-300 transition-all"
                  />
                  <div className="absolute top-0 left-0 bg-maroon-600 text-white text-xs font-bold px-2 py-1 rounded-br-lg">
                    {index === 0 ? 'Main' : `#${index + 1}`}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white hover:bg-red-600 h-6 w-6 p-0 rounded-full"
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    aria-label="Remove image"
                  >
                    ×
                  </Button>
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="bg-white/90 text-maroon-600 hover:bg-white h-6 w-6 p-0 rounded-full"
                      onClick={() => {
                        if (index > 0) {
                          const newImages = [...images];
                          const temp = newImages[index];
                          newImages[index] = newImages[index - 1];
                          newImages[index - 1] = temp;
                          setImages(newImages);
                        }
                      }}
                      disabled={index === 0}
                      title="Move left"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="bg-white/90 text-maroon-600 hover:bg-white h-6 w-6 p-0 rounded-full"
                      onClick={() => {
                        if (index < images.length - 1) {
                          const newImages = [...images];
                          const temp = newImages[index];
                          newImages[index] = newImages[index + 1];
                          newImages[index + 1] = temp;
                          setImages(newImages);
                        }
                      }}
                      disabled={index === images.length - 1}
                      title="Move right"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* Availability Schedule */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-maroon-700">
            Availability Schedule
          </h3>
          <PropertySchedule
            schedule={schedule}
            onScheduleChange={(updatedSchedule) => setSchedule(updatedSchedule)}
            onSave={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
            loading={loading}
            error={error}
          />
        </div>

        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          {/* Save as Draft button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1 border-gray-300"
            onClick={(e) => handleSubmit(e, true, false)}
            isLoading={draftSaving}
            disabled={loading || draftSaving || previewLoading || !userProfile?.primary_organization_id}
            title={!userProfile?.primary_organization_id ? 'You must set up an organization in your profile first' : undefined}
          >
            <FileEdit className="h-5 w-5 mr-2" />
            Save Draft
          </Button>
          
          {/* Preview button */}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={(e) => handleSubmit(e, false, true)}
            isLoading={previewLoading}
            disabled={loading || draftSaving || previewLoading || !userProfile?.primary_organization_id || !organizationStripeSetup?.hasStripe || !organizationStripeSetup?.chargesEnabled}
            title={
              !userProfile?.primary_organization_id 
                ? 'You must set up an organization in your profile first'
                : !organizationStripeSetup?.hasStripe
                ? 'Your organization must set up Stripe Connect to preview listings'
                : !organizationStripeSetup?.chargesEnabled
                ? 'Your organization must complete Stripe Connect setup to preview listings'
                : undefined
            }
          >
            <EyeIcon className="h-5 w-5 mr-2" />
            Preview
          </Button>
          
          {/* Publish button */}
          <Button
            type="button"
            className="flex-1 bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
            size="lg"
            onClick={(e) => handleSubmit(e, false, false)}
            isLoading={loading}
            disabled={loading || draftSaving || previewLoading || !userProfile?.primary_organization_id || !organizationStripeSetup?.hasStripe || !organizationStripeSetup?.chargesEnabled}
            title={
              !userProfile?.primary_organization_id 
                ? 'You must set up an organization in your profile first'
                : !organizationStripeSetup?.hasStripe
                ? 'Your organization must set up Stripe Connect to publish listings'
                : !organizationStripeSetup?.chargesEnabled
                ? 'Your organization must complete Stripe Connect setup to publish listings'
                : undefined
            }
          >
            <List className="h-5 w-5 mr-2" />
            List Space
          </Button>
        </div>
      </form>
    </div>
  </div>
  );
};

export default ListPropertyPage;