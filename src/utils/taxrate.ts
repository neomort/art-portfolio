// Utility for fetching sales tax rate from Supabase Edge Function by zip code
// Usage: getTaxRateByZip(zip: string): Promise<number|null>

import { supabase } from '../lib/supabase';

export async function getTaxRateByZip(zip: string | number | null | undefined): Promise<number|null> {
  const normalizedZip = typeof zip === 'number'
    ? String(zip)
    : typeof zip === 'string'
      ? zip.trim()
      : '';
  if (!normalizedZip) return null;
  try {
    const { data, error } = await supabase.functions.invoke('taxrate-proxy', {
      body: { zip: normalizedZip },
      headers: {
        // Send apikey to satisfy gateway requirements
        apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY,
      },
    });
    if (error) throw error;
    if (data && typeof data.rate === 'number') return data.rate as number;
    if (data && typeof data.rate === 'string' && !isNaN(Number(data.rate))) return Number(data.rate);
    return null;
  } catch (e: any) {
    // Optionally log error details to console without breaking UI
    try {
      console.warn('taxrate-proxy error', {
        status: e?.context?.response?.status ?? e?.status,
        message: e?.context?.error ?? e?.message,
      });
    } catch {}
    return null;
  }
}
