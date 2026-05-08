// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import Stripe from 'npm:stripe@14.21.0';
import { createLogger } from '../_shared/logger.ts'

// Dynamic CORS allowlist (shared approach with refresh-stripe-status)
const allowedOriginsEnv = Deno.env.get('FRONTEND_ALLOWED_ORIGINS') || ''
const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean)
const fallbackOrigin = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
if (!allowedOrigins.length) allowedOrigins.push(fallbackOrigin)
function pickAllowedOrigin(origin: string | null): string {
  try {
    if (origin && /^(http:\/\/)?localhost(:\d+)?$/i.test(new URL(origin).host)) return origin
    if (origin && allowedOrigins.includes(origin)) return origin
    if (origin) {
      const inc = new URL(origin)
      for (const o of allowedOrigins) {
        try { const cand = new URL(o); if (cand.host === inc.host) return origin } catch {}
      }
    }
  } catch {}
  return allowedOrigins[0]
}
function corsHeaders(origin: string | null) {
  const allow = pickAllowedOrigin(origin)
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID()
  let log = createLogger({ correlationId, function: 'create-express-account-link' })
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  try {
    const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? ''
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('PUBLIC_ANON_KEY') ?? ''

    if (!SUPABASE_URL_ENV || !serviceKey || !anonKey) {
      log.error('missing_supabase_env', { hasUrl: !!SUPABASE_URL_ENV, hasServiceKey: !!serviceKey, hasAnonKey: !!anonKey })
      throw new Error('Server configuration error');
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL_ENV,
      serviceKey,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
      },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(
      SUPABASE_URL_ENV,
      anonKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`);
    }
    log = log.child({ userId: user.id })

    const { returnUrl, refreshUrl, type } = await req.json();
    log.info('Creating Stripe Express account link', { type })

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      typescript: true,
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, primary_organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch profile: ${profileError?.message || 'Profile not found'}`);
    }

    if (!profile.primary_organization_id) {
      throw new Error('No primary organization found for user');
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name, stripe_account_id')
      .eq('id', profile.primary_organization_id)
      .single();
    if (orgErr || !org) {
      throw new Error(`Failed to fetch organization: ${orgErr?.message || 'Organization not found'}`);
    }

    let stripeAccountId = org.stripe_account_id as string | null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: profile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: org.name || (profile.full_name || 'Organization'),
        },
      });
      stripeAccountId = account.id;

      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', org.id);

      if (updateOrgError) {
        throw new Error(`Failed to update organization with Stripe account ID: ${updateOrgError.message}`);
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: type || 'account_onboarding',
      collect: 'currently_due',
    });
    log = log.child({ stripeAccountId, type, accountLinkUrl: accountLink.url, organizationId: org.id })
    log.info('Created Stripe account link')

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      {
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Error creating Stripe account link', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});