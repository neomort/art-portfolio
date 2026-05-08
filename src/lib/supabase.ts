import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { env } from './env';

// Safely read from Node/Jest env without crashing in the browser
const nodeEnv: any = (globalThis as any)?.process?.env;

// Use centralized env helper for Vite/Node compatibility (and Jest parsing safety)
const supabaseUrlRaw: string | undefined = env.VITE_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL;
const supabaseAnonKeyRaw: string | undefined = env.VITE_SUPABASE_ANON_KEY ?? nodeEnv?.VITE_SUPABASE_ANON_KEY;
const isTest = typeof nodeEnv?.JEST_WORKER_ID !== 'undefined';

// In Jest, provide safe dummy values to avoid throwing during import
const supabaseUrl: string | undefined = (supabaseUrlRaw || (isTest ? 'https://example.supabase.co' : undefined));
const supabaseAnonKey: string | undefined = (supabaseAnonKeyRaw || (isTest ? 'test_anon_key' : undefined));

// Log environment variables for debugging (without exposing sensitive data)
const isDev = nodeEnv?.NODE_ENV !== 'production' || typeof nodeEnv?.JEST_WORKER_ID !== 'undefined';

// Auth debug: opt-in only (quiet by default to avoid console spam)
let authDebug = false;
try {
  // Enable via env or localStorage key 'debugAuth' (set to '1')
  authDebug = Boolean((env as any)?.VITE_SUPABASE_AUTH_DEBUG === '1');
  if (!authDebug && typeof window !== 'undefined') {
    authDebug = localStorage.getItem('debugAuth') === '1';
  }
} catch {}

if (authDebug) console.log('Supabase configuration:', {
  url: supabaseUrl,
  keyPresent: !!supabaseAnonKey,
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  urlValid: supabaseUrl ? supabaseUrl.startsWith('https://') : false,
  environment: nodeEnv?.NODE_ENV || 'unknown'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables:', {
    supabaseUrl,
    supabaseAnonKey: supabaseAnonKey ? '[REDACTED]' : undefined
  });
  throw new Error(`Missing Supabase environment variables. Please check your .env file and restart the dev server. 
    URL: ${supabaseUrl ? 'present' : 'missing'}, 
    Key: ${supabaseAnonKey ? 'present' : 'missing'}
    
    To fix this:
    1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
    2. Select your project
    3. Go to Settings > API
    4. Copy the Project URL and anon/public key
    5. Update your .env file with the correct values
    6. Restart your development server`);
}

// Validate URL format (skip during Jest)
if (!isTest) {
  try {
    new URL(supabaseUrl!);
  } catch (error) {
    console.error('Invalid Supabase URL:', supabaseUrl);
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}. 
      Please check your .env file and restart the dev server.
      
      The URL should look like: https://your-project-id.supabase.co`);
  }
}

const supabaseOptions = {
  auth: { 
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce' as const,
    // Disable noisy GoTrue debug logs unless explicitly enabled
    debug: authDebug,
    storageKey: 'sb-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': 'splitspace-web/1.0.0',
    },
  },
  db: {
    schema: 'public' as const,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
};

export const supabase = createClient<Database>(
  supabaseUrl!,
  supabaseAnonKey!,
  supabaseOptions
);

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, primary_organization_id, phone, avatar_url, is_admin, created_at, updated_at, brevo_opt_in, brevo_opt_in_ts')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}

export async function createProfile(userId: string, data: {
  email: string;
  full_name: string;
  is_admin?: boolean;
}) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      is_admin: data.is_admin || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data: profile, error };
}

export async function signUp(email: string, password: string, fullName: string, _companyName?: string) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/signin`,
      data: {
        full_name: fullName
      }
    }
  });
  
  if (authError || !authData.user) {
    return { data: null, error: authError };
  }
  
  // Only create profile if user is confirmed (not pending email confirmation)
  if (authData.user.email_confirmed_at) {
    const { error: profileError } = await createProfile(
      authData.user.id,
      {
        email: authData.user.email!,
        full_name: fullName,
      });
    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail the signup if profile creation fails - it can be retried later
    }
  }

  return { data: { user: authData.user }, error: null };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { data: null, error };
  }

  const { data: profile, error: profileError } = await fetchProfile(data.user.id);
  
  if (profile) {
    // Check if key business info fields are empty (org-centric model)
    const needsPhone = (!profile.phone || profile.phone.trim() === '');
    (profile as any).needsProfileCompletion = needsPhone;
  }

  return { data: { ...data, profile }, error: profileError };
}

export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    // If the error is related to refresh token not found, clear the session
    if (isDev) console.log('No valid session found or error:', error?.message);
    return { user: null, error: error || new Error('No active session') };
  }

  const { data: profile, error: profileError } = await fetchProfile(session.user.id);

  if (profileError || !profile) {
    return { user: null, error: profileError };
  }

  return { user: profile, error: null };
}

export async function updateProfile(userId: string, updates: Partial<Database['public']['Tables']['profiles']['Row']>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  return { data, error };
}

export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(filePath, file);

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data } = supabase.storage
    .from('user-avatars')
    .getPublicUrl(filePath);

  // Update the user profile with the new avatar URL
  const { data: profileData, error: profileError } = await updateProfile(userId, {
    avatar_url: data.publicUrl,
  });

  return { data: profileData, error: profileError };
}
// Favorites functions
export async function addFavorite(userId: string, propertyId: string) {
  // First check if the favorite already exists
  const { data: existing, error: checkError } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .maybeSingle();

  // If it already exists, return success without trying to insert again
  if (existing) {
    return { data: existing, error: null };
  }

  // If there was an error checking, return it
  if (checkError) {
    return { data: null, error: checkError };
  }

  // Otherwise, insert the new favorite
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      user_id: userId,
      property_id: propertyId
    })
    .select()
    .single();
  
  return { data, error };
}

export async function removeFavorite(userId: string, propertyId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);
  
  return { data, error };
}

export async function isFavorite(userId: string, propertyId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .maybeSingle();
  
  return { data, error, isFavorited: !!data };
}

export async function fetchFavorites(userId: string) {
  // Step 1: fetch favorites for user (without embedding)
  const { data: favs, error: favErr } = await supabase
    .from('favorites')
    .select('id, user_id, property_id, created_at')
    .eq('user_id', userId);

  if (favErr) return { data: null, error: favErr };

  if (!favs || favs.length === 0) return { data: [], error: null };

  const propertyIds = Array.from(new Set(favs.map(f => f.property_id).filter(Boolean)));

  // Step 2: fetch properties in one go
  const { data: props, error: propsErr } = await supabase
    .from('properties')
    .select('*')
    .in('id', propertyIds);

  if (propsErr) return { data: null, error: propsErr };

  const propMap = new Map<string, any>(
    (props || []).map(p => [p.id, {
      ...p,
      address: {
        street: p.address_street,
        city: p.address_city,
        state: p.address_state,
        postal_code: p.address_postal_code,
        country: p.address_country,
        latitude: p.latitude,
        longitude: p.longitude,
      }
    }])
  );

  const joined = favs.map(f => ({
    ...f,
    property: propMap.get(f.property_id) || null,
  }));

  return { data: joined, error: null };
}