import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Store, Phone, CreditCard, ExternalLink, CheckCircle, XCircle, RefreshCw, Lock, Plus, ChevronDown, Trash2, Percent } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Toast } from '../components/ui/toast';
import { env } from '../lib/env';

const slugifyOrgName = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const ProfilePage: React.FC = () => {
  usePageHeaderTitle('Profile');
  const navigate = useNavigate();
  const { user, sessionUser, isImpersonating } = useAuth();
  const [_loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const [profile, setProfile] = useState({
    id: '',
    full_name: '',
    email: '',
    primary_organization_id: null as string | null,
    phone: '',
    business_type: '',
    brevo_opt_in: false as boolean,
    brevo_opt_in_ts: null as string | null,
  });
  
  // Track organization name separately from profile
  const [organizationName, setOrganizationName] = useState<string>('');
  // Organization About Brand (moved from profiles)
  const [organizationAboutBrand, setOrganizationAboutBrand] = useState<string>('');
  // Organization business type (moved from profiles)
  const [organizationBusinessType, setOrganizationBusinessType] = useState<string>('');
  // Organization-level Stripe state
  const [organizationStripe, setOrganizationStripe] = useState<{
    id: string | null,
    stripe_account_id: string | null,
    charges_enabled: boolean,
    payouts_enabled: boolean,
  }>({ id: null, stripe_account_id: null, charges_enabled: false, payouts_enabled: false });

  // Payment provider state
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'authorizenet'>('stripe');
  const [authorizeNetSettings, setAuthorizeNetSettings] = useState({
    apiLoginId: '',
    transactionKey: '',
    sandboxMode: true,
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<'personal' | 'org'>('personal');

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const isPasswordModalOpenRef = useRef(false);
  
  // Email change state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    password: '',
    newEmail: '',
    confirmEmail: '',
  });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const isEmailModalOpenRef = useRef(false);

  // Organization members and invites
  const [orgMembers, setOrgMembers] = useState<Array<{ user_id: string; role: string; full_name?: string | null; email?: string | null }>>([]);
  const [orgInvites, setOrgInvites] = useState<Array<{ id: string; email: string; role: string; created_at: string }>>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Organization Discounts & Surcharges types (matching original design)
  type AdjustmentType = 'user_selected_discount' | 'capacity_surcharge' | 'off_hours_adjustment' | 'off_days_adjustment';
  type PerUnit = 'per_hour' | 'per_day' | 'per_week' | 'per_month' | 'per_booking';
  type DayPreset = 'weekdays' | 'weekends' | 'tue_thu' | 'mon_thu' | 'fridays';
  
  interface BaseAdjustment { 
    id: string; 
    type: AdjustmentType; 
    stableKey: string;
    name: string; 
    explanatoryText?: string;
  }
  
  interface UserSelectedDiscount extends BaseAdjustment { 
    rateType: 'percentage' | 'fixed';
    discountPercent?: number;
    discountAmount?: number;
    requiredDocumentation?: string;
  }
  
  interface CapacitySurcharge extends BaseAdjustment { 
    perHeadcount: number;
    surchargeAmount: number;
    per: PerUnit;
  }
  
  interface OffHoursAdjustment extends BaseAdjustment { 
    outsideStart: string; // e.g. "07:00"
    outsideEnd: string;   // e.g. "20:00"
    adjustment: 'surcharge' | 'discount';
    rateType: 'percentage' | 'fixed';
    ratePercent?: number;
    rateAmount?: number;
  }
  
  interface OffDaysAdjustment extends BaseAdjustment { 
    days: DayPreset;
    adjustment: 'surcharge' | 'discount';
    rateType: 'percentage' | 'fixed';
    ratePercent?: number;
    rateAmount?: number;
  }
  type OrgAdjustment = UserSelectedDiscount | CapacitySurcharge | OffHoursAdjustment | OffDaysAdjustment;
  const [orgAdjustments, setOrgAdjustments] = useState<OrgAdjustment[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/signin?redirect=/profile');
      return;
    }

    // Update profile state when user changes
    setProfile({
      id: user.id || '',
      full_name: user.full_name || '',
      email: user.email || '',
      primary_organization_id: (user as any).primary_organization_id || null,
      phone: user.phone || '',
      business_type: '',
      brevo_opt_in: (user as any).brevo_opt_in || false,
      brevo_opt_in_ts: (user as any).brevo_opt_in_ts || null,
    });
    
    // Skip complex profile loading that causes hangs - use session data
    setLoading(false);
    
    // Fetch organization ID from profiles table (session doesn't include this)
    if (user?.id) {
      fetchOrganizationId(user.id);
    }
  }, [user, navigate]);

  // Fetch complete profile data from profiles table (session doesn't include custom fields)
  const fetchOrganizationId = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('primary_organization_id, phone, brevo_opt_in, brevo_opt_in_ts')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[ProfilePage] Error fetching profile data:', error);
      } else {
        // Update profile state with all the fetched data
        setProfile(prev => ({
          ...prev,
          primary_organization_id: (profileData as any)?.primary_organization_id || null,
          phone: (profileData as any)?.phone || '',
          brevo_opt_in: (profileData as any)?.brevo_opt_in || false,
          brevo_opt_in_ts: (profileData as any)?.brevo_opt_in_ts || null,
        }));
      }
    } catch (error) {
      console.error('[ProfilePage] Exception fetching profile data:', error);
    }
  };

  // Load organization data
  const loadOrganizationData = useCallback(async (organizationId: string) => {
    try {
      // Load organization details
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('name, about_brand, stripe_account_id, charges_enabled, payouts_enabled, business_type, payment_provider, authorizenet_api_login_id, authorizenet_transaction_key, authorizenet_sandbox_mode')
        .eq('id', organizationId)
        .single();

      if (orgError) {
        console.error('Error loading organization:', orgError);
      } else if (orgData) {
        setOrganizationName((orgData as any).name || '');
        setOrganizationAboutBrand((orgData as any).about_brand || '');
        setOrganizationStripe({
          id: organizationId,
          stripe_account_id: (orgData as any).stripe_account_id || null,
          charges_enabled: (orgData as any).charges_enabled || false,
          payouts_enabled: (orgData as any).payouts_enabled || false,
        });
        setOrganizationBusinessType(((orgData as any)?.business_type as string) || '');
        
        // Set payment provider settings
        setPaymentProvider(((orgData as any)?.payment_provider as 'stripe' | 'authorizenet') || 'stripe');
        setAuthorizeNetSettings({
          apiLoginId: (orgData as any)?.authorizenet_api_login_id || '',
          transactionKey: (orgData as any)?.authorizenet_transaction_key || '',
          sandboxMode: (orgData as any)?.authorizenet_sandbox_mode !== false, // default to true
        });
      }

      // Load organization members
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          profiles!inner(
            full_name,
            email
          )
        `)
        .eq('organization_id', organizationId);

      if (membersError) {
        console.error('Error loading organization members:', membersError);
      } else {
        const formattedMembers = (membersData || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name,
          email: m.profiles?.email
        }));
        setOrgMembers(formattedMembers);
      }

      // Load organization invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('organization_member_invites')
        .select('id, email, role, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (invitesError) {
        console.error('Error loading organization invites:', invitesError);
      } else {
        setOrgInvites(invitesData || []);
      }

      // Load organization adjustments
      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from('organization_adjustments')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });

      if (adjustmentsError) {
        console.error('Error loading organization adjustments:', adjustmentsError);
      } else {
        const formattedAdjustments = (adjustmentsData || []).map((adj: any) => ({
          id: adj.id,
          type: adj.type,
          stableKey: (adj.data?.stableKey as string) || adj.id,
          name: adj.data.name || '',
          ...adj.data
        }));
        setOrgAdjustments(formattedAdjustments);
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
    }
  }, []);

  // Load organization data when organization ID changes
  useEffect(() => {
    if (profile.primary_organization_id) {
      loadOrganizationData(profile.primary_organization_id);
    }
  }, [profile.primary_organization_id, loadOrganizationData]);


  // Adjustment management functions
  const addAdjustment = (type: AdjustmentType) => {
    let item: OrgAdjustment;
    switch (type) {
      case 'user_selected_discount':
        item = { 
          id: crypto.randomUUID(), 
          type, 
          stableKey: crypto.randomUUID(),
          name: '', 
          rateType: 'percentage', 
          discountPercent: 0,
          requiredDocumentation: '',
          explanatoryText: ''
        } as UserSelectedDiscount;
        break;
      case 'capacity_surcharge':
        item = { 
          id: crypto.randomUUID(), 
          type, 
          stableKey: crypto.randomUUID(),
          name: '', 
          perHeadcount: 1, 
          surchargeAmount: 0, 
          per: 'per_hour',
          explanatoryText: ''
        } as CapacitySurcharge;
        break;
      case 'off_hours_adjustment':
        item = { 
          id: crypto.randomUUID(), 
          type, 
          stableKey: crypto.randomUUID(),
          name: '', 
          outsideStart: '07:00', 
          outsideEnd: '20:00',
          adjustment: 'surcharge', 
          rateType: 'percentage', 
          ratePercent: 0,
          explanatoryText: ''
        } as OffHoursAdjustment;
        break;
      case 'off_days_adjustment':
        item = { 
          id: crypto.randomUUID(), 
          type, 
          stableKey: crypto.randomUUID(),
          name: '', 
          days: 'weekdays',
          adjustment: 'surcharge', 
          rateType: 'fixed', 
          rateAmount: 0,
          explanatoryText: ''
        } as OffDaysAdjustment;
        break;
      default:
        return;
    }
    setOrgAdjustments(prev => [...prev, item]);
    setAddMenuOpen(false);
  };

  const removeAdjustment = (id: string) => {
    setOrgAdjustments(prev => prev.filter(adj => adj.id !== id));
  };

  const updateAdjustment = (id: string, updates: Partial<OrgAdjustment>) => {
    setOrgAdjustments(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Add member functionality
  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !profile.primary_organization_id) return;
    
    setAddingMember(true);
    setMemberError(null);
    
    try {
      const { data, error } = await (supabase as any).functions.invoke('add-org-member', {
        body: {
          organization_id: profile.primary_organization_id,
          email: newMemberEmail,
          role: newMemberRole,
        },
      });
      
      if (error) throw error;
      
      // Refresh organization data to show new member/invite
      loadOrganizationData(profile.primary_organization_id);
      setNewMemberEmail('');
      setNewMemberRole('member');
      
      setToastMessage('Member invited successfully');
      setToastType('success');
      setShowSuccessToast(true);
    } catch (err) {
      console.error('[ProfilePage] Error adding member:', err);
      setMemberError((err as any).message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  // Stripe Connect functions
  const handleStripeConnect = async (type: 'account_onboarding' | 'account_update') => {
    try {
      setSaving(true);
      if (!profile.primary_organization_id) {
        setToastMessage('Create or select an organization first');
        setToastType('error');
        setShowSuccessToast(true);
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/profile?stripe=return`;
      const refreshUrl = `${origin}/profile?stripe=refresh`;

      const { data, error } = await (supabase as any).functions.invoke('create-express-account-link', {
        body: { returnUrl, refreshUrl, type },
      });

      if (error) {
        console.error('create-express-account-link error:', error);
        setToastMessage(error.message || 'Failed to start Stripe onboarding');
        setToastType('error');
        setShowSuccessToast(true);
        return;
      }

      const url = (data as any)?.url;
      if (url) {
        // Redirect user to Stripe onboarding/update
        window.location.href = url as string;
      } else {
        setToastMessage('Unexpected response from Stripe link creator');
        setToastType('error');
        setShowSuccessToast(true);
      }
    } catch (error) {
      console.error('Stripe Connect error:', error);
      setToastMessage('Failed to connect to Stripe');
      setToastType('error');
      setShowSuccessToast(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshStripeStatus = async () => {
    try {
      setSaving(true);
      if (!profile.primary_organization_id) {
        setToastMessage('No organization found to refresh');
        setToastType('error');
        setShowSuccessToast(true);
        return;
      }

      const { data, error } = await (supabase as any).functions.invoke('refresh-stripe-status', {
        body: {},
      });

      if (error) {
        console.error('refresh-stripe-status error:', error);
        setToastMessage(error.message || 'Failed to refresh Stripe status');
        setToastType('error');
        setShowSuccessToast(true);
        return;
      }

      // Update local organization Stripe status
      const charges_enabled = (data as any)?.charges_enabled ?? false;
      const payouts_enabled = (data as any)?.payouts_enabled ?? false;
      setOrganizationStripe(prev => ({
        ...prev,
        charges_enabled,
        payouts_enabled,
      }));

      setToastMessage('Stripe status refreshed');
      setToastType('success');
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Stripe refresh error:', error);
      setToastMessage('Failed to refresh Stripe status');
      setToastType('error');
      setShowSuccessToast(true);
    } finally {
      setSaving(false);
    }
  };

  // Email change handler
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setChangingEmail(true);

    if (emailData.newEmail !== emailData.confirmEmail) {
      setEmailError('Email addresses do not match');
      setChangingEmail(false);
      return;
    }

    try {
      // Use Supabase auth to change email
      const { error } = await supabase.auth.updateUser({
        email: emailData.newEmail,
        password: emailData.password
      });

      if (error) throw error;

      setEmailSuccess('Email change verification sent to your new email address');
      setEmailData({ password: '', newEmail: '', confirmEmail: '' });
    } catch (error: any) {
      console.error('Email change error:', error);
      setEmailError(error.message || 'Failed to change email');
    } finally {
      setChangingEmail(false);
    }
  };

  // Password change handler
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setChangingPassword(true);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      setChangingPassword(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      setChangingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password change error:', error);
      setPasswordError(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // Only require phone number when in organization tab (since that's where phone is managed)
    if (activeTab === 'org' && (!profile.phone || profile.phone.trim() === '')) {
      setSaving(false);
      setError('Phone number is required');
      setToastMessage('Phone number is required');
      setToastType('error');
      setShowSuccessToast(true);
      return;
    }

    const trimmedOrgName = organizationName?.trim() || '';
    const adjustmentsPayload = orgAdjustments.map((adj, index) => {
      const { id: _id, type, name, ...rest } = adj as any;
      return {
        type,
        data: {
          name,
          ...rest,
        },
        sort_order: index,
      };
    });

    try {
      // Track newly created organization id (if any)
      let newOrgId: string | null = null;
      const updateData = {
        full_name: profile.full_name,
        phone: profile.phone,
        updated_at: new Date().toISOString(),
      };
      
      if (isImpersonating && sessionUser?.is_admin && user?.id) {
        const adminPayload: Record<string, unknown> = {
          user_id: user.id,
          updates: updateData,
        };

        if (activeTab === 'org') {
          const orgPayload: Record<string, unknown> = {
            current_id: profile.primary_organization_id,
          };

          if (!profile.primary_organization_id && trimmedOrgName) {
            orgPayload.create = {
              name: trimmedOrgName,
              about_brand: organizationAboutBrand || '',
              business_type: organizationBusinessType || null,
            };
          } else if (profile.primary_organization_id) {
            const orgUpdates: Record<string, unknown> = {};
            if (trimmedOrgName) orgUpdates.name = trimmedOrgName;
            if (organizationAboutBrand !== null && organizationAboutBrand !== undefined) {
              orgUpdates.about_brand = organizationAboutBrand;
            }
            if (organizationBusinessType !== undefined) {
              orgUpdates.business_type = organizationBusinessType || null;
            }
            if (Object.keys(orgUpdates).length) {
              orgPayload.updates = orgUpdates;
            }
          }

          if (adjustmentsPayload.length > 0) {
            orgPayload.adjustments = adjustmentsPayload;
          } else if (profile.primary_organization_id) {
            orgPayload.clear_adjustments = true;
          }

          adminPayload.organization = orgPayload;
        }

        const { data: adminData, error: adminError } = await (supabase as any).functions.invoke('admin-update-profile', {
          body: adminPayload,
        });

        if (adminError || !adminData?.ok) {
          console.error('[ProfilePage] Admin profile update failed:', adminError || adminData);
          throw new Error(adminData?.error || adminError?.message || 'Failed to update profile via admin function');
        }

        if (adminData?.profile) {
          setProfile(prev => ({
            ...prev,
            ...adminData.profile,
            full_name: profile.full_name,
            phone: profile.phone,
          }));
        }

        const orgIdFromResponse = adminData?.organization_id
          ?? (adminData?.profile?.primary_organization_id ?? profile.primary_organization_id);

        if (activeTab === 'org' && orgIdFromResponse) {
          setProfile(prev => ({ ...prev, primary_organization_id: orgIdFromResponse }));
          await loadOrganizationData(orgIdFromResponse);
        } else if (activeTab === 'org' && profile.primary_organization_id) {
          await loadOrganizationData(profile.primary_organization_id);
        }

        const successMessage = activeTab === 'personal' 
          ? 'Personal information updated successfully' 
          : 'Organization information updated successfully';
        setToastMessage(successMessage);
        setToastType('success');
        setShowSuccessToast(true);
        return;
      }

      // Update profiles table directly (bypassing RLS issues)
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData as any)
        .eq('id', user?.id || '');

      if (updateError) {
        console.error('[ProfilePage] Profile update error:', updateError);
        throw updateError;
      }

      // Handle organization creation/updates if in org tab
      if (activeTab === 'org') {
        try {
          if (profile.primary_organization_id) {
            // Update existing organization
            const updates: any = {};
            
            if (trimmedOrgName) {
              updates.name = trimmedOrgName;
            }
            
            if (organizationAboutBrand !== null && organizationAboutBrand !== undefined) {
              updates.about_brand = organizationAboutBrand;
            }
            if (organizationBusinessType !== undefined) {
              updates.business_type = organizationBusinessType || null;
            }
            
            // Update payment provider settings
            updates.payment_provider = paymentProvider;
            if (paymentProvider === 'authorizenet') {
              updates.authorizenet_api_login_id = authorizeNetSettings.apiLoginId;
              updates.authorizenet_transaction_key = authorizeNetSettings.transactionKey;
              updates.authorizenet_sandbox_mode = authorizeNetSettings.sandboxMode;
            }
            
            if (Object.keys(updates).length > 0) {
              const { error: orgError } = await supabase
                .from('organizations')
                .update(updates)
                .eq('id', profile.primary_organization_id);
                
              if (orgError) {
                console.error('[ProfilePage] Error updating organization:', orgError);
                throw orgError;
              }
            }
          } else if (trimmedOrgName) {
            // Create new organization and associate user
            const normalizedName = trimmedOrgName;

            const baseSlug = slugifyOrgName(normalizedName) || 'org';
            let currentSlug = baseSlug;
            let attempt = 2;

            while (true) {
              const { data: existingSlug, error: slugError } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', currentSlug)
                .maybeSingle();

              if (slugError) {
                console.error('[ProfilePage] Error checking organization slug availability:', slugError);
                break;
              }

              if (!existingSlug) break;

              currentSlug = `${baseSlug}-${attempt++}`;
            }

            const { data: newOrg, error: createError } = await supabase
              .from('organizations')
              .insert({
                name: normalizedName,
                slug: currentSlug,
                about_brand: organizationAboutBrand || '',
                business_type: organizationBusinessType || null,
                payment_provider: paymentProvider,
                authorizenet_api_login_id: paymentProvider === 'authorizenet' ? authorizeNetSettings.apiLoginId : null,
                authorizenet_transaction_key: paymentProvider === 'authorizenet' ? authorizeNetSettings.transactionKey : null,
                authorizenet_sandbox_mode: paymentProvider === 'authorizenet' ? authorizeNetSettings.sandboxMode : true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (createError) {
              if ((createError as any)?.code === '23505') {
                const message = 'We could not create the organization because the generated slug already exists. Please try again.';
                console.warn('[ProfilePage] Organization creation conflict for slug:', currentSlug, createError);
                setError(message);
                setToastMessage(message);
                setToastType('error');
                setShowSuccessToast(true);
                return;
              }
              console.error('[ProfilePage] Error creating organization:', createError);
              throw createError;
            }

            // Capture the new org id for subsequent saves
            newOrgId = (newOrg as any).id as string;
            
            // Associate user with the new organization
            const { error: linkError } = await supabase
              .from('profiles')
              .update({ primary_organization_id: (newOrg as any).id })
              .eq('id', user?.id || '');

            if (linkError) {
              console.error('[ProfilePage] Error linking user to organization:', linkError);
              throw linkError;
            }
            
            // Update local state
            setProfile(prev => ({
              ...prev,
              primary_organization_id: (newOrg as any).id
            }));
          }
        } catch (orgError) {
          console.error('[ProfilePage] Organization operation failed:', orgError);
          throw orgError;
        }
      }

      // Persist organization adjustments if we're on the org tab and have an org id
      const orgIdToUse = newOrgId || profile.primary_organization_id;
      if (activeTab === 'org' && orgIdToUse) {
        try {
          const currentIds = (orgAdjustments || []).map((a) => a.id).filter(Boolean);

          // Delete removed adjustments only (preserve IDs for existing rows)
          if (currentIds.length > 0) {
            await (supabase as any)
              .from('organization_adjustments')
              .delete()
              .eq('organization_id', orgIdToUse)
              .not('id', 'in', `(${currentIds.join(',')})`);
          } else {
            await (supabase as any)
              .from('organization_adjustments')
              .delete()
              .eq('organization_id', orgIdToUse);
          }

          // Upsert current adjustments by id (keeps IDs stable across edits)
          if (orgAdjustments.length > 0) {
            const adjustmentsToSave = orgAdjustments.map((adj: any, index: number) => {
              const { id, type, name, ...rest } = adj;
              return {
                id,
                organization_id: orgIdToUse,
                type,
                data: {
                  name,
                  ...rest,
                },
                sort_order: index,
              };
            });

            const { error } = await (supabase as any)
              .from('organization_adjustments')
              .upsert(adjustmentsToSave, { onConflict: 'id' });
            if (error) throw error;
          }
        } catch (adjError) {
          console.error('[ProfilePage] Failed to save organization adjustments:', adjError);
          throw adjError;
        }
      }

      const successMessage = activeTab === 'personal' 
        ? 'Personal information updated successfully' 
        : 'Organization information updated successfully';
      setToastMessage(successMessage);
      setToastType('success');
      setShowSuccessToast(true);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      setToastMessage('Failed to update profile');
      setToastType('error');
      setShowSuccessToast(true);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[60rem] mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-maroon-800 font-display">
            Profile
          </h1>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              type="button"
              className={`py-3 px-5 md:px-6 font-semibold text-base md:text-lg focus:outline-none transition-colors rounded-xl ${activeTab === 'personal' ? 'bg-maroon-50 text-maroon-800 border border-maroon-200 shadow-sm' : 'text-gray-600 hover:text-maroon-700 border border-transparent hover:bg-gray-50'}`}
              onClick={() => setActiveTab('personal')}
            >
              Personal
            </button>
            <button
              type="button"
              className={`py-3 px-5 md:px-6 font-semibold text-base md:text-lg focus:outline-none transition-colors rounded-xl ${activeTab === 'org' ? 'bg-maroon-50 text-maroon-800 border border-maroon-200 shadow-sm' : 'text-gray-600 hover:text-maroon-700 border border-transparent hover:bg-gray-50'}`}
              onClick={() => setActiveTab('org')}
            >
              Organizational
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {activeTab === 'personal' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-maroon-800">
                    <User className="h-5 w-5 mr-2" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Full Name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    icon={<User className="h-5 w-5" />}
                    required
                  />
                  <Input
                    label="Email Address"
                    value={profile.email || ''}
                    icon={<Mail className="h-5 w-5" />}
                    disabled
                    required
                  />
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEmailModal(true);
                        isEmailModalOpenRef.current = true;
                        setEmailError(null);
                        setEmailSuccess(null);
                      }}
                    >
                      Change Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Password Section */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center text-maroon-800">
                    <Lock className="h-5 w-5 mr-2" />
                    Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-maroon-600 mb-4">
                    Change your account password to keep your account secure.
                  </p>
                  <Button
                    onClick={() => {
                      setShowPasswordModal(true);
                      isPasswordModalOpenRef.current = true;
                    }}
                    variant="outline"
                  >
                    Change Password
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'org' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-maroon-800">
                    <Store className="h-5 w-5 mr-2" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Organization Name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    icon={<Store className="h-5 w-5" />}
                    placeholder="Enter your organization name"
                  />
                  <Input
                    label="Phone Number"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    icon={<Phone className="h-5 w-5" />}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-maroon-700 mb-2">
                      Business Type
                    </label>
                    <select
                      value={organizationBusinessType || ''}
                      onChange={(e) => setOrganizationBusinessType(e.target.value)}
                      className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    >
                      <option value="">Select a business type</option>
                      <option value="merchant">Merchant/Brand (looking to browse listings)</option>
                      <option value="venue">Venue owner/operator (looking to list spaces)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* About Your Brand (merchants) */}
              {organizationBusinessType === 'merchant' && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center text-maroon-800">
                      <Store className="h-5 w-5 mr-2" />
                      About Your Brand
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-maroon-700 mb-2">
                        Tell us about your brand, what kinds of products or services you want to sell or promote.
                      </label>
                      <textarea
                        value={organizationAboutBrand || ''}
                        onChange={(e) => setOrganizationAboutBrand(e.target.value)}
                        placeholder="Describe your brand, products, or services..."
                        className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                        rows={4}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This information will be pre-filled when you inquire about properties.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Provider Settings */}
              {env.STRIPE_ENABLED && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center text-maroon-800">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Payment Provider
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-maroon-700 mb-2">
                      Select your payment processor
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentProvider"
                          value="stripe"
                          checked={paymentProvider === 'stripe'}
                          onChange={(e) => setPaymentProvider(e.target.value as 'stripe' | 'authorizenet')}
                          className="mr-2"
                        />
                        <span className="text-maroon-600">Stripe</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="paymentProvider"
                          value="authorizenet"
                          checked={paymentProvider === 'authorizenet'}
                          onChange={(e) => setPaymentProvider(e.target.value as 'stripe' | 'authorizenet')}
                          className="mr-2"
                        />
                        <span className="text-maroon-600">Authorize.net</span>
                      </label>
                    </div>
                  </div>

                  {paymentProvider === 'authorizenet' && (
                    <div className="space-y-4 p-4 border-2 border-maroon-200 rounded-xl">
                      <h4 className="font-medium text-maroon-800">Authorize.net Settings</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-maroon-700 mb-1">
                          API Login ID
                        </label>
                        <Input
                          type="text"
                          value={authorizeNetSettings.apiLoginId}
                          onChange={(e) => setAuthorizeNetSettings(prev => ({ ...prev, apiLoginId: e.target.value }))}
                          placeholder="Your Authorize.net API Login ID"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-maroon-700 mb-1">
                          Transaction Key
                        </label>
                        <Input
                          type="password"
                          value={authorizeNetSettings.transactionKey}
                          onChange={(e) => setAuthorizeNetSettings(prev => ({ ...prev, transactionKey: e.target.value }))}
                          placeholder="Your Authorize.net Transaction Key"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={authorizeNetSettings.sandboxMode}
                            onChange={(e) => setAuthorizeNetSettings(prev => ({ ...prev, sandboxMode: e.target.checked }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-maroon-600">Use Sandbox Mode</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Enable this for testing with Authorize.net sandbox environment
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Changing your payment provider will affect how customers pay for bookings on your properties.
                    </p>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Payout Details (venues) */}
              {env.STRIPE_ENABLED && organizationBusinessType === 'venue' && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center text-maroon-800">
                      <CreditCard className="h-5 w-5 mr-2" />
                      Payout Details ({paymentProvider === 'stripe' ? 'Stripe Connect' : 'Authorize.net'})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {paymentProvider === 'stripe' ? (
                      <>
                        {!organizationStripe.stripe_account_id ? (
                          <>
                            <p className="text-maroon-600">
                              Connect your Stripe account to receive payouts for your property bookings.
                            </p>
                            <Button
                              type="button"
                              onClick={() => handleStripeConnect('account_onboarding')}
                              isLoading={saving}
                              disabled={saving}
                            >
                              <ExternalLink className="h-5 w-5 mr-2" />
                              Connect Stripe Account
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center space-x-2">
                              {organizationStripe.charges_enabled && organizationStripe.payouts_enabled ? (
                                <CheckCircle className="h-6 w-6 text-green-500" />
                              ) : (
                                <XCircle className="h-6 w-6 text-red-500" />
                              )}
                              <p className="text-maroon-600">
                                Stripe Account Status: {' '}
                                <span className="font-semibold">
                                  {organizationStripe.charges_enabled && organizationStripe.payouts_enabled
                                    ? 'Ready for Payouts'
                                    : 'Onboarding Required'}
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                              <Button
                                type="button"
                                onClick={() => handleStripeConnect('account_onboarding')}
                                isLoading={saving}
                                disabled={saving}
                                variant={organizationStripe.charges_enabled && organizationStripe.payouts_enabled ? "outline" : "primary"}
                              >
                                <ExternalLink className="h-5 w-5 mr-2" />
                                Continue Onboarding
                              </Button>
                              <Button
                                type="button"
                                onClick={handleRefreshStripeStatus}
                                isLoading={saving}
                                disabled={saving}
                                variant="ghost"
                              >
                                <RefreshCw className="h-5 w-5 mr-2" />
                                Refresh Status
                              </Button>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {authorizeNetSettings.apiLoginId && authorizeNetSettings.transactionKey ? (
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            <p className="text-maroon-600">
                              Authorize.net Account: {' '}
                              <span className="font-semibold">
                                {authorizeNetSettings.sandboxMode ? 'Sandbox Mode' : 'Live Mode'}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-maroon-600">
                            Configure your Authorize.net credentials above to enable payments.
                          </p>
                        )}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                          <p className="text-sm text-yellow-700">
                            <strong>Important:</strong> Make sure your Authorize.net account is properly configured to handle online payments and has the appropriate payment methods enabled.
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Members */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-maroon-800">
                    <div className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Members
                    </div>
                    {profile.primary_organization_id && (
                      <div className="flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddMember}
                          disabled={addingMember || !newMemberEmail.trim()}
                          className="flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {addingMember ? 'Adding...' : 'Invite Member'}
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.primary_organization_id ? (
                    <div className="space-y-6">
                      {/* Add Member Form */}
                      <div className="border rounded-lg p-4 bg-blue-50">
                        <h4 className="font-medium text-maroon-800 mb-3">Invite New Member</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            placeholder="Enter email address"
                            className="flex-1"
                          />
                          <select
                            value={newMemberRole}
                            onChange={(e) => setNewMemberRole(e.target.value as 'owner' | 'admin' | 'member')}
                            className="px-3 py-2 border border-gray-300 rounded-md min-w-[120px]"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                          <Button
                            type="button"
                            onClick={handleAddMember}
                            disabled={addingMember || !newMemberEmail.trim()}
                            isLoading={addingMember}
                          >
                            Invite
                          </Button>
                        </div>
                        {memberError && (
                          <p className="text-red-600 text-sm mt-2">{memberError}</p>
                        )}
                      </div>

                      {/* Current Members */}
                      {orgMembers.length > 0 && (
                        <div>
                          <h4 className="font-medium text-maroon-800 mb-3">Current Members</h4>
                          <div className="space-y-2">
                            {orgMembers.map((m, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-maroon-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {(m.full_name || m.email || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-maroon-800 font-medium">
                                      {m.full_name || '(No name)'}
                                    </div>
                                    <div className="text-maroon-600 text-sm">{m.email}</div>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  m.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                                  m.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {m.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pending Invites */}
                      {orgInvites.length > 0 && (
                        <div>
                          <h4 className="font-medium text-maroon-800 mb-3">Pending Invites</h4>
                          <div className="space-y-2">
                            {orgInvites.map((invite) => (
                              <div key={invite.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <Mail className="h-4 w-4 text-white" />
                                  </div>
                                  <div>
                                    <div className="text-maroon-800 font-medium">{invite.email}</div>
                                    <div className="text-maroon-600 text-sm">
                                      Invited {new Date(invite.created_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                    {invite.role}
                                  </span>
                                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                    Pending
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty State */}
                      {orgMembers.length === 0 && orgInvites.length === 0 && (
                        <div className="text-center py-8">
                          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-sm text-maroon-600 mb-4">No other members in this organization yet.</p>
                          <p className="text-xs text-gray-500">Use the invite form above to add your first member.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-maroon-600">You are not linked to an organization yet.</p>
                  )}
                </CardContent>
              </Card>

              {/* Organization Adjustments */}
              {organizationBusinessType === 'venue' && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-maroon-800">
                      <div className="flex items-center">
                        <Percent className="h-5 w-5 mr-2" />
                        Discounts & Adjustments
                      </div>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddMenuOpen(!addMenuOpen)}
                          className="flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                        {addMenuOpen && (
                          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-10">
                            <div className="p-2">
                              <button
                                onClick={() => addAdjustment('user_selected_discount')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                User Selected Discount
                              </button>
                              <button
                                onClick={() => addAdjustment('capacity_surcharge')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                Capacity Surcharge
                              </button>
                              <button
                                onClick={() => addAdjustment('off_hours_adjustment')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                Off Hours Adjustment
                              </button>
                              <button
                                onClick={() => addAdjustment('off_days_adjustment')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                Off Days Adjustment
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orgAdjustments.length > 0 ? (
                      <div className="space-y-4">
                        {orgAdjustments.map((adj) => (
                          <div key={adj.id} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-maroon-800">
                                {adj.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAdjustment(adj.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <Input
                                  value={adj.name}
                                  onChange={(e) => updateAdjustment(adj.id, { name: e.target.value })}
                                  placeholder="Enter name"
                                  className="w-full"
                                />
                              </div>

                              {/* User Selected Discount Fields */}
                              {adj.type === 'user_selected_discount' && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                                      <select
                                        value={(adj as UserSelectedDiscount).rateType}
                                        onChange={(e) => updateAdjustment(adj.id, { rateType: e.target.value as 'percentage' | 'fixed' })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {(adj as UserSelectedDiscount).rateType === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
                                      </label>
                                      <Input
                                        type="number"
                                        value={(adj as UserSelectedDiscount).rateType === 'percentage' 
                                          ? (adj as UserSelectedDiscount).discountPercent || '' 
                                          : (adj as UserSelectedDiscount).discountAmount || ''}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          updateAdjustment(adj.id, (adj as UserSelectedDiscount).rateType === 'percentage' 
                                            ? { discountPercent: value } 
                                            : { discountAmount: value });
                                        }}
                                        placeholder={(adj as UserSelectedDiscount).rateType === 'percentage' ? 'e.g. 30' : 'e.g. 50'}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Required Documentation</label>
                                    <textarea
                                      value={(adj as UserSelectedDiscount).requiredDocumentation || ''}
                                      onChange={(e) => updateAdjustment(adj.id, { requiredDocumentation: e.target.value })}
                                      placeholder="Enter required documentation"
                                      className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[80px] resize-y"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Capacity Surcharge Fields */}
                              {adj.type === 'capacity_surcharge' && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">For every (headcount)</label>
                                      <Input
                                        type="number"
                                        value={(adj as CapacitySurcharge).perHeadcount || ''}
                                        onChange={(e) => updateAdjustment(adj.id, { perHeadcount: parseInt(e.target.value) || 0 })}
                                        placeholder="25"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Add... (surcharge)</label>
                                      <Input
                                        type="number"
                                        value={(adj as CapacitySurcharge).surchargeAmount || ''}
                                        onChange={(e) => updateAdjustment(adj.id, { surchargeAmount: parseFloat(e.target.value) || 0 })}
                                        placeholder="25"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                                      <select
                                        value={(adj as CapacitySurcharge).per}
                                        onChange={(e) => updateAdjustment(adj.id, { per: e.target.value as PerUnit })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="per_hour">Per hour</option>
                                        <option value="per_day">Per day</option>
                                        <option value="per_week">Per week</option>
                                        <option value="per_month">Per month</option>
                                        <option value="per_booking">Per booking</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Off Hours Adjustment Fields */}
                              {adj.type === 'off_hours_adjustment' && (
                                <div className="space-y-4">
                                  <div className="flex items-center space-x-2">
                                    <span>Outside of</span>
                                    <Input 
                                      type="time" 
                                      value={(adj as OffHoursAdjustment).outsideStart || '07:00'}
                                      onChange={(e) => updateAdjustment(adj.id, { outsideStart: e.target.value })}
                                      className="w-32"
                                    />
                                    <span>to</span>
                                    <Input 
                                      type="time" 
                                      value={(adj as OffHoursAdjustment).outsideEnd || '20:00'}
                                      onChange={(e) => updateAdjustment(adj.id, { outsideEnd: e.target.value })}
                                      className="w-32"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                                      <select
                                        value={(adj as OffHoursAdjustment).adjustment}
                                        onChange={(e) => updateAdjustment(adj.id, { adjustment: e.target.value as 'surcharge' | 'discount' })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="surcharge">Surcharge</option>
                                        <option value="discount">Discount</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {(adj as OffHoursAdjustment).rateType === 'percentage' ? 'Rate (%)' : 'Amount ($)'}
                                      </label>
                                      <Input
                                        type="number"
                                        value={(adj as OffHoursAdjustment).rateType === 'percentage' 
                                          ? (adj as OffHoursAdjustment).ratePercent || '' 
                                          : (adj as OffHoursAdjustment).rateAmount || ''}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          updateAdjustment(adj.id, (adj as OffHoursAdjustment).rateType === 'percentage' 
                                            ? { ratePercent: value } 
                                            : { rateAmount: value });
                                        }}
                                        placeholder={(adj as OffHoursAdjustment).rateType === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Off Days Adjustment Fields */}
                              {adj.type === 'off_days_adjustment' && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                                      <select
                                        value={(adj as OffDaysAdjustment).days}
                                        onChange={(e) => updateAdjustment(adj.id, { days: e.target.value as DayPreset })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="weekends">Weekends (Sat-Sun)</option>
                                        <option value="weekdays">Weekdays (Mon-Fri)</option>
                                        <option value="fri_sun">Friday + Weekend (Fri-Sun)</option>
                                        <option value="fri_sat">Friday & Saturday (Fri-Sat)</option>
                                        <option value="mon_thu">Monday to Thursday (Mon-Thu)</option>
                                        <option value="mon_wed">Monday to Wednesday (Mon-Wed)</option>
                                        <option value="tue_thu">Tuesday to Thursday (Tue-Thu)</option>
                                        <option value="mondays">Mondays</option>
                                        <option value="tuesdays">Tuesdays</option>
                                        <option value="wednesdays">Wednesdays</option>
                                        <option value="thursdays">Thursdays</option>
                                        <option value="fridays">Fridays</option>
                                        <option value="saturdays">Saturdays</option>
                                        <option value="sundays">Sundays</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                                      <select
                                        value={(adj as OffDaysAdjustment).adjustment}
                                        onChange={(e) => updateAdjustment(adj.id, { adjustment: e.target.value as 'surcharge' | 'discount' })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="surcharge">Surcharge</option>
                                        <option value="discount">Discount</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                                      <select
                                        value={(adj as OffDaysAdjustment).rateType}
                                        onChange={(e) => updateAdjustment(adj.id, { rateType: e.target.value as 'percentage' | 'fixed' })}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                      >
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {(adj as OffDaysAdjustment).rateType === 'percentage' ? 'Rate (%)' : 'Amount ($)'}
                                      </label>
                                      <Input
                                        type="number"
                                        value={(adj as OffDaysAdjustment).rateType === 'percentage' 
                                          ? (adj as OffDaysAdjustment).ratePercent || '' 
                                          : (adj as OffDaysAdjustment).rateAmount || ''}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          updateAdjustment(adj.id, (adj as OffDaysAdjustment).rateType === 'percentage' 
                                            ? { ratePercent: value } 
                                            : { rateAmount: value });
                                        }}
                                        placeholder={(adj as OffDaysAdjustment).rateType === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Explanatory Text for All Types */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Explanatory Text (Optional)</label>
                                <textarea
                                  value={adj.explanatoryText || ''}
                                  onChange={(e) => updateAdjustment(adj.id, { explanatoryText: e.target.value })}
                                  placeholder="Add any explanatory text about this adjustment"
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[80px] resize-y"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-maroon-600 mb-2">No discounts or adjustments configured</p>
                        <p className="text-xs text-gray-500">Click the "Add" button to create your first adjustment</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              type="submit"
              className="bg-[#d85151] hover:bg-[#c14848] active:bg-[#a93e3e] text-white"
              isLoading={saving}
              disabled={saving}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {showSuccessToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-maroon-800">
                Change Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  isPasswordModalOpenRef.current = false;
                  setPasswordError(null);
                  setPasswordSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            {passwordError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                {passwordError}
              </div>
            )}
            
            {passwordSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                {passwordSuccess}
              </div>
            )}
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-maroon-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-maroon-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPassword}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={changingPassword}
                  disabled={changingPassword}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-maroon-800">
                Change Email
              </h3>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailError(null);
                  setEmailSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            {emailError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                {emailError}
              </div>
            )}
            
            {emailSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl">
                {emailSuccess}
              </div>
            )}
            
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-maroon-700 mb-1">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={emailData.newEmail}
                  onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
                  required
                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-maroon-700 mb-1">
                  Confirm Email Address
                </label>
                <input
                  type="email"
                  value={emailData.confirmEmail}
                  onChange={(e) => setEmailData({ ...emailData, confirmEmail: e.target.value })}
                  required
                  className="w-full rounded-xl border-2 border-maroon-200 p-2 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEmailModal(false)}
                  disabled={changingEmail}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={changingEmail}
                  disabled={changingEmail}
                >
                  Update Email
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;