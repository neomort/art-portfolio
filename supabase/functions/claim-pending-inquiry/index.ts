import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

type PendingPayload = {
  propertyId: string;
  startDate: string;
  endDate: string;
  mode?: 'daily' | 'hourly';
  isHourlyMode?: boolean;
  hourlySelection?: { start: string; end: string } | null;
  startAt?: string | null;
  endAt?: string | null;
  headcount?: string;
  headcountValue?: number | null;
  selectedUserDiscounts?: Record<string, boolean>;
  selectedAdjustmentIds?: string[];
  formData?: {
    spaceRequirements: string;
    brandInfo: string;
    comments: string;
  };
  message?: string;
  guestEmail?: string | null;
  guestName?: string | null;
  propertyTimezone?: string | null;
  redirectPath?: string;
};

type PendingInquiryRow = {
  id: string;
  token: string;
  property_id: string;
  payload: PendingPayload;
  guest_email: string | null;
  guest_name: string | null;
  redirect_path: string | null;
  claimed: boolean;
  claimed_at: string | null;
  claimed_by: string | null;
  inquiry_id: string | null;
  created_at: string;
  expires_at: string;
};

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
  const correlationId = req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = {
    info: (...args: any[]) => console.log('[claim-pending-inquiry][info]', correlationId, ...args),
    warn: (...args: any[]) => console.warn('[claim-pending-inquiry][warn]', correlationId, ...args),
    error: (...args: any[]) => console.error('[claim-pending-inquiry][error]', correlationId, ...args),
  };

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      log.error('missing_supabase_env');
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      global: {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
      auth: {
        // ensure we never accidentally mix in the caller's JWT
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!jwt) {
      log.warn('missing_jwt');
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !authUser?.user) {
      log.warn('invalid_jwt', { error: authError?.message });
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const userId = authUser.user.id;

    let body: { token?: string };
    try {
      body = await req.json();
    } catch (parseError) {
      log.warn('invalid_json', { parseError: String(parseError) });
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { token } = body ?? {};
    if (!token) {
      log.warn('missing_token');
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: pendingRow, error: pendingError } = await supabaseAdmin
      .from('pending_inquiries')
      .select('*')
      .eq('token', token)
      .maybeSingle<PendingInquiryRow>();

    if (pendingError) {
      log.error('pending_lookup_failed', { error: pendingError.message });
      return new Response(JSON.stringify({ error: 'Failed to lookup pending inquiry' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingRow) {
      log.info('pending_not_found', { token });
      return new Response(JSON.stringify({ error: 'Pending inquiry not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (pendingRow.claimed) {
      log.info('pending_already_claimed', { pendingId: pendingRow.id, inquiryId: pendingRow.inquiry_id });
      const redirectPath = pendingRow.payload?.redirectPath || pendingRow.redirect_path || '/dashboard';
      return new Response(
        JSON.stringify({ success: true, inquiryId: pendingRow.inquiry_id, redirectPath, pendingId: pendingRow.id }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const expiresAt = pendingRow.expires_at ? new Date(pendingRow.expires_at) : null;
    if (expiresAt && now > expiresAt) {
      log.info('pending_expired', { pendingId: pendingRow.id, expiresAt: pendingRow.expires_at });
      return new Response(JSON.stringify({ error: 'Pending inquiry expired' }), {
        status: 410,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const payload = pendingRow.payload ?? {};
    const message = payload.message ?? 'Guest inquiry';
    const startDate = payload.startDate;
    const endDate = payload.endDate;
    const propertyId = pendingRow.property_id ?? payload.propertyId;

    if (!propertyId || !startDate || !endDate) {
      log.error('payload_missing_fields', { payload });
      return new Response(JSON.stringify({ error: 'Pending inquiry is missing required fields' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const headcount = typeof payload.headcountValue === 'number' ? payload.headcountValue : null;
    const selectedAdjustmentIds = Array.isArray(payload.selectedAdjustmentIds) && payload.selectedAdjustmentIds.length
      ? payload.selectedAdjustmentIds
      : null;

    const { data: inquiryInsertResult, error: inquiryInsertError } = await supabaseAdmin
      .rpc('claim_pending_inquiry_rpc', {
        p_property_id: propertyId,
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_start_at: payload.startAt ?? null,
        p_end_at: payload.endAt ?? null,
        p_headcount: headcount,
        p_selected_adjustment_ids: selectedAdjustmentIds,
        p_message: message,
      });

    if (inquiryInsertError || !inquiryInsertResult) {
      log.error('inquiry_insert_failed', {
        error: inquiryInsertError?.message,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to create inquiry',
          details: inquiryInsertError?.message || 'unknown_error',
          hint: 'Verify inquiries table columns (status enum, date/timestamp types, selected_adjustment_ids type)',
        }),
        {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        },
      );
    }

    const inquiryId = (inquiryInsertResult as unknown as string) ?? undefined;

    // Mark pending as claimed via SECURITY DEFINER RPC; be forgiving if it fails to avoid duplicate inserts
    const { error: markErr } = await supabaseAdmin.rpc('mark_pending_inquiry_claimed', {
      p_token: token,
      p_user_id: userId,
      p_inquiry_id: inquiryId,
    });
    if (markErr) {
      log.error('pending_update_failed', { error: markErr.message, pendingId: pendingRow.id });
      const redirectPathSoft = payload.redirectPath || pendingRow.redirect_path || '/dashboard';
      return new Response(
        JSON.stringify({ success: true, inquiryId, redirectPath: redirectPathSoft, pendingId: pendingRow.id, warning: 'Pending row not updated' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const redirectPath = payload.redirectPath || pendingRow.redirect_path || '/dashboard';

    return new Response(
      JSON.stringify({
        success: true,
        inquiryId,
        redirectPath,
        pendingId: pendingRow.id,
      }),
      {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      },
    );
  } catch (error) {
    log.error('unexpected_error', { error: String(error) });
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
