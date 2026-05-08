// Supabase Edge Function: taxrate-proxy
// POST { zip: string } => { rate: number|null, error?: string }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const TAXRATE_API_KEY = Deno.env.get('TAXRATE_API_KEY');
const TAXRATE_API_URL = 'https://www.taxrate.io/api/v1/rate/getratebyzip';

Deno.serve({ permissions: { net: ['www.taxrate.io', 'taxrate.io'] } }, async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    console.log(JSON.stringify({ fn: 'taxrate-proxy', event: 'request_received', method: req.method }));
    const rawBody = await req.text();
    let payload: any = {};
    if (rawBody && rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody);
      } catch (parseErr) {
        console.error(JSON.stringify({ fn: 'taxrate-proxy', event: 'invalid_json', message: (parseErr as any)?.message || String(parseErr || ''), rawBodyPreview: rawBody.slice?.(0, 256) }));
        return new Response(JSON.stringify({ error: 'Missing or invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const rawZip = payload?.zip;
    const zip = typeof rawZip === 'number'
      ? String(rawZip)
      : typeof rawZip === 'string'
        ? rawZip.trim()
        : '';
    console.log(JSON.stringify({ fn: 'taxrate-proxy', event: 'payload_parsed', rawZipType: typeof rawZip, rawZipValue: rawZip, normalizedZip: zip }));
    if (!zip) {
      return new Response(JSON.stringify({ error: 'Missing or invalid zip', detail: { rawZipType: typeof rawZip, rawZipValue: rawZip } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!TAXRATE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: missing TAXRATE_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const url = `${TAXRATE_API_URL}?api_key=${encodeURIComponent(TAXRATE_API_KEY)}&zip=${encodeURIComponent(zip)}`;
    const taxRes = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (taxRes.redirected) {
      console.log(JSON.stringify({ fn: 'taxrate-proxy', event: 'redirected', finalUrl: taxRes.url }));
    }
    if (!taxRes.ok) {
      const text = await taxRes.text().catch(() => '');
      console.error(JSON.stringify({ fn: 'taxrate-proxy', event: 'upstream_not_ok', status: taxRes.status, body: text?.slice?.(0, 512) }));
      return new Response(JSON.stringify({ error: 'Failed to fetch from taxrate.io' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await taxRes.json();
    if (typeof data.rate === 'number') {
      return new Response(JSON.stringify({ rate: data.rate }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (typeof data.rate === 'string' && !isNaN(Number(data.rate))) {
      return new Response(JSON.stringify({ rate: Number(data.rate) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ rate: null, error: 'No rate found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    try {
      console.error(JSON.stringify({ fn: 'taxrate-proxy', event: 'unhandled_error', message: (err as any)?.message || String(err || '') }));
    } catch {}
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
