import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

// Simple admin function to generate a magic link for notifications
// Input: { email: string, redirectPath?: string }
// Output: { actionLink: string }

const METHODS = 'POST, OPTIONS';

function corsHeaders(origin: string | null, methods: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  } as Record<string, string>;
}

function handleOptions(req: Request, methods: string) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: { ...corsHeaders(origin, methods) } });
  }
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const preflight = handleOptions(req, METHODS);
  if (preflight) return preflight;
  const cors = corsHeaders(origin, METHODS);

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const baseUrl = Deno.env.get('FRONTEND_BASE_URL') || '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      global: { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const email = String(body?.email || '').trim();
    const redirectPath = typeof body?.redirectPath === 'string' ? body.redirectPath : '/dashboard';
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const redirectTo = `${baseUrl}${redirectPath || '/dashboard'}`;
    const { data, error } = await (admin as any).auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ actionLink: data?.properties?.action_link || null }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
