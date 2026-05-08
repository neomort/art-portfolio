// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import Stripe from 'npm:stripe@14.21.0';
import { createLogger } from '../_shared/logger.ts'

// Build a dynamic CORS allowlist from env
const allowedOriginsEnv = Deno.env.get('FRONTEND_ALLOWED_ORIGINS') || ''
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
// Fallback to single FRONTEND_URL or localhost during dev
const fallbackOrigin = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
if (!allowedOrigins.length) allowedOrigins.push(fallbackOrigin)

function pickAllowedOrigin(incoming: string | null): string {
  // Always allow localhost origins for dev
  try {
    if (incoming) {
      const u = new URL(incoming)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0') return incoming
    }
  } catch {}
  if (incoming && allowedOrigins.includes(incoming)) return incoming
  // Also allow loose match for same host scheme differences if desired
  try {
    if (incoming) {
      const inc = new URL(incoming)
      for (const o of allowedOrigins) {
        try {
          const cand = new URL(o)
          if (cand.host === inc.host) return incoming
        } catch {}
      }
    }
  } catch {}
  return allowedOrigins[0]
}

function makeCorsHeaders(origin: string | null) {
  const allowOrigin = pickAllowedOrigin(origin)
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  }
}

Deno.serve({ permissions: { net: ["*.supabase.co", "api.stripe.com", "api.brevo.com"] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'refresh-stripe-status', correlationId: cid })

  // Small request-scoped helpers
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...makeCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json', 'X-Correlation-Id': cid }, status }
    )
  const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
    json(status, { error: message, ...extra })
  const corsOk = () => new Response('ok', { headers: { ...makeCorsHeaders(req.headers.get('origin')), 'X-Correlation-Id': cid } })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    log.info('cors_preflight_ok')
    return corsOk();
  }

  try {
    const started = performance.now()
    const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL')
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL_ENV || !serviceKey) {
      log.error('env_missing', { hasUrl: !!SUPABASE_URL_ENV, hasService: !!serviceKey })
      return error(400, 'Server configuration error')
    }
    const supabaseClient = createClient(
      SUPABASE_URL_ENV,
      serviceKey,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log.warn('auth_missing')
      return error(400, 'Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    // Validate JWT using service role, mirroring create-express-account-link
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData?.user) {
      log.warn('auth_invalid', { err: authError?.message })
      return error(401, 'Invalid JWT')
    }
    const user = userData.user

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      typescript: true,
    });

    // Resolve user's primary organization and its Stripe account
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('primary_organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.primary_organization_id) {
      log.warn('no_primary_org', { userId: user.id })
      throw new Error('No primary organization found for user');
    }

    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id, stripe_account_id')
      .eq('id', profile.primary_organization_id)
      .single();

    if (orgError || !org || !org.stripe_account_id) {
      log.warn('no_org_stripe_account', { userId: user.id, organizationId: profile.primary_organization_id })
      throw new Error('No Stripe account found for organization');
    }

    // Retrieve account status from Stripe
    const account = await stripe.accounts.retrieve(org.stripe_account_id);
    log.info('stripe_account_retrieved', {
      account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      currently_due: account.requirements?.currently_due?.length || 0,
      eventually_due: account.requirements?.eventually_due?.length || 0,
      past_due: account.requirements?.past_due?.length || 0
    })

    // Update organization with current status (source of truth)
    const { error: updateError } = await supabaseClient
      .from('organizations')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }
    log.info('organization_updated', { userId: user.id, organizationId: org.id })

    const latencyMs = Math.round(performance.now() - started)
    log.info('success', { userId: user.id, latencyMs })
    return json(200, {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || []
      },
      updated: true,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && 'message' in error)
      ? (error as any).message
      : String(error)
    log.error('handler_error', { err: msg })
    return error(400, msg)
  }
});