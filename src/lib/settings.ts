import { supabase } from './supabase';

// Simple in-memory cache for settings during a session
const cache: Record<string, string | undefined> = {};

const toBool = (val: unknown, fallback = true): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  }
  return fallback;
};

export async function getSetting(key: string): Promise<string | undefined> {
  // Check cache first
  if (key in cache) return cache[key];
  
  try {
    // Try to get the setting from the database
    const { data, error } = await supabase.rpc('get_system_setting', { setting_key: key });
    
    if (error) {
      console.warn(`Failed to fetch setting '${key}':`, error.message);
      return undefined;
    }
    
    const value = data as string | null | undefined;
    cache[key] = value ?? undefined;
    return cache[key];
  } catch (error) {
    console.warn(`Error accessing system settings for '${key}':`, error);
    return undefined;
  }
}

export async function getAuthEmailConfirmEnabled(): Promise<boolean> {
  const raw = await getSetting('auth_email_confirm_enabled');
  return toBool(raw, true);
}

export function setCachedSetting(key: string, value: string | undefined) {
  cache[key] = value;
}
