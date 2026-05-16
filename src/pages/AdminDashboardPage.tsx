import React, { useState, useEffect } from 'react';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, CheckCircle, XCircle, RefreshCw, Shield, FileText, Settings, User as UserIcon, PlusCircle, Edit, Trash2, Calendar, Link as LinkIcon, Search, Info as InfoIcon, Mail, UserCheck, UserX } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { setCachedSetting } from '../lib/settings';
import { User, Page } from '../types';
import AdminFAQManager from '../components/faq/AdminFAQManager';

const AdminDashboardPage: React.FC = () => {
  usePageHeaderTitle('Admin Dashboard');
  const navigate = useNavigate();
  const {
    sessionUser,
    impersonatedUser,
    isImpersonating,
    startImpersonation,
    stopImpersonation,
    refreshSession,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'content' | 'faq' | 'settings' | 'orgs'>('content');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    senderEmail: 'support@artportfolio.com',
  });
  const [authSettings, setAuthSettings] = useState({
    requireEmailConfirmation: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Org Management state
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [orgMembers, setOrgMembers] = useState<Array<{ user_id: string; role: string; full_name?: string | null; email?: string | null }>>([]);
  const [orgInvites, setOrgInvites] = useState<Array<{ id: string; email: string; role: string; created_at: string }>>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [, setOrgSuccess] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  // Legacy org deletion controls removed

  useEffect(() => {
    if (!sessionUser) {
      navigate('/signin');
      return;
    }

    // Redirect if not an admin
    if (!sessionUser.is_admin) {
      navigate('/dashboard');
      return;
    }
    
    loadUsers();
    loadPages();
    loadSettings();
    loadOrganizations();
  }, [sessionUser, navigate]);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setOrgs((data || []) as Array<{ id: string; name: string }>);
      if ((data || []).length > 0 && !selectedOrgId) {
        setSelectedOrgId((data as any)[0].id);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to load organizations');
    }
  };

  const loadOrgInvites = async (organizationId: string) => {
    if (!organizationId) {
      setOrgInvites([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('organization_member_invites')
        .select('id, email, role, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrgInvites((data || []) as any);
    } catch (err) {
      console.error('Error loading org invites:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to load invites');
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    setOrgError(null);
    try {
      const { error } = await supabase
        .from('organization_member_invites')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
      await loadOrgInvites(selectedOrgId);
      setOrgSuccess('Invite removed');
    } catch (err) {
      console.error('Error removing invite:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to remove invite');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setUpdatingMemberId(userId);
    setOrgError(null);
    try {
      const { error } = await (supabase as any)
        .from('organization_members')
        .delete()
        .eq('organization_id', selectedOrgId)
        .eq('user_id', userId);
      if (error) throw error;
      await loadOrgMembers(selectedOrgId);
      setOrgSuccess('Member removed');
    } catch (err) {
      console.error('Error removing member:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'owner' | 'admin' | 'member') => {
    setUpdatingMemberId(userId);
    setOrgError(null);
    try {
      const { error } = await (supabase as any)
        .from('organization_members')
        .update({ role: newRole })
        .eq('organization_id', selectedOrgId)
        .eq('user_id', userId);
      if (error) throw error;
      await loadOrgMembers(selectedOrgId);
      setOrgSuccess('Role updated');
    } catch (err) {
      console.error('Error changing role:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConvertInvite = async (email: string) => {
    setOrgError(null);
    setOrgSuccess(null);
    try {
      const { error } = await (supabase as any).rpc('promote_invites_for_email', { p_email: email });
      if (error) throw error;
      await loadOrgMembers(selectedOrgId);
      await loadOrgInvites(selectedOrgId);
      setOrgSuccess('Invite converted to member (if matching profile exists)');
    } catch (err) {
      console.error('Error converting invite:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to convert invite');
    }
  };

  useEffect(() => {
    if (selectedOrgId) {
      void loadOrgMembers(selectedOrgId);
      void loadOrgInvites(selectedOrgId);
    } else {
      setOrgMembers([]);
      setOrgInvites([]);
    }
  }, [selectedOrgId]);

  const loadOrgMembers = async (organizationId: string) => {
    if (!organizationId) {
      setOrgMembers([]);
      setOrgInvites([]);
      return;
    }
    setOrgLoading(true);
    setOrgError(null);
    try {
      // First get member rows
      const { data: members, error: memErr } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId);
      if (memErr) throw memErr;
      const memberList = (members || []) as Array<{ user_id: string; role: string }>;

      if (memberList.length === 0) {
        setOrgMembers([]);
        return;
      }

      // Fetch profiles for these users
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (profErr) throw profErr;
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const merged = memberList.map(m => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
      }));
      setOrgMembers(merged);
    } catch (err) {
      console.error('Error loading org members:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to load organization members');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      setOrgError('Please select an organization first');
      return;
    }
    setAddingMember(true);
    setOrgError(null);
    try {
      // Call the Edge Function
      const { error } = await (supabase as any).functions.invoke('add-org-member', {
        body: {
          organization_id: selectedOrgId,
          email: newMemberEmail,
          role: newMemberRole,
        },
      });
      if (error) throw error;
      // Refresh list
      await loadOrgMembers(selectedOrgId);
      setNewMemberEmail('');
      setNewMemberRole('member');
      setOrgSuccess('Invite or member added successfully');
    } catch (err) {
      console.error('Error adding org member:', err);
      setOrgError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as User[]);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Function to load pages
  const loadPages = async () => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setPages(data as Page[]);
    } catch (err) {
      console.error('Error loading pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setUpdatingUser(userId);
    setError(null);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ is_admin: !currentIsAdmin, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      
      // Reload users to reflect change
      await loadUsers();
      
      // If the session user's admin status was changed, refresh their session
      if (userId === sessionUser?.id) {
        await refreshSession();
        // Reload page to reflect admin status change
        window.location.reload(); 
      }
    } catch (err) {
      console.error('Error toggling admin status:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle admin status');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);
    
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserFullName,
          }
        }
      });

      if (authError || !authData.user) {
        throw authError || new Error('Failed to create user in auth');
      }

      // Create profile entry for the new user
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: newUserEmail,
          full_name: newUserFullName,
          is_admin: newUserIsAdmin,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        throw profileError;
      }

      // Reset form
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserIsAdmin(false);
      
      // Reload users to show the new user
      await loadUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  // Function to load system settings
  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['email_sender', 'auth_email_confirm_enabled']);

      if (error) throw error;
      
      // Process settings
      const settings = (data as { key: string; value: string }[]) || [];
      const emailSender = settings.find(s => s.key === 'email_sender')?.value || 'support@artportfolio.com';
      const authConfirm = settings.find(s => s.key === 'auth_email_confirm_enabled')?.value;
      const toBool = (v?: string) => {
        const t = (v ?? '').toLowerCase();
        return t === 'true' || t === '1' || t === 'yes' || t === 'on';
      };
      
      setEmailSettings({
        senderEmail: emailSender,
      });
      setAuthSettings({
        requireEmailConfirmation: toBool(authConfirm ?? 'true'),
      });
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    }
  };

  // Function to save email settings
  const handleSaveEmailSettings = async () => {
    setSavingSettings(true);
    setError(null);
    setSettingsSuccess(null);
    
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailSettings.senderEmail)) {
        throw new Error('Please enter a valid email address');
      }
      
      // Update email sender setting
      const { error } = await (supabase as any)
        .from('system_settings')
        .upsert([
          {
            key: 'email_sender',
            value: emailSettings.senderEmail,
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'key' });

      if (error) throw error;
      
      setSettingsSuccess('Email settings saved successfully');
      
      // Clear success message after a delay
      setTimeout(() => {
        setSettingsSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error saving email settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save email settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveAuthSettings = async () => {
    setSavingSettings(true);
    setError(null);
    setSettingsSuccess(null);
    try {
      const newValue = authSettings.requireEmailConfirmation ? 'true' : 'false';
      const { error } = await (supabase as any)
        .from('system_settings')
        .upsert([
          {
            key: 'auth_email_confirm_enabled',
            value: newValue,
            updated_at: new Date().toISOString(),
          }
        ], { onConflict: 'key' });
      if (error) throw error;
      // Update runtime cache so UI reflects immediately
      setCachedSetting('auth_email_confirm_enabled', newValue);
      setSettingsSuccess('Authentication settings saved successfully');
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving auth settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save authentication settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    await loadPages();
    await loadSettings();
    setRefreshing(false);
  };

  // Function to create a new page
  const handleCreatePage = () => {
    navigate('/admin/pages/new');
  };

  // Function to edit a page
  const handleEditPage = (pageId: string) => {
    navigate(`/admin/pages/${pageId}`);
  };

  // Function to delete a page
  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      
      // Reload pages to reflect the deletion
      await loadPages();
    } catch (err) {
      console.error('Error deleting page:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete page');
    }
  };

  // Filter pages based on search term
  const filteredPages = pages.filter(page => 
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    page.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (!sessionUser?.is_admin) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-maroon-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-maroon-800 mb-2">Access Denied</h2>
          <p className="text-maroon-600 mb-4">You do not have administrative privileges to view this page.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8]">
      {isImpersonating && impersonatedUser && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between text-amber-900">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Impersonation Mode</p>
              <p>You are viewing Art Portfolio as <span className="font-medium">{impersonatedUser.email}</span>.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 sm:mt-0 border-amber-400 text-amber-900 hover:bg-amber-200"
            onClick={stopImpersonation}
          >
            <UserX className="h-4 w-4 mr-1" /> Exit Impersonation
          </Button>
        </div>
      )}
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl md:max-w-6xl lg:max-w-7xl">
          <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-maroon-600 mr-3" />
            <h1 className="text-4xl font-bold text-maroon-800 font-display">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              isLoading={refreshing}
              disabled={refreshing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

          {(error || orgError) && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
              {orgError || error}
            </div>
          )}
        {/* Tab Navigation (top, single row including System Settings) */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200 flex-wrap">
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none ${
                activeTab === 'users' ? 'border-b-2 border-maroon-600 text-maroon-800' : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('users')}
            >
              <div className="flex items-center">
                <UserIcon className="h-4 w-4 mr-2" />
                User Management
              </div>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none ${
                activeTab === 'content' ? 'border-b-2 border-maroon-600 text-maroon-800' : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('content')}
            >
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Content Management
              </div>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none ${
                activeTab === 'faq' ? 'border-b-2 border-maroon-600 text-maroon-800' : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('faq')}
            >
              <div className="flex items-center">
                <InfoIcon className="h-4 w-4 mr-2" />
                FAQ
              </div>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none ${
                activeTab === 'orgs' ? 'border-b-2 border-maroon-600 text-maroon-800' : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('orgs')}
            >
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Org Management
              </div>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none ${
                activeTab === 'settings' ? 'border-b-2 border-maroon-600 text-maroon-800' : 'text-gray-500 hover:text-maroon-600'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              <div className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </div>
            </button>
          </div>
        </div>

          {/* Org Management Tab */}
          {activeTab === 'orgs' && (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <Users className="h-5 w-5 mr-2" />
                  Organization Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-end md:space-x-4 gap-3 mb-6">
                  <div className="flex-1">
                    <label className="block text-sm text-maroon-700 mb-1">Select Organization</label>
                    <select
                      className="w-full border-2 border-maroon-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                    >
                      <option value="" disabled>Select an organization…</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <form onSubmit={handleAddMember} className="space-y-3 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm text-maroon-700 mb-1">New Member Email</label>
                      <input
                        type="email"
                        required
                        className="w-full border-2 border-maroon-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="member@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-maroon-700 mb-1">Role</label>
                      <select
                        className="w-full border-2 border-maroon-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value as any)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" isLoading={addingMember} disabled={addingMember || !selectedOrgId || !newMemberEmail}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add Member
                  </Button>
                </form>

                <div className="overflow-hidden rounded-xl border border-maroon-200">
                  <table className="min-w-full divide-y divide-maroon-200">
                    <thead className="bg-maroon-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-maroon-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-maroon-100">
                      {orgLoading ? (
                        <tr><td className="px-6 py-4 text-sm text-maroon-600" colSpan={4}>Loading members…</td></tr>
                      ) : orgMembers.length === 0 ? (
                        <tr><td className="px-6 py-4 text-sm text-maroon-600" colSpan={4}>No members yet</td></tr>
                      ) : (
                        orgMembers.map(m => (
                          <tr key={m.user_id} className="hover:bg-maroon-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-maroon-800">{m.full_name || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-600">{m.email || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-600">
                              <select
                                className="border border-maroon-200 rounded px-2 py-1 text-sm"
                                value={m.role}
                                onChange={(e) => handleChangeRole(m.user_id, e.target.value as any)}
                                disabled={updatingMemberId === m.user_id}
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-maroon-600">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRemoveMember(m.user_id)}
                                disabled={updatingMemberId === m.user_id}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Invites */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-maroon-800 mb-3">Pending Invites</h3>
                  <div className="overflow-hidden rounded-xl border border-maroon-200">
                    <table className="min-w-full divide-y divide-maroon-200">
                      <thead className="bg-maroon-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Invited</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-maroon-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-maroon-100">
                        {orgInvites.length === 0 ? (
                          <tr><td className="px-6 py-4 text-sm text-maroon-600" colSpan={4}>No pending invites</td></tr>
                        ) : (
                          orgInvites.map(inv => (
                            <tr key={inv.id} className="hover:bg-maroon-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-800">{inv.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-600">{inv.role}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-600">{new Date(inv.created_at).toLocaleString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-maroon-600 space-x-2">
                                <Button variant="outline" size="sm" onClick={() => handleConvertInvite(inv.email)}>Convert now</Button>
                                <Button variant="outline" size="sm" onClick={() => handleRemoveInvite(inv.id)}>Remove Invite</Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Old duplicate tab bar removed */}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
            {/* Create New User Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create New User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <Input
                    label="Full Name"
                    type="text"
                    required
                    value={newUserFullName}
                    onChange={(e) => setNewUserFullName(e.target.value)}
                  />
                  <Input
                    label="Email"
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                  <Input
                    label="Password"
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    minLength={6}
                  />
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newUserIsAdmin}
                      onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                      className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                    />
                    <span className="text-sm text-maroon-700">Grant Admin Privileges</span>
                  </label>
                  <Button type="submit" isLoading={creatingUser} disabled={creatingUser}>
                    Create User
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* User List Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <Users className="h-5 w-5 mr-2" />
                  All Users ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <p className="font-medium text-maroon-800">{user.full_name}</p>
                        <p className="text-sm text-maroon-600">{user.email}</p>
                        <div className="flex items-center mt-1">
                          <p className="text-xs text-gray-500">
                            Last message: {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {user.is_admin ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1" /> Admin
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center">
                            <XCircle className="h-3 w-3 mr-1" /> User
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleAdmin(user.id, !!user.is_admin)}
                          isLoading={updatingUser === user.id}
                          disabled={updatingUser !== null}
                        >
                          {user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                        </Button>
                        <Button
                          variant={impersonatedUser?.id === user.id ? 'danger' : 'outline'}
                          size="sm"
                          onClick={() => {
                            if (impersonatedUser?.id === user.id) {
                              stopImpersonation();
                            } else {
                              startImpersonation(user);
                            }
                          }}
                          disabled={updatingUser !== null}
                        >
                          {impersonatedUser?.id === user.id ? (
                            <span className="flex items-center">
                              <UserX className="h-3.5 w-3.5 mr-1" /> Stop Impersonating
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <UserCheck className="h-3.5 w-3.5 mr-1" /> Impersonate
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {users.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-maroon-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-maroon-800 mb-2">
                        No Users Found
                      </h3>
                      <p className="text-maroon-600">
                        Create a new user using the form above
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <InfoIcon className="h-5 w-5 mr-2" />
                  FAQ Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminFAQManager />
              </CardContent>
            </Card>
          </div>
        )}
        
          {/* Content Management Tab */}
          {activeTab === 'content' && (
            <div className="space-y-6">
            {/* Static Pages Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <FileText className="h-5 w-5 mr-2" />
                  Static Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-6">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search pages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border-2 border-maroon-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                    />
                  </div>
                  <Button onClick={handleCreatePage}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Page
                  </Button>
                </div>
                
                {filteredPages.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-maroon-200">
                    <table className="min-w-full divide-y divide-maroon-200">
                      <thead className="bg-maroon-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Title</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Slug</th>
                         <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Type</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-maroon-700 uppercase tracking-wider">Last Updated</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-maroon-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-maroon-100">
                        {filteredPages.map((page) => (
                          <tr key={page.id} className="hover:bg-maroon-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-maroon-800">
                              <div className="max-w-xs truncate" title={page.title}>
                                {page.title}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-maroon-600">
                              <div className="flex items-center gap-1 min-w-0">
                                <LinkIcon className="h-3 w-3 text-maroon-400 flex-shrink-0" />
                                <span className="truncate" title={`/${page.slug}`}>
                                  /{page.slug}
                                </span>
                              </div>
                            </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-600">
                             <span className="px-2 py-1 bg-maroon-100 text-maroon-700 rounded-full text-xs">
                               {page.type || 'Information'}
                             </span>
                           </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-maroon-500">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {new Date(page.updated_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditPage(page.id)}
                                  title="Edit page"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDeletePage(page.id)}
                                  title="Delete page"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-maroon-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-maroon-800 mb-2">
                      {searchTerm ? 'No pages match your search' : 'No Pages Found'}
                    </h3>
                    <p className="text-maroon-600 max-w-md mx-auto mb-6">
                      {searchTerm 
                        ? `Try a different search term or clear your search.`
                        : `Create your first static page to manage content like "About Us", "Help Center", etc. Pages will be accessible at yourdomain.com/page-slug.`}
                    </p>
                    {!searchTerm && (
                      <Button onClick={handleCreatePage}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Page
                      </Button>
                    )}
                  </div>
                )}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
                  <p className="text-blue-700 font-medium mb-1">
                    <InfoIcon className="h-4 w-4 inline mr-1" />
                    Page URL Information
                  </p>
                  <p className="text-blue-600">
                    Static pages are accessible directly at the root URL: <code className="bg-blue-100 px-1 py-0.5 rounded">yourdomain.com/page-slug</code>
                  </p>
                  <p className="text-blue-600 mt-1">
                    Some slugs are reserved for application routes. See the page editor for details.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
            {/* Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {settingsSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-start">
                    <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <p>{settingsSuccess}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Sender Email Address"
                      type="email"
                      value={emailSettings.senderEmail}
                      onChange={(e) => setEmailSettings({ ...emailSettings, senderEmail: e.target.value })}
                      icon={<Mail className="h-5 w-5" />}
                      required
                    />
                    <p className="text-sm text-maroon-500 mt-1">
                      This email address will be used as the sender for all system emails. Make sure it's verified in your Brevo account.
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <Button
                      onClick={handleSaveEmailSettings}
                      isLoading={savingSettings}
                      disabled={savingSettings}
                    >
                      Save Email Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Authentication Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-maroon-800">
                  <Shield className="h-5 w-5 mr-2" />
                  Authentication Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={authSettings.requireEmailConfirmation}
                      onChange={(e) => setAuthSettings({ ...authSettings, requireEmailConfirmation: e.target.checked })}
                      className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                    />
                    <span className="text-sm text-maroon-700">Require email confirmation for new signups</span>
                  </label>
                  <p className="text-sm text-maroon-500">
                    When disabled, users won't see the signup confirmation page and can proceed immediately after signup.
                  </p>
                  <div className="pt-2">
                    <Button onClick={handleSaveAuthSettings} isLoading={savingSettings} disabled={savingSettings}>
                      Save Authentication Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;