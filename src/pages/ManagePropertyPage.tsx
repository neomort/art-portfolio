import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, MapPin, DollarSign, Image as ImageIcon, HelpCircle, ArrowLeft, ArrowRight, Trash2, Save, Calendar, Receipt, Star, Globe, EyeOff, Check, Eye, BadgePercent, Brush } from 'lucide-react';
import ImageUploader from '../components/ui/ImageUploader';
import { Button } from '../components/ui/button';
import { getTaxRateByZip } from '../utils/taxrate';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { PROPERTY_TYPES, AMENITIES, SPACE_ATTRIBUTES } from '../types';
import PropertySchedule from '../components/property/PropertySchedule';
import ReviewManagement from '../components/property/ReviewManagement';
import { validateImagesBatch } from '../lib/fileValidation';
import { formatCurrency, formatNumber } from '../lib/utils';
import { computeAdjustmentKey, computeLegacyAdjustmentKey, parseAppliedAdjustmentTokens, isAdjustmentApplied } from '../lib/adjustments';
import { compressImage } from '../lib/imageCompression';
import { getLogger } from '../lib/logger';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { Toast } from '../components/ui/toast';
import { Tooltip } from '../components/ui/Tooltip';
import { uploadPropertyImages, uploadPropertyFiles } from '../lib/upload/r2Uploader';

const ManagePropertyPage: React.FC = () => {
  usePageHeaderTitle('Manage Property');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, sessionUser, isImpersonating } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'schedule' | 'pricing' | 'reviews'>('details');
  const log = getLogger({ page: 'ManagePropertyPage' });
  const geoRef = useRef<{ lat: number; lng: number } | null>(null);
  const orgDefaultTzRef = useRef<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgAdjustments, setOrgAdjustments] = useState<Array<{ id: string; type: string; data: any; sort_order: number | null }>>([]);
  const [selectedAdjustments, setSelectedAdjustments] = useState<Record<string, boolean>>({});
  const [appliedAdjustmentTokens, setAppliedAdjustmentTokens] = useState<string[]>([]);
  const [supportsAppliedAdjustmentTokens, setSupportsAppliedAdjustmentTokens] = useState<boolean>(true);
  
  // Feature-detect support for property_schedule.ical_url (handles older DBs before migration runs)
  const [supportsIcalUrl, setSupportsIcalUrl] = useState<boolean>(true);
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

  // Feature-detect support for properties.applied_adjustment_tokens (handles older DBs before migration runs)
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.from('properties').select('applied_adjustment_tokens').limit(1);
        if (error && /applied_adjustment_tokens|PGRST204|column/i.test(error.message || '')) {
          setSupportsAppliedAdjustmentTokens(false);
        } else {
          setSupportsAppliedAdjustmentTokens(true);
        }
      } catch {
        setSupportsAppliedAdjustmentTokens(false);
      }
    })();
  }, []);

  const [schedule, setSchedule] = useState({
    showStartDate: false,
    showEndDate: false,
    limitAvailability: false,
    ical_url: '',
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
    }
  } as import("../components/property/PropertySchedule").Schedule);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  // Taxrate.io lookup state
  const [taxRateLoading, setTaxRateLoading] = useState(false);
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [taxRateFetched, setTaxRateFetched] = useState(false); // Prevent re-fetch if already fetched

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
    published: false,
    inquire_for_pricing: false,
    square_feet: '',
    capacity: '',
    property_type: 'retail',
    tax_rate: '0',
    fee_type: 'percentage',
    fee_value: '0',
    fee_description: '',
    amenities: [] as string[],
    space_attributes: [] as string[],
    // New pricing fields
    show_hourly: false,
    show_daily: true,
    enable_longer_term_pricing: false,
    weekly_rate_enabled: false,
    weekly_rate_type: 'percentage',
    weekly_rate_value: '',
    monthly_rate_enabled: false,
    monthly_rate_type: 'percentage',
    monthly_rate_value: '',
    yearly_rate_enabled: false,
    yearly_rate_type: 'percentage',
    yearly_rate_value: '',
    featured: false,
    // Images & Files additions
    virtual_tour_url: '',
    downloadable_files: [] as Array<{ url: string; label: string; type: string }>,
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
        setSupportsHourly(true);
      }
    })();
  }, []);
  
    // Hydrate taxRateFetched and tax_rate from localStorage on mount or property load
  useEffect(() => {
    const propertyId = id || '';
    const lookedUp = typeof window !== 'undefined' ? localStorage.getItem(`taxRateLookup_${propertyId}`) : null;
    const lookedUpRate = typeof window !== 'undefined' ? localStorage.getItem(`taxRateValue_${propertyId}`) : null;
    if (lookedUp && lookedUpRate && (!formData.tax_rate || formData.tax_rate === '0')) {
      setFormData(prev => ({ ...prev, tax_rate: lookedUpRate }));
      setTaxRateFetched(true);
    } else if (lookedUp && !taxRateFetched) {
      setTaxRateFetched(true);
    }
  }, [id]);

  // Persist tax rate lookup state in localStorage by property id
  useEffect(() => {
    const propertyId = id || '';
    const lookedUp = typeof window !== 'undefined' ? localStorage.getItem(`taxRateLookup_${propertyId}`) : null;
    if (
      !taxRateFetched &&
      !lookedUp &&
      (formData.tax_rate === '0' || formData.tax_rate === '') &&
      formData.address_postal_code
    ) {
      setTaxRateLoading(true);
      setTaxRateError(null);
      getTaxRateByZip(formData.address_postal_code)
        .then(rate => {
          if (rate !== null && !isNaN(rate)) {
            setFormData(prev =>
              (prev.tax_rate === '0' || prev.tax_rate === '')
                ? { ...prev, tax_rate: rate.toString() }
                : prev
            );
            setTaxRateFetched(true);
            localStorage.setItem(`taxRateLookup_${propertyId}`, '1');
          }
        })
        .catch(() => setTaxRateError('Failed to fetch tax rate'))
        .finally(() => setTaxRateLoading(false));
    } else if (lookedUp) {
      setTaxRateFetched(true);
    }
  }, [formData.address_postal_code, formData.tax_rate, taxRateFetched, id]);

  // Image management state
  // Define a type for our unified image structure
  type ImageItem = {
    url: string;      // URL for display - either permanent or temporary preview
    file?: File;      // Optional file reference for new uploads
    isNew?: boolean;  // Flag to identify new uploads vs existing images
  };

  // Virtual Tour: save handler and validation
  const isValidHttpUrl = (value: string | undefined | null): boolean => {
    if (!value) return false;
    const v = value.trim();
    if (v.length === 0) return false;
    // Basic check for http/https and no spaces
    return /^https?:\/\/[^\s]+$/i.test(v);
  };

  const saveVirtualTour = async () => {
    try {
      setSavingTour(true);
      setError(null);
      if (!id) throw new Error('Missing property id');
      const url = formData.virtual_tour_url?.trim() || null;
      const { error: upErr } = await supabase
        .from('properties')
        .update({ virtual_tour_url: url, updated_at: new Date().toISOString() })
        .eq('id', id as string);
      if (upErr) throw upErr;
      setToastMessage('Virtual tour saved');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      log.error('Error saving virtual tour', { err });
      setError(err instanceof Error ? err.message : 'Failed to save virtual tour');
      setToastMessage('Failed to save virtual tour');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSavingTour(false);
    }
  };

  // Downloadable files state type
  type DownloadableFileItem = {
    url: string;
    label: string;
    type: string;
    file?: File;      // present for new uploads not yet persisted
    isNew?: boolean;  // true for newly added files pending upload
  };

  // Downloadable Files: UI + persistence handlers
  const filePickerRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (selectedFiles: File[]) => {
    setError(null);
    try {
      const newItems: DownloadableFileItem[] = selectedFiles.map((file) => ({
        url: URL.createObjectURL(file),
        label: file.name.replace(/\.[^/.]+$/, ''),
        type: file.type || 'application/octet-stream',
        file,
        isNew: true,
      }));
      setDownloadableFiles(prev => [...prev, ...newItems]);
    } catch (e) {
      log.error('Error preparing files', { e });
      setError('Failed to process files.');
    }
  };

  const handleFileLabelChange = (index: number, label: string) => {
    setDownloadableFiles(prev => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  };

  const removeDownloadableFile = (index: number) => {
    setDownloadableFiles(prev => {
      const next = [...prev];
      const it = next[index];
      if (it?.isNew && it.url?.startsWith('blob:')) {
        try { URL.revokeObjectURL(it.url); } catch {}
      }
      next.splice(index, 1);
      return next;
    });
  };

  const saveFileChanges = async () => {
    try {
      setSavingFiles(true);
      setError(null);

      const newItems = downloadableFiles.filter(f => f.isNew && f.file);
      if (newItems.some(f => !f.label || !f.label.trim())) {
        setError('Please provide a label for each uploaded file.');
        return;
      }

      let uploadedUrls: string[] = [];
      if (newItems.length > 0) {
        const files = newItems.map(f => f.file!) as File[];
        uploadedUrls = await uploadPropertyFiles(supabase, id as string, files, { organizationId });
      }

      const finalFiles: Array<{ url: string; label: string; type: string }> = [];
      let uploadIdx = 0;
      for (const item of downloadableFiles) {
        if (item.isNew && item.file) {
          const url = uploadedUrls[uploadIdx++];
          finalFiles.push({ url, label: item.label, type: item.type });
        } else {
          finalFiles.push({ url: item.url, label: item.label, type: item.type });
        }
      }

      const { error: upErr } = await supabase
        .from('properties')
        .update({ downloadable_files: finalFiles })
        .eq('id', id as string);
      if (upErr) throw upErr;

      setDownloadableFiles(finalFiles.map(f => ({ ...f, isNew: false })));
      setToastMessage('Files updated successfully');
      setToastType('success');
      setShowToast(true);
      if (filePickerRef.current) filePickerRef.current.value = '';
    } catch (err) {
      log.error('Error updating files', { err });
      setError(err instanceof Error ? err.message : 'Failed to update files');
      setToastMessage('Failed to update files');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSavingFiles(false);
    }
  };

  

  // Load organization-level adjustments for the Discounts & Surcharges UI
  useEffect(() => {
    (async () => {
      try {
        if (!organizationId) {
          setOrgAdjustments([]);
          return;
        }
        const { data, error } = await supabase
          .from('organization_adjustments')
          .select('id, type, data, sort_order')
          .eq('organization_id', organizationId)
          .order('sort_order', { ascending: true, nullsFirst: true });
        if (error) throw error;
        const rows = (data as any[]) || [];
        setOrgAdjustments(rows);
      } catch (e) {
        log.warn('Failed to load organization adjustments', { e });
        setOrgAdjustments([]);
      }
    })();
  }, [organizationId]);

  const appliedAdjustmentTokenSet = useMemo(
    () => new Set(appliedAdjustmentTokens),
    [appliedAdjustmentTokens]
  );

  useEffect(() => {
    if (!orgAdjustments.length) return;
    // Initialize selections from applied tokens, but don't clobber user changes once state exists.
    if (Object.keys(selectedAdjustments).length > 0) return;

    const next: Record<string, boolean> = {};
    for (const row of orgAdjustments) {
      const key = computeAdjustmentKey(row);
      next[key] = isAdjustmentApplied(row, appliedAdjustmentTokenSet);
    }
    setSelectedAdjustments(next);
  }, [orgAdjustments, appliedAdjustmentTokenSet, selectedAdjustments]);
  
  const [images, setImages] = useState<ImageItem[]>([]);
  const [savingImages, setSavingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadableFiles, setDownloadableFiles] = useState<DownloadableFileItem[]>([]);
  const [savingFiles, setSavingFiles] = useState(false);
  const [savingTour, setSavingTour] = useState(false);
  const tourUrlValid = isValidHttpUrl(formData.virtual_tour_url);

  // Setup & Cleanup buffer configuration (stored locally for now)
  const [setupCleanup, setSetupCleanup] = useState({
    hourly: { setupMinutes: 0, cleanupMinutes: 0, includeInBilling: false },
    daily: { setupDays: 0, cleanupDays: 0, includeInBilling: false },
    weekly: { setupDays: 0, cleanupDays: 0, includeInBilling: false },
    monthly: { setupDays: 0, cleanupDays: 0, includeInBilling: false },
  });

  // Load/save setupCleanup to localStorage keyed by property id
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(`setupCleanup_${id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // shallow-merge to preserve shape
        setSetupCleanup((prev) => ({
          hourly: { ...prev.hourly, ...(parsed.hourly || {}) },
          daily: { ...prev.daily, ...(parsed.daily || {}) },
          weekly: { ...prev.weekly, ...(parsed.weekly || {}) },
          monthly: { ...prev.monthly, ...(parsed.monthly || {}) },
        }));
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!id) return;
    try {
      localStorage.setItem(`setupCleanup_${id}`,(JSON.stringify(setupCleanup)));
    } catch {}
  }, [id, setupCleanup]);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    if (id) {
      loadProperty();
    } else {
      setLoading(false);
    }
  }, [id, user, navigate]);

  const loadProperty = async () => {
    setError(null);
    try {
      // Check if Supabase is properly configured
      if (!supabase) {
        throw new Error('Supabase client not initialized. Please check your environment variables.');
      }

      const { data, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id as string)
        .single();

      if (propertyError) throw propertyError;

      // Verify access: venue owner OR org owner/admin for the property's organization; admins can impersonate
      let hasAccess = data.venue_id === user?.id;
      if (!hasAccess && data.organization_id) {
        const queryUserId = user?.id;
        if (queryUserId) {
          const { data: om } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', data.organization_id)
            .eq('user_id', queryUserId)
            .maybeSingle();
          if (om && (om.role === 'owner' || om.role === 'admin')) {
            hasAccess = true;
          }
        }
      }
      if (!hasAccess && sessionUser?.is_admin) {
        hasAccess = true;
      }
      if (!hasAccess) {
        navigate('/dashboard');
        return;
      }

      // Cache geo + org default timezone for later
      try {
        if (typeof (data as any)?.latitude === 'number' && typeof (data as any)?.longitude === 'number') {
          geoRef.current = { lat: (data as any).latitude, lng: (data as any).longitude };
        } else {
          geoRef.current = null;
        }
        if ((data as any)?.organization_id) {
          setOrganizationId((data as any).organization_id);
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('default_timezone')
            .eq('id', (data as any).organization_id)
            .maybeSingle();
          orgDefaultTzRef.current = (orgRow as any)?.default_timezone || null;
        } else {
          setOrganizationId(null);
          orgDefaultTzRef.current = null;
        }
      } catch {}

      setFormData({
        title: data.title,
        description: data.description,
        address_street: data.address_street,
        address_city: data.address_city,
        address_state: data.address_state,
        address_postal_code: data.address_postal_code,
        address_country: data.address_country,
        neighborhood: (data as any)?.neighborhood || '',
        metro_area: (data as any)?.metro_area || '',
        price_per_day: data.price_per_day?.toString() || '',
        price_per_hour: (data as any)?.price_per_hour?.toString?.() || '',
        inquire_for_pricing: data.inquire_for_pricing,
        square_feet: data.square_feet.toString(),
        capacity: (data as any)?.capacity?.toString?.() || '',
        property_type: data.property_type,
        tax_rate: data.tax_rate?.toString() || '0',
        fee_type: data.fee_type || 'percentage',
        fee_value: data.fee_value?.toString() || '0',
        fee_description: data.fee_description || '',
        amenities: data.amenities || [],
        space_attributes: (data as any)?.space_attributes || [],
        // Longer-term visibility should reflect any persisted values (type/value OR computed rate/percent)
        enable_longer_term_pricing: !!(
          data.weekly_rate_type || data.monthly_rate_type || data.yearly_rate_type ||
          data.weekly_rate != null || data.monthly_rate != null || data.yearly_rate != null ||
          data.weekly_percent != null || data.monthly_percent != null || data.yearly_percent != null
        ),
        show_hourly: !!(data as any)?.price_per_hour,
        show_daily: !!data.price_per_day,
        // Weekly: enable if explicit type exists OR fallback to presence of computed values
        weekly_rate_enabled: !!(data.weekly_rate_type || data.weekly_rate != null || data.weekly_percent != null),
        weekly_rate_type: ((): 'fixed' | 'percentage' => {
          if (data.weekly_rate_type) return data.weekly_rate_type as any;
          if (data.weekly_percent != null) return 'percentage';
          if (data.weekly_rate != null) return 'fixed';
          return 'percentage';
        })(),
        weekly_rate_value: ((): string => {
          if (data.weekly_rate_value != null) return String(data.weekly_rate_value);
          if (data.weekly_percent != null) return String(data.weekly_percent);
          if (data.weekly_rate != null) return String(data.weekly_rate);
          return '';
        })(),
        // Monthly: enable if explicit type exists OR fallback
        monthly_rate_enabled: !!(data.monthly_rate_type || data.monthly_rate != null || data.monthly_percent != null),
        monthly_rate_type: ((): 'fixed' | 'percentage' => {
          if (data.monthly_rate_type) return data.monthly_rate_type as any;
          if (data.monthly_percent != null) return 'percentage';
          if (data.monthly_rate != null) return 'fixed';
          return 'percentage';
        })(),
        monthly_rate_value: ((): string => {
          if (data.monthly_rate_value != null) return String(data.monthly_rate_value);
          if (data.monthly_percent != null) return String(data.monthly_percent);
          if (data.monthly_rate != null) return String(data.monthly_rate);
          return '';
        })(),
        // Yearly: enable if explicit type exists OR fallback
        yearly_rate_enabled: !!(data.yearly_rate_type || data.yearly_rate != null || data.yearly_percent != null),
        yearly_rate_type: ((): 'fixed' | 'percentage' => {
          if (data.yearly_rate_type) return data.yearly_rate_type as any;
          if (data.yearly_percent != null) return 'percentage';
          if (data.yearly_rate != null) return 'fixed';
          return 'percentage';
        })(),
        yearly_rate_value: ((): string => {
          if (data.yearly_rate_value != null) return String(data.yearly_rate_value);
          if (data.yearly_percent != null) return String(data.yearly_percent);
          if (data.yearly_rate != null) return String(data.yearly_rate);
          return '';
        })(),
        featured: data.featured || false,
        published: data.published || false, // Add the published field
        virtual_tour_url: (data as any)?.virtual_tour_url || '',
        downloadable_files: ((data as any)?.downloadable_files || []) as Array<{ url: string; label: string; type: string }>,
      });
      // Load previously applied org adjustments if present
      try {
        const storedTokens = parseAppliedAdjustmentTokens(
          (supportsAppliedAdjustmentTokens ? (data as any)?.applied_adjustment_tokens : undefined)
        );
        const storedIds = parseAppliedAdjustmentTokens((data as any)?.applied_adjustment_ids);
        setAppliedAdjustmentTokens(Array.from(new Set([...storedTokens, ...storedIds])));
      } catch {}
      
      // Set images - convert string URLs to ImageItem objects
      setImages((data.images || []).map((url: string) => ({
        url,
        isNew: false // Existing images are not new uploads
      })));

      // Set downloadable files if present
      try {
        const filesArr = (((data as any)?.downloadable_files) || []) as Array<{ url: string; label: string; type: string }>;
        if (Array.isArray(filesArr)) {
          setDownloadableFiles(filesArr.map(f => ({ ...f, isNew: false })));
        } else {
          setDownloadableFiles([]);
        }
      } catch { setDownloadableFiles([]); }

      // Load availability schedule
      const { data: scheduleData } = await supabase
        .from('property_schedule')
        .select('*')
        .eq('property_id', id as string)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (scheduleData && scheduleData[0]) {
        setSchedule({
          showStartDate: !!scheduleData[0].available_from,
          showEndDate: !!scheduleData[0].available_until,
          limitAvailability: scheduleData[0].limit_availability !== false,
          ical_url: scheduleData[0].ical_url || '',
          available_from: scheduleData[0].available_from || '',
          available_until: scheduleData[0].available_until || '',
          availability: (scheduleData[0].daily_schedule as any) || {
            monday: { enabled: true, start: '09:00', end: '17:00' },
            tuesday: { enabled: true, start: '09:00', end: '17:00' },
            wednesday: { enabled: true, start: '09:00', end: '17:00' },
            thursday: { enabled: true, start: '09:00', end: '17:00' },
            friday: { enabled: true, start: '09:00', end: '17:00' },
            saturday: { enabled: false, start: '09:00', end: '17:00' },
            sunday: { enabled: false, start: '09:00', end: '17:00' },
          },
        });
      }
    } catch (err) {
      log.error('Error loading property', { err });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load property';
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to the database. Please check your internet connection and try again. If the problem persists, verify your Supabase configuration.';
        } else if (err.message.includes('JWT')) {
          errorMessage = 'Authentication error. Please sign out and sign back in.';
        } else if (err.message.includes('not found')) {
          errorMessage = 'Property not found or you do not have permission to access it.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePublishedStatus = async (publish: boolean) => {
    if (!id || !user) return;
    
    setPublishLoading(true);
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ 
          published: publish,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      setFormData({ ...formData, published: publish });
      setShowToast(true);
      setToastMessage(publish ? 'Property is now live' : 'Property is now hidden');
      setToastType('success');
    } catch (err) {
      log.error('Error updating property status', { err });
      setShowToast(true);
      setToastMessage('Failed to update property status');
      setToastType('error');
    } finally {
      setPublishLoading(false);
      setShowPublishDialog(false);
      setShowUnpublishDialog(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate that at least one pricing option is selected (unless "inquire for pricing" is enabled)
      if (!formData.inquire_for_pricing && !formData.show_hourly && !formData.show_daily && !formData.enable_longer_term_pricing) {
        setError('Please select at least one pricing option or enable "Inquire for pricing"');
        setSaving(false);
        return;
      }

      // Validate square feet is a valid number
      const squareFeet = parseInt(formData.square_feet);
      if (isNaN(squareFeet) || squareFeet <= 0) {
        setError('Please enter a valid number for square feet');
        setSaving(false);
        return;
      }
      
      // Prepare longer-term pricing data (legacy fields retained for compatibility)
      const weeklyRateType = formData.weekly_rate_enabled ? formData.weekly_rate_type : null;
      const weeklyRateValue = formData.weekly_rate_enabled ? parseFloat(formData.weekly_rate_value as string) || null : null;
      const monthlyRateType = formData.monthly_rate_enabled ? formData.monthly_rate_type : null;
      const monthlyRateValue = formData.monthly_rate_enabled ? parseFloat(formData.monthly_rate_value as string) || null : null;
      const yearlyRateType = formData.yearly_rate_enabled ? formData.yearly_rate_type : null;
      const yearlyRateValue = formData.yearly_rate_enabled ? parseFloat(formData.yearly_rate_value as string) || null : null;

      // Helper to safely parse numeric strings; returns null if NaN
      const toNumberOrNull = (v: any) => {
        const n = typeof v === 'string' ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : null;
      };

      // New: compute calculated pricing fields (rate + percent) from base daily rate
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
          // fixed
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

      

      // Update property in database
      // Compute property timezone before update
      let computedTz: string | null = null;
      try {
        if (geoRef.current) {
          computedTz = tzlookup(geoRef.current.lat, geoRef.current.lng) || null;
        }
        if (!computedTz && orgDefaultTzRef.current) {
          computedTz = orgDefaultTzRef.current;
        }
      } catch {}

      const selectedKeys = Array.from(new Set(
        orgAdjustments
          .filter((row) => selectedAdjustments[computeAdjustmentKey(row)] === true)
          .flatMap((row) => {
            const stable = computeAdjustmentKey(row);
            const legacy = computeLegacyAdjustmentKey(row);
            return stable === legacy ? [stable] : [stable, legacy];
          })
      ));

      const selectedIds = orgAdjustments
        .filter((row) => selectedAdjustments[computeAdjustmentKey(row)] === true)
        .map((row) => row.id);

      const updatePayload: any = {
        title: formData.title,
        description: formData.description,
        address_street: formData.address_street,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_postal_code: formData.address_postal_code,
        address_country: formData.address_country,
        neighborhood: formData.neighborhood?.trim() || null,
        metro_area: formData.metro_area?.trim() || null,
        price_per_day: formData.inquire_for_pricing ? null : (formData.show_daily ? toNumberOrNull(formData.price_per_day) : null),
        inquire_for_pricing: formData.inquire_for_pricing,
        square_feet: squareFeet,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        fee_type: formData.fee_type,
        fee_value: parseFloat(formData.fee_value) || 0,
        fee_description: formData.fee_description,
        property_type: formData.property_type,
        amenities: formData.amenities,
        space_attributes: formData.space_attributes || [],
        weekly_rate_type: weeklyRateType,
        weekly_rate_value: weeklyRateValue,
        monthly_rate_type: monthlyRateType,
        monthly_rate_value: monthlyRateValue,
        yearly_rate_type: yearlyRateType,
        yearly_rate_value: yearlyRateValue,
        weekly_rate: formData.inquire_for_pricing ? null : weeklyCalc.rate,
        weekly_percent: formData.inquire_for_pricing ? null : weeklyCalc.percent,
        monthly_rate: formData.inquire_for_pricing ? null : monthlyCalc.rate,
        monthly_percent: formData.inquire_for_pricing ? null : monthlyCalc.percent,
        yearly_rate: formData.inquire_for_pricing ? null : yearlyCalc.rate,
        yearly_percent: formData.inquire_for_pricing ? null : yearlyCalc.percent,
        updated_at: new Date().toISOString(),
        ...(computedTz ? { iana_timezone: computedTz } : {}),
        // Persist selected org adjustments
        applied_adjustment_ids: selectedIds,
        ...(supportsAppliedAdjustmentTokens ? { applied_adjustment_tokens: selectedKeys } : {}),
        virtual_tour_url: formData.virtual_tour_url?.trim() || null,
        downloadable_files: downloadableFiles.map(f => ({ url: f.url, label: f.label, type: f.type })),
      };

      if (supportsHourly) {
        updatePayload.price_per_hour = formData.inquire_for_pricing
          ? null
          : (formData.show_hourly ? toNumberOrNull(formData.price_per_hour) : null);
      }

      const schedulePayload = (supportsIcalUrl || schedule.limitAvailability || schedule.showStartDate || schedule.showEndDate)
        ? {
            limit_availability: schedule.limitAvailability,
            available_from: schedule.showStartDate ? schedule.available_from || null : null,
            available_until: schedule.showEndDate ? schedule.available_until || null : null,
            daily_schedule: schedule.limitAvailability ? schedule.availability : null,
          }
        : null;

      const actingUserId = user?.id;

      if (isImpersonating && sessionUser?.is_admin && actingUserId) {
        const { data: fnDataRaw, error: fnError } = await supabase.functions.invoke('admin-update-property', {
          body: {
            property_id: id,
            updates: updatePayload,
            schedule: schedulePayload,
          },
        });
        const fnData = fnDataRaw as any;
        if (fnError || !fnData?.ok) {
          log.error('admin_update_failed', { propertyId: id, error: fnError?.message, details: fnData });
          const errorMessage = fnData?.error || fnError?.message || 'Failed to update property via admin function';
          throw new Error(errorMessage);
        }
      } else {
        const { error: updateError } = await supabase
          .from('properties')
          .update(updatePayload)
          .eq('id', id as string);

        if (updateError) throw updateError;

        if (schedulePayload) {
          await supabase
            .from('property_schedule')
            .upsert([{
              property_id: id as string,
              ...schedulePayload,
            }], { onConflict: 'property_id' });
        }
      }

      // Refetch property to confirm persisted values (including neighborhood/metro_area)
      try {
        const { data: refreshed } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id as string)
          .single();
        if (refreshed) {
          setFormData(prev => ({
            ...prev,
            neighborhood: (refreshed as any)?.neighborhood || '',
            metro_area: (refreshed as any)?.metro_area || prev.metro_area,
          }));
        }
      } catch {}

      // Show success message
      setToastMessage('Property updated successfully');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      log.error('Error updating property', { err });
      setError(err instanceof Error ? err.message : 'Failed to update property');
      setToastMessage('Failed to update property');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      setSaving(true);
      setError(null);

      // Ensure the user is authenticated before writing (RLS will 403 otherwise)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setToastMessage('Please sign in to save the schedule');
        setToastType('error');
        setShowToast(true);
        // Optional: redirect
        // navigate('/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('property_schedule')
        .upsert({
          property_id: id as string,
          available_from: schedule.showStartDate ? schedule.available_from : null,
          available_until: schedule.showEndDate ? schedule.available_until : null,
          daily_schedule: schedule.availability,
          limit_availability: schedule.limitAvailability,
          ...(supportsIcalUrl ? { ical_url: schedule.ical_url || null } : {}),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'property_id' });

      if (error) {
        // Surface more detail for 4xx diagnostics
        log.error('Supabase upsert error (property_schedule)', { error });
        throw error;
      }

      setToastMessage('Schedule updated successfully');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      log.error('Error updating schedule', { err });
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
      setToastMessage('Failed to update schedule');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSaving(false);
    }
  };

  // Constants for image validation
  const MIN_IMAGES = 1;
  const MAX_IMAGES = 40;
  
  // Compression handled via shared util compressImage(file)
  
  // Image management functions
  const handleImageChange = useCallback(async (selectedFiles: File[]) => {
    // Clear previous errors
    setError(null);
    
    // Check if adding these images would exceed the maximum
    if (images.length + selectedFiles.length > MAX_IMAGES) {
      setError(`You can have a maximum of ${MAX_IMAGES} images. You're trying to add ${selectedFiles.length} to your existing ${images.length}.`);
      return;
    }
    
    try {
      // Batch preflight validation (count, total size, type/magic, dimensions)
      const batch = await validateImagesBatch(selectedFiles);
      if (!batch.ok) {
        setError(`Image validation failed:\n- ${batch.reasons.join('\n- ')}`);
        return;
      }
      // Process files with compression in parallel
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          // Create a preview URL immediately for responsive UI
          const previewUrl = URL.createObjectURL(file);
          
          // Compress the image in the background
          const compressedFile = await compressImage(file);
          
          // Return the image item with both preview and file
          return {
            url: previewUrl,
            file: compressedFile,
            isNew: true
          };
        })
      );
      
      // Add new images to the main images array for immediate display
      setImages(prevImages => [...prevImages, ...processedFiles]);
    } catch (err) {
      log.error('Error processing images', { err });
      setError('Failed to process images. Please try again.');
    }
  
  }, [images.length]);

  // Move image left in order
  const moveImageLeft = (index: number) => {
    // Clear previous errors
    setError(null);

    if (index === 0) return; // Already leftmost/first
    setImages(prevImages => {
      const newImages = [...prevImages];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  // Move image right in order
  const moveImageRight = (index: number) => {
    // Clear previous errors
    setError(null);

    if (index === images.length - 1) return; // Already rightmost/last
    setImages(prevImages => {
      const newImages = [...prevImages];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  // Remove image from the list
  const removeImage = (index: number) => {
    // Clear previous errors
    setError(null);

    // Check if removing this image would violate minimum requirement
    if (images.length <= MIN_IMAGES) {
      setError(`You must have at least ${MIN_IMAGES} image for your property.`);
      return;
    }

    setImages(prevImages => {
      const imagesToKeep = [...prevImages];
      // If the image has a preview URL, revoke it to prevent memory leaks
      if (imagesToKeep[index].isNew && imagesToKeep[index].url.startsWith('blob:')) {
        URL.revokeObjectURL(imagesToKeep[index].url);
      }
      imagesToKeep.splice(index, 1);
      return imagesToKeep;
    });
  };

  // Save image changes
  const saveImageChanges = async () => {
    try {
      // Clear previous errors
      setError(null);
      
      // Validate image count before proceeding
      if (images.length < MIN_IMAGES) {
        setError(`You must have at least ${MIN_IMAGES} image for your property.`);
        return;
      }
      
      if (images.length > MAX_IMAGES) {
        setError(`You can have a maximum of ${MAX_IMAGES} images for your property.`);
        return;
      }
      
      setSavingImages(true);

      // Extract all the new images that need to be uploaded (have file property)
      const newImageItems = images.filter(img => img.isNew && img.file);

      if (newImageItems.length > 0) {
        // Create an array to hold the URLs of newly uploaded images
        const uploadedUrls: string[] = [];

        // Upload via shared R2 uploader (validates, compresses, presigns, PUTs)
        const newFiles = newImageItems.map((it) => it.file!) as File[];
        const uploadedViaR2 = await uploadPropertyImages(supabase, id as string, newFiles, {
          organizationId,
          actingUserId: isImpersonating && sessionUser?.id ? sessionUser.id : undefined,
        });
        uploadedUrls.push(...uploadedViaR2);

        // Prepare final image URLs array: keep existing (non-new) image URLs and add newly uploaded URLs
        const finalImageUrls = [
          ...images.filter(img => !img.isNew).map(img => img.url),
          ...uploadedUrls
        ];

        if (isImpersonating && sessionUser?.is_admin) {
          const { data: adminResp, error: adminError } = await (supabase as any).functions.invoke('admin-update-property', {
            body: {
              property_id: id,
              updates: {
                images: finalImageUrls,
              },
            },
          });

          if (adminError || !adminResp?.ok) {
            throw new Error(adminResp?.error || adminError?.message || 'Admin property update failed');
          }
        } else {
          // Update property with new image URLs using standard path
          const { error: updateError } = await supabase
            .from('properties')
            .update({ images: finalImageUrls })
            .eq('id', id as string);

          if (updateError) {
            throw new Error(`Error updating property images: ${updateError.message}`);
          }
        }

        // Clean up any object URLs to prevent memory leaks
        images.forEach(img => {
          if (img.isNew && img.url && img.url.startsWith('blob:')) {
            URL.revokeObjectURL(img.url);
          }
        });

        // Update local state with the final list of images (only URLs, no files)
        setImages(finalImageUrls.map(url => ({
          url,
          isNew: false // All images are now saved
        })));

        setToastMessage('Images updated successfully');
        setToastType('success');
        setShowToast(true);
      } else {
        // If there are no new images, just reorder existing ones
        const existingImageUrls = images.map(img => img.url);

        if (isImpersonating && sessionUser?.is_admin) {
          const { data: adminResp, error: adminError } = await (supabase as any).functions.invoke('admin-update-property', {
            body: {
              property_id: id,
              updates: {
                images: existingImageUrls,
              },
            },
          });

          if (adminError || !adminResp?.ok) {
            throw new Error(adminResp?.error || adminError?.message || 'Admin property update failed');
          }
        } else {
          // Update property with reordered URLs
          const { error: updateError } = await supabase
            .from('properties')
            .update({ images: existingImageUrls })
            .eq('id', id as string);

          if (updateError) {
            throw new Error(`Error updating property images: ${updateError.message}`);
          }
        }

        // Normalize local state to reflect persisted order
        setImages(existingImageUrls.map(url => ({ url, isNew: false })));

        setToastMessage('Image order updated successfully!');
        setToastType('success');
        setShowToast(true);
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      log.error('Error updating images', { err });
      setError(err instanceof Error ? err.message : 'Failed to update images');
      setToastMessage('Failed to update images');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSavingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header section with responsive layout */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-maroon-800 font-display">
                {id ? 'Edit Property' : 'Add Property'}
              </h1>
              {/* Draft indicator */}
              {id && formData.published === false && (
                <span className="inline-flex items-center px-3 py-1 rounded-bl-2xl text-sm font-extrabold bg-yellow-400 text-white border-2 border-yellow-500 shadow-lg animate-pulse">
                  Draft
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-2">
            {/* Fix button width with inline-flex wrapper divs */}
            {/* Preview/View button - conditional on publish state */}
            {id && (
              <div className="inline-flex">
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-1"
                  onClick={() => window.open(
                    formData.published 
                      ? `/property/${id}` 
                      : `/property/${id}?preview=true`, 
                    '_blank'
                  )}
                >
                  <Eye className="h-4 w-4" />
                  <span>{formData.published ? 'View' : 'Preview'}</span>
                </Button>
              </div>
            )}
            
            {/* Publish/Unpublish Controls */}
            {id && (
              formData.published === true ? (
                <div className="inline-flex">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-1 border-red-300 hover:bg-red-50 text-red-600"
                    onClick={() => setShowUnpublishDialog(true)}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>Hide Property</span>
                  </Button>
                </div>
              ) : (
                <div className="inline-flex">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-1 border-green-300 hover:bg-green-50 text-green-600"
                    onClick={() => setShowPublishDialog(true)}
                  >
                    <Globe className="h-4 w-4" />
                    <span>List Property</span>
                  </Button>
                </div>
              )
            )}
            
            <div className="inline-flex">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`py-2 px-4 md:px-6 font-medium text-xs md:text-sm focus:outline-none ${
                activeTab === 'details'
                  ? 'border-b-2 border-maroon-600 text-maroon-800'
                  : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('details')}
            >
              <div className="flex flex-col items-center md:flex-row">
                <Building2 className="h-4 w-4 mb-1 md:mb-0 md:mr-2" />
                <span>Details</span>
              </div>
            </button>
            <button
              className={`py-2 px-4 md:px-6 font-medium text-xs md:text-sm focus:outline-none ${
                activeTab === 'images'
                  ? 'border-b-2 border-maroon-600 text-maroon-800'
                  : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('images')}
            >
              <div className="flex flex-col items-center md:flex-row">
                <ImageIcon className="h-4 w-4 mb-1 md:mb-0 md:mr-2" />
                <span>Images</span>
              </div>
            </button>
            <button
              className={`py-2 px-4 md:px-6 font-medium text-xs md:text-sm focus:outline-none ${
                activeTab === 'pricing'
                  ? 'border-b-2 border-maroon-600 text-maroon-800'
                  : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('pricing')}
            >
              <div className="flex flex-col items-center md:flex-row">
                <DollarSign className="h-4 w-4 mb-1 md:mb-0 md:mr-2" />
                <span>Pricing</span>
              </div>
            </button>
            <button
              className={`py-2 px-4 md:px-6 font-medium text-xs md:text-sm focus:outline-none ${
                activeTab === 'schedule'
                  ? 'border-b-2 border-maroon-600 text-maroon-800'
                  : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('schedule')}
            >
              <div className="flex flex-col items-center md:flex-row">
                <Calendar className="h-4 w-4 mb-1 md:mb-0 md:mr-2" />
                <span>Scheduling</span>
              </div>
            </button>
            <button
              className={`py-2 px-4 md:px-6 font-medium text-xs md:text-sm focus:outline-none ${
                activeTab === 'reviews'
                  ? 'border-b-2 border-maroon-600 text-maroon-800'
                  : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('reviews')}
            >
              <div className="flex flex-col items-center md:flex-row">
                <Star className="h-4 w-4 mb-1 md:mb-0 md:mr-2" />
                <span>Reviews</span>
              </div>
            </button>
          </div>
        </div>
        <form onSubmit={handleFormSubmit}>
          {/* Property Details Tab */}
          {activeTab === 'details' && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center text-maroon-800">
                    <Building2 className="h-5 w-5 mr-2" />
                    Property Details
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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

                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-2">Space Attributes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPACE_ATTRIBUTES.map((attr) => (
                      <label key={attr.value} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                          checked={(formData.space_attributes || []).includes(attr.value)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setFormData((prev) => ({
                              ...prev,
                              space_attributes: checked
                                ? Array.from(new Set([...(prev.space_attributes || []), attr.value]))
                                : (prev.space_attributes || []).filter((v) => v !== attr.value),
                            }))
                          }}
                        />
                        <span className="ml-2 text-sm text-maroon-600">{attr.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-maroon-700 mb-2">Amenities</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AMENITIES.map((amenity) => (
                      <label key={amenity.value} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                          checked={formData.amenities.includes(amenity.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                amenities: [...formData.amenities, amenity.value],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                amenities: formData.amenities.filter((a) => a !== amenity.value),
                              })
                            }
                          }}
                        />
                        <span className="ml-2 text-sm text-maroon-600">{amenity.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
                    isLoading={saving}
                    disabled={saving}
                  >
                    Save Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Images & Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Current Images (only render when images exist) */}
                {images.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-maroon-700">Manage Existing Images</h3>
                    <div>
                      <p className="text-sm text-gray-500 mb-4">Drag to reorder or use the arrow buttons. The first image will be the main property image.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="relative border-2 border-maroon-200 rounded-xl overflow-hidden group h-40">
                            {index === 0 && (
                              <div className="absolute top-2 left-2 bg-maroon-700 bg-opacity-95 text-white px-3 py-1.5 text-sm font-bold rounded-md shadow-lg z-10 flex items-center backdrop-blur-sm border border-maroon-500">
                                <Star className="h-3.5 w-3.5 mr-1.5 text-yellow-300" fill="currentColor" />
                                <span>Main Image</span>
                              </div>
                            )}
                            {image.isNew && (
                              <div className="absolute top-2 right-12 bg-blue-500 text-white px-2 py-1 text-xs rounded-lg z-10">
                                New
                              </div>
                            )}
                            <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              <img 
                                src={image.url} 
                                alt={`Property image ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = '/placeholder-property.jpg';
                                }}
                              />
                            </div>
                            {/* Trash button in top right */}
                            <button
                              type="button"
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              onClick={() => removeImage(index)}
                              title="Remove image"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            
                            {/* Left arrow button */}
                            {index > 0 && (
                              <button
                                type="button"
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/90 text-maroon-700 p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                onClick={() => moveImageLeft(index)}
                                title="Move left"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </button>
                            )}
                            
                            {/* Right arrow button */}
                            {index < images.length - 1 && (
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/90 text-maroon-700 p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                onClick={() => moveImageRight(index)}
                                title="Move right"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add New Images */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-maroon-700">Add New Images</h3>
                  
                  <ImageUploader
                    onFilesSelected={handleImageChange}
                    maxCount={MAX_IMAGES}
                    className="mt-4"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={saveImageChanges}
                    className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
                    isLoading={savingImages}
                    disabled={savingImages || images.length === 0}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Image Changes
                  </Button>
                </div>

                {/* Virtual Tour URL */}
                <div className="space-y-2">
                  <div className="text-lg font-medium text-maroon-700">Virtual Tour</div>
                  <Input
                    label="Virtual Tour URL"
                    type="url"
                    value={formData.virtual_tour_url}
                    onChange={(e: any) => setFormData({ ...formData, virtual_tour_url: e.target.value })}
                    placeholder="https://..."
                  />
                  {!tourUrlValid && (formData.virtual_tour_url?.trim()?.length ?? 0) > 0 && (
                    <div className="text-xs text-red-600">Enter a valid http(s) URL.</div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={saveVirtualTour}
                      className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
                      isLoading={savingTour}
                      disabled={!tourUrlValid || savingTour}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Virtual Tour
                    </Button>
                  </div>
                </div>

                {/* Downloadable Files */}
                <div className="space-y-3">
                  <div className="text-lg font-medium text-maroon-700">Downloadable Files</div>
                  <div
                    className="border-2 border-dashed border-maroon-200 rounded-xl p-4 bg-white"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files || []).filter(f => /pdf|text|msword|officedocument/.test(f.type) || /\.(pdf|txt|md|doc|docx|rtf)$/i.test(f.name)); if (files.length) handleFileUpload(files as File[]); }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-600">Drag & drop PDF or text files here, or click to select.</p>
                      <div>
                        <input ref={filePickerRef} type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" multiple className="hidden" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length) handleFileUpload(files as File[]); }} />
                        <Button type="button" variant="outline" onClick={() => filePickerRef.current?.click()}>Choose Files</Button>
                      </div>
                    </div>
                    {/* Files list with labels */}
                    <div className="mt-4 space-y-3">
                      {downloadableFiles.length === 0 && (
                        <div className="text-sm text-gray-500">No files added yet.</div>
                      )}
                      {downloadableFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              label="Label (required)"
                              value={f.label}
                              onChange={(e: any) => handleFileLabelChange(idx, e.target.value)}
                              placeholder="e.g., Floor Plan PDF"
                            />
                          </div>
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-maroon-700 underline">Preview</a>
                          <Button type="button" variant="outline" onClick={() => removeDownloadableFile(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button type="button" onClick={saveFileChanges} className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white" isLoading={savingFiles} disabled={savingFiles}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Files
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pricing Options */}
                <div>
                  <div className="mb-3 text-sm text-maroon-700 font-medium">Pricing Options:</div>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Left group (affected by greying when inquire_for_pricing is on) */}
                    <div className={`${formData.inquire_for_pricing ? 'opacity-50' : ''} flex flex-wrap items-center gap-4`}>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.show_hourly} onChange={(e)=> setFormData({ ...formData, show_hourly: e.target.checked })} disabled={formData.inquire_for_pricing} />
                        <span>Hourly</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.show_daily} onChange={(e)=> setFormData({ ...formData, show_daily: e.target.checked })} disabled={formData.inquire_for_pricing} />
                        <span>Daily</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500" checked={formData.enable_longer_term_pricing} onChange={(e)=> setFormData({ ...formData, enable_longer_term_pricing: e.target.checked })} disabled={formData.inquire_for_pricing} />
                        <span>Longer-term</span>
                      </label>
                    </div>
                    {/* Right item (always full opacity) */}
                    <label className="inline-flex items-center gap-2">
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
                </div>

                

                {/* Hourly */}
                {formData.show_hourly && (
                  <div>
                    <Input
                      label="Base hourly rate"
                      type="number"
                      icon={<DollarSign className="h-5 w-5" />}
                      disabled={formData.inquire_for_pricing}
                      value={formData.price_per_hour}
                      onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                    />
                  </div>
                )}

                {/* Daily */}
                {formData.show_daily && (
                  <div>
                    <Input
                      label="Base daily rate"
                      type="number"
                      icon={<DollarSign className="h-5 w-5" />}
                      disabled={formData.inquire_for_pricing}
                      value={formData.price_per_day}
                      onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                    />
                  </div>
                )}
                
                {/* Longer term pricing section - shown when Longer-term is enabled and not in 'inquire' mode */}
                <div className="mt-6">
                  {formData.enable_longer_term_pricing && !formData.inquire_for_pricing && (
                    <div className="mt-4 space-y-6 bg-gray-50 p-4 rounded-xl relative">
                      {/* Help tooltip in top-right */}
                      <div className="absolute top-3 right-3">
                        <div className="relative inline-block group">
                          <HelpCircle className="h-4 w-4 text-maroon-400" />
                          <div className="absolute bottom-full right-0 transform mb-2 w-80 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            These options allow you provide rates for longer term bookings that are lower than the daily rate. You have the option of either setting fixed weekly/monthly/yearly rates, or specifying a percentage discount from the base daily rate.
                            <div className="absolute top-full right-2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
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
                
                {/* Discounts & Surcharges section (org-level) */}
                {orgAdjustments.length > 0 && (
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-maroon-800 mb-4 flex items-center">
                      <BadgePercent className="h-5 w-5 mr-2 text-maroon-600" />
                      Discounts & Surcharges
                    </h3>
                    <div className="space-y-2">
                      {orgAdjustments.map((row) => {
                        const name = (row.data?.name as string) ||
                          (row.type === 'user_selected_discount' ? 'User-selected discount' :
                           row.type === 'capacity_surcharge' ? 'Capacity surcharge' :
                           row.type === 'off_hours_adjustment' ? 'Off-hours adjustment' :
                           row.type === 'off_days_adjustment' ? 'Off-days adjustment' : 'Adjustment');
                        const adjustmentKey = computeAdjustmentKey(row);
                        const note =
                          (row.data?.documentation as string) ||
                          (row.data?.required_documentation as string) ||
                          (row.data?.approval_process as string) ||
                          (row.data?.explanatoryText as string) ||
                          (row.data?.explanatory_text as string) ||
                          (row.data?.note as string) || '';
                        return (
                          <label key={row.id} className="flex items-center gap-2 text-sm text-maroon-800">
                            <input
                              type="checkbox"
                              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                              checked={!!selectedAdjustments[adjustmentKey]}
                              onChange={(e) => setSelectedAdjustments(prev => ({ ...prev, [adjustmentKey]: e.target.checked }))}
                            />
                            <span className="inline-flex items-center gap-1">
                              {note ? (
                                <Tooltip content={<div className="max-w-xs whitespace-normal">{note}</div>}>
                                  <span className="underline decoration-dotted underline-offset-2 cursor-help">
                                    {name}
                                  </span>
                                </Tooltip>
                              ) : (
                                <span>{name}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Taxes and Fees Section */}
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-maroon-800 mb-4 flex items-center">
                    <Receipt className="h-5 w-5 mr-2 text-maroon-600" />
                    Taxes and Fees
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-maroon-700">
                          Tax Rate (%)
                        </label>
                        {(() => {
                          const propertyId = id || '';
                          const lookedUp = typeof window !== 'undefined' ? localStorage.getItem(`taxRateLookup_${propertyId}`) : null;
                          if (!taxRateFetched && !lookedUp) {
                            return (
                              <button
                                type="button"
                                className={`text-xs px-2 py-1 rounded-lg border border-maroon-200 bg-maroon-50 hover:bg-maroon-100 text-maroon-700 transition-colors ${taxRateLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                disabled={taxRateLoading || !formData.address_postal_code}
                                onClick={async () => {
                                  setTaxRateLoading(true);
                                  setTaxRateError(null);
                                  setTaxRateFetched(false);
                                  const rate = await getTaxRateByZip(formData.address_postal_code);
                                  if (rate !== null && !isNaN(rate)) {
                                    setFormData(prev => ({ ...prev, tax_rate: rate.toString() }));
                                    setTaxRateFetched(true);
                                    localStorage.setItem(`taxRateLookup_${propertyId}`, '1');
                                    localStorage.setItem(`taxRateValue_${propertyId}`, rate.toString());
                                  } else {
                                    setTaxRateError('Failed to fetch tax rate');
                                  }
                                  setTaxRateLoading(false);
                                }}
                              >
                                {taxRateLoading ? 'Looking up...' : 'Lookup tax rate'}
                              </button>
                            );
                          } else {
                            return null;
                          }
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={formData.tax_rate}
                          onChange={(e) => {
                            setFormData({ ...formData, tax_rate: e.target.value });
                            setTaxRateFetched(true); // Prevent API override after manual edit
                          }}
                          placeholder="0"
                          disabled={formData.inquire_for_pricing}
                        />
                        {taxRateLoading && (
                          <span className="text-xs text-maroon-500 animate-pulse">Looking up tax rate...</span>
                        )}
                        {taxRateError && (
                          <span className="text-xs text-red-500">{taxRateError}</span>
                        )}
                        {(() => {
                          const propertyId = id || '';
                          const lookedUp = typeof window !== 'undefined' ? localStorage.getItem(`taxRateLookup_${propertyId}`) : null;
                          const lookedUpRate = typeof window !== 'undefined' ? localStorage.getItem(`taxRateValue_${propertyId}`) : null;
                          // If flag is set but value is 0 or missing, clear the flag so lookup can be retried
                          if (lookedUp && (!lookedUpRate || lookedUpRate === '0' || lookedUpRate === '')) {
                            localStorage.removeItem(`taxRateLookup_${propertyId}`);
                            localStorage.removeItem(`taxRateValue_${propertyId}`);
                          }
                          if (
                            !taxRateLoading &&
                            !taxRateError &&
                            (taxRateFetched || lookedUp) &&
                            formData.tax_rate !== '0' &&
                            formData.tax_rate !== ''
                          ) {
                            return (
  <span className="text-xs text-green-600 flex items-center gap-1">
    Auto-filled
    <Tooltip content={<div style={{ maxWidth: 320, whiteSpace: 'normal', padding: 4 }}>
  We have looked up the sales tax rate based on the location of this space,
  but we can not guarantee that this rate is correct.<br />
  <strong>Please confirm your tax rate and update if necessary.</strong>
</div>} placement="top">
      <HelpCircle className="w-4 h-4 text-maroon-400 cursor-pointer" />
    </Tooltip>
  </span>
);
                          }
                          return null;
                        })()}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Applied to all bookings. Example: Enter "8.5" for 8.5% tax rate
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-2">
                        Fee Type
                      </label>
                      <select
                        value={formData.fee_type}
                        onChange={(e) => setFormData({ ...formData, fee_type: e.target.value as 'percentage' | 'fixed' })}
                        className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                        disabled={formData.inquire_for_pricing}
                      >
                        <option value="percentage">Percentage of base price</option>
                        <option value="fixed">Fixed amount</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-2">
                        {formData.fee_type === 'percentage' ? 'Fee Percentage (%)' : 'Fee Amount ($)'}
                      </label>
                      <Input
                        type="number"
                        value={formData.fee_value}
                        onChange={(e) => setFormData({ ...formData, fee_value: e.target.value })}
                        placeholder="0"
                        disabled={formData.inquire_for_pricing}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {formData.fee_type === 'percentage' 
                          ? 'Example: Enter "5" for a 5% service fee' 
                          : 'Example: Enter "50" for a $50 fixed fee'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-2">
                        Fee Description (Optional)
                      </label>
                      <Input
                        type="text"
                        value={formData.fee_description}
                        onChange={(e) => setFormData({ ...formData, fee_description: e.target.value })}
                        placeholder="e.g., Cleaning fee, Service fee, etc."
                        disabled={formData.inquire_for_pricing}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This will be shown to customers during checkout
                      </p>
                    </div>
                    
                    {(parseFloat(formData.tax_rate) > 0 || parseFloat(formData.fee_value) > 0) ? (
                      <div className="p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                        <p className="font-medium">Taxes and fees configured</p>
                        <p className="text-sm">
                          {parseFloat(formData.tax_rate) > 0 && `Tax rate: ${formData.tax_rate}%`}
                          {parseFloat(formData.tax_rate) > 0 && parseFloat(formData.fee_value) > 0 && ' • '}
                          {parseFloat(formData.fee_value) > 0 && 
                            `${formData.fee_type === 'percentage' ? `${formData.fee_value}% fee` : `$${formData.fee_value} fee`}`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 text-gray-500 rounded-lg border border-gray-200">
                        <p className="italic">No taxes or fees currently configured</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
                    isLoading={saving}
                    disabled={saving}
                  >
                    Save Pricing
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <Calendar className="h-5 w-5 mr-2" />
                  Availability Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PropertySchedule
                  schedule={schedule}
                  onScheduleChange={setSchedule}
                  onSave={handleSaveSchedule}
                  loading={saving}
                  error={error}
                />

                {/* Setup & Cleanup Section */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <CardTitle className="flex items-center text-maroon-800 mb-2">
                    <Brush className="h-5 w-5 mr-2" />
                    Setup & Cleanup
                  </CardTitle>
                  <p className="text-sm text-gray-600 mb-4">Automatically block out time before and/or after the selected time slot so there is ample time between bookings.</p>

                  {/* Hourly bookings */}
                  {formData.show_hourly && (
                    <div className="mb-6">
                      <div className="font-medium text-maroon-700 mb-2">Hourly bookings</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Setup buffer (minutes)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.hourly.setupMinutes}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, hourly: { ...prev.hourly, setupMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 30"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Cleanup buffer (minutes)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.hourly.cleanupMinutes}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, hourly: { ...prev.hourly, cleanupMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 30"
                          />
                        </div>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                            checked={setupCleanup.hourly.includeInBilling}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, hourly: { ...prev.hourly, includeInBilling: e.target.checked } }))}
                          />
                          <Tooltip
                            content={
                              <div className="max-w-sm whitespace-normal">
                                If you include the buffer times in the billing calculation, then that time will be added automatically to the quote, so if the guest books a five hour timeslot, and your setup and cleanup are one hour each, the quote will be for 5 hours + 2 hours, or 7 hours total. Alternatively, you can not include the time in the billing calculation and instead include it as a flat fee, under the Pricing tab.
                              </div>
                            }
                          >
                            <span className="text-sm underline decoration-dotted underline-offset-2 cursor-help">include this time in the billing calculation</span>
                          </Tooltip>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Daily bookings */}
                  {formData.show_daily && (
                    <div className="mb-6">
                      <div className="font-medium text-maroon-700 mb-2">Daily bookings</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Setup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.daily.setupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, daily: { ...prev.daily, setupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Cleanup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.daily.cleanupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, daily: { ...prev.daily, cleanupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                            checked={setupCleanup.daily.includeInBilling}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, daily: { ...prev.daily, includeInBilling: e.target.checked } }))}
                          />
                          <Tooltip
                            content={
                              <div className="max-w-sm whitespace-normal">
                                If you include the buffer times in the billing calculation, then that time will be added automatically to the quote, so if the guest books a five hour timeslot, and your setup and cleanup are one hour each, the quote will be for 5 hours + 2 hours, or 7 hours total. Alternatively, you can not include the time in the billing calculation and instead include it as a flat fee, under the Pricing tab.
                              </div>
                            }
                          >
                            <span className="text-sm underline decoration-dotted underline-offset-2 cursor-help">include this time in the billing calculation</span>
                          </Tooltip>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Weekly bookings */}
                  {formData.weekly_rate_enabled && (
                    <div className="mb-6">
                      <div className="font-medium text-maroon-700 mb-2">Weekly bookings</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Setup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.weekly.setupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, weekly: { ...prev.weekly, setupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Cleanup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.weekly.cleanupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, weekly: { ...prev.weekly, cleanupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                            checked={setupCleanup.weekly.includeInBilling}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, weekly: { ...prev.weekly, includeInBilling: e.target.checked } }))}
                          />
                          <Tooltip
                            content={
                              <div className="max-w-sm whitespace-normal">
                                If you include the buffer times in the billing calculation, then that time will be added automatically to the quote, so if the guest books a five hour timeslot, and your setup and cleanup are one hour each, the quote will be for 5 hours + 2 hours, or 7 hours total. Alternatively, you can not include the time in the billing calculation and instead include it as a flat fee, under the Pricing tab.
                              </div>
                            }
                          >
                            <span className="text-sm underline decoration-dotted underline-offset-2 cursor-help">include this time in the billing calculation</span>
                          </Tooltip>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Monthly bookings */}
                  {formData.monthly_rate_enabled && (
                    <div className="mb-2">
                      <div className="font-medium text-maroon-700 mb-2">Monthly bookings</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Setup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.monthly.setupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, monthly: { ...prev.monthly, setupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-maroon-700 mb-1">Cleanup buffer (days)</label>
                          <input
                            type="number"
                            min={0}
                            value={setupCleanup.monthly.cleanupDays}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, monthly: { ...prev.monthly, cleanupDays: Math.max(0, parseInt(e.target.value || '0', 10)) } }))}
                            className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                            checked={setupCleanup.monthly.includeInBilling}
                            onChange={(e) => setSetupCleanup((prev) => ({ ...prev, monthly: { ...prev.monthly, includeInBilling: e.target.checked } }))}
                          />
                          <Tooltip
                            content={
                              <div className="max-w-sm whitespace-normal">
                                If you include the buffer times in the billing calculation, then that time will be added automatically to the quote, so if the guest books a five hour timeslot, and your setup and cleanup are one hour each, the quote will be for 5 hours + 2 hours, or 7 hours total. Alternatively, you can not include the time in the billing calculation and instead include it as a flat fee, under the Pricing tab.
                              </div>
                            }
                          >
                            <span className="text-sm underline decoration-dotted underline-offset-2 cursor-help">include this time in the billing calculation</span>
                          </Tooltip>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>

      {/* Publish Confirmation Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-3">List Property Publicly?</h3>
            <p className="text-gray-700 mb-6">
              This property will become visible to all users browsing venues. Are you sure you want to list this property publicly?
            </p>
            <div className="flex justify-end space-x-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowPublishDialog(false)}
                disabled={publishLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => togglePublishedStatus(true)}
                disabled={publishLoading}
                isLoading={publishLoading}
              >
                <Check className="h-4 w-4 mr-1" />
                Yes, List Property
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unpublish Confirmation Dialog */}
      {showUnpublishDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Hide Property from Public?</h3>
            <p className="text-gray-700 mb-6">
              This property will no longer be visible to users browsing venues. It will be saved as a draft. You can list it again anytime.
            </p>
            <div className="flex justify-end space-x-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowUnpublishDialog(false)}
                disabled={publishLoading}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border-red-300 hover:bg-red-50 text-red-600"
                onClick={() => togglePublishedStatus(false)}
                disabled={publishLoading}
                isLoading={publishLoading}
              >
                <EyeOff className="h-4 w-4 mr-1" />
                Yes, Hide Property
              </Button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
      
      {activeTab === 'reviews' && (
        <div className="bg-white p-6 rounded-b-xl rounded-tr-xl border-t border-l border-r border-b">
          <h2 className="text-2xl font-bold text-maroon-800 mb-6">
            Reviews Management
          </h2>
          <ReviewManagement propertyId={id || ''} />
        </div>
      )}
    </div>
  );
};

export default ManagePropertyPage;