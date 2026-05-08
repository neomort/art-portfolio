import { supabase } from './supabase';

export async function generateMagicLinkForEmail(email: string, redirectPath: string = '/dashboard'): Promise<string | null> {
  const { data, error } = await (supabase as any).functions.invoke('generate-magic-link', {
    body: { email, redirectPath },
  });
  if (error) throw error;
  return (data as any)?.actionLink ?? null;
}
