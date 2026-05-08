import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

/*
  Public Property Data (service role)
  Returns minimal data needed by unauthenticated InquiryForm without hitting RLS:
  - bookings for a given property_id: start_at, end_at, start_date, end_date, status
  - organization_adjustments for the property's organization: id, type, data, sort_order
*/

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

    const body = await req.json();
    const propertyId = String(body?.propertyId || '').trim();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'propertyId required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      global: { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch the property's organization id
    const { data: prop, error: propErr } = await admin
      .from('properties' as any)
      .select('organization_id')
      .eq('id', propertyId)
      .maybeSingle();
    if (propErr) {
      console.error('[public-property-data] properties fetch error', { propertyId, error: propErr });
      return new Response(JSON.stringify({ error: propErr.message, where: 'properties', propertyId }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const orgId = (prop as any)?.organization_id || null;

    const [bookingsRes, adjustmentsRes, surveyRes, orgRes] = await Promise.all([
      admin
        .from('bookings' as any)
        .select('start_at,end_at,start_date,end_date,status')
        .eq('property_id', propertyId),
      orgId
        ? admin
            .from('organization_adjustments' as any)
            .select('id, type, data, sort_order')
            .eq('organization_id', orgId)
            .order('sort_order')
        : Promise.resolve({ data: [], error: null } as any),
      orgId
        ? admin
            .from('organization_inquiry_forms' as any)
            .select('survey_json')
            .eq('organization_id', orgId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      orgId
        ? admin
            .from('organizations' as any)
            .select('default_timezone')
            .eq('id', orgId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (bookingsRes.error) {
      console.error('[public-property-data] bookings error', { propertyId, error: bookingsRes.error });
      return new Response(JSON.stringify({ error: bookingsRes.error.message, where: 'bookings', propertyId }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (adjustmentsRes.error) {
      console.error('[public-property-data] org adjustments error', { orgId, error: adjustmentsRes.error });
      return new Response(JSON.stringify({ error: adjustmentsRes.error.message, where: 'organization_adjustments', orgId }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (surveyRes.error && surveyRes.error.message && !/PGRST116|not\s+found/i.test(String(surveyRes.error.message))) {
      // Only treat as error if not simply missing row
      console.error('[public-property-data] organization_inquiry_forms error', { orgId, error: surveyRes.error });
      return new Response(JSON.stringify({ error: surveyRes.error.message, where: 'organization_inquiry_forms', orgId }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (orgRes.error) {
      console.error('[public-property-data] organizations error', { orgId, error: orgRes.error });
      return new Response(JSON.stringify({ error: orgRes.error.message, where: 'organizations', orgId }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({
        bookings: bookingsRes.data || [],
        orgAdjustments: adjustmentsRes.data || [],
        surveyJson: (surveyRes?.data as any)?.survey_json || null,
        defaultTimezone: (orgRes?.data as any)?.default_timezone || null,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[public-property-data] unexpected error', e);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
