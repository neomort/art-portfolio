import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

type InquiryLitePayload = {
  propertyId: string;
  startDate: string;
  endDate: string;
  startAt?: string | null;
  endAt?: string | null;
  headcountValue?: number | null;
  selectedAdjustmentIds?: string[] | null;
  message?: string | null;
  guestEmail: string;
  guestName?: string | null;
  redirectPath?: string;
};

const METHODS = 'POST, OPTIONS';

function corsHeaders(origin: string | null, methods: string) {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id, x-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  } as Record<string, string>;
}

function handleOptions(req: Request, methods: string) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { status: 204, headers: { ...corsHeaders(origin, methods) } });
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
    info: (...args: any[]) => console.log('[submit-inquiry-lite][info]', correlationId, ...args),
    warn: (...args: any[]) => console.warn('[submit-inquiry-lite][warn]', correlationId, ...args),
    error: (...args: any[]) => console.error('[submit-inquiry-lite][error]', correlationId, ...args),
  };

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    // Determine frontend base URL: prefer FRONTEND_BASE_URL, then FRONTEND_URL, then first of FRONTEND_URLS
    const baseUrl =
      Deno.env.get('FRONTEND_BASE_URL') ||
      Deno.env.get('FRONTEND_URL') ||
      (Deno.env.get('FRONTEND_URLS') || '').split(',').map(s => s.trim()).filter(Boolean)[0] ||
      '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      global: { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payload: InquiryLitePayload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const {
      propertyId,
      startDate,
      endDate,
      startAt = null,
      endAt = null,
      headcountValue = null,
      selectedAdjustmentIds = null,
      message = 'Guest inquiry',
      guestEmail,
      guestName = null,
    } = payload || {};

    if (!propertyId || !startDate || !endDate || !guestEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Find or create user
    let userId: string | null = null;
    let createdNewUser = false;
    try {
      const { data: prof } = await admin.from('profiles' as any).select('id').eq('email', guestEmail).maybeSingle<{ id: string }>();
      if (prof?.id) userId = prof.id;
    } catch {}

    if (!userId) {
      const { data: created, error: createErr } = await (admin as any).auth.admin.createUser({ email: guestEmail, email_confirm: false, user_metadata: { full_name: guestName || undefined } });
      if (createErr) {
        const { data: listed } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = (listed?.users || []).find((u: any) => (u.email || '').toLowerCase() === (guestEmail || '').toLowerCase());
        userId = existing?.id || null;
      } else {
        userId = created?.user?.id || null;
        createdNewUser = !!userId;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User provisioning failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    try {
      if (createdNewUser) {
        // Mark lite account lacking a password so the UI can prompt to set one
        await admin.from('profiles' as any).upsert({ id: userId, email: guestEmail, full_name: guestName, password_set: false }, { onConflict: 'id' });
      } else {
        await admin.from('profiles' as any).upsert({ id: userId, email: guestEmail, full_name: guestName }, { onConflict: 'id' });
      }
    } catch {}

    // Insert inquiry via SECURITY DEFINER RPC
    const normHeadcount = typeof headcountValue === 'number' && Number.isFinite(headcountValue) ? headcountValue : null;
    const normStartAt = typeof startAt === 'string' && startAt.length > 0 ? startAt : null;
    const normEndAt = typeof endAt === 'string' && endAt.length > 0 ? endAt : null;
    const normAdjIds = Array.isArray(selectedAdjustmentIds) && selectedAdjustmentIds.length > 0 ? selectedAdjustmentIds : null;

    const { data: inquiryId, error: inquiryErr } = await (admin as any).rpc('insert_inquiry_for_user', {
      p_property_id: propertyId,
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_start_at: normStartAt,
      p_end_at: normEndAt,
      p_headcount: normHeadcount,
      p_selected_adjustment_ids: normAdjIds,
      p_message: message,
    });

    if (inquiryErr || !inquiryId) {
      return new Response(JSON.stringify({ error: 'Failed to create inquiry', details: inquiryErr?.message || 'unknown_error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Generate Supabase magic link to obtain email_otp; we will build a first-party callback URL
    const redirectTo = `${baseUrl}/dashboard`;
    const { data: linkData, error: linkErr } = await (admin as any).auth.admin.generateLink({ type: 'magiclink', email: guestEmail, options: { redirectTo } });
    if (linkErr) {
      console.warn('[submit-inquiry-lite] generate_link_failed', linkErr.message);
    }
    // Prefer first-party callback using email_otp so tracking wrappers don't break session creation
    const emailOtp: string | null = (linkData as any)?.properties?.email_otp || null;
    const firstPartyAction = emailOtp && baseUrl
      ? `${baseUrl}/auth/magic?token=${encodeURIComponent(emailOtp)}&email=${encodeURIComponent(guestEmail)}&next=${encodeURIComponent('/dashboard')}`
      : null;
    const actionLink: string | null = firstPartyAction || linkData?.properties?.action_link || null;

    // Property title for email context
    let propertyTitle: string | null = null;
    try {
      const { data: propRow } = await admin.from('properties' as any).select('title').eq('id', propertyId).maybeSingle<{ title: string }>();
      propertyTitle = propRow?.title || null;
    } catch {}

    // Send Brevo email
    const brevoKey = Deno.env.get('BREVO_API_KEY') || '';
    const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || '';
    const brevoSenderName = Deno.env.get('BREVO_SENDER_NAME') || 'SplitSpace';
    const brevoTemplateId = Number(Deno.env.get('BREVO_INQUIRY_TEMPLATE_ID') || '9');
    let emailSent = false;
    if (brevoKey && brevoSenderEmail && brevoTemplateId > 0) {
      try {
        const emailPayload: Record<string, any> = {
          to: [{ email: guestEmail, name: guestName || undefined }],
          sender: { email: brevoSenderEmail, name: brevoSenderName },
          templateId: brevoTemplateId,
          params: {
            guest_name: guestName || 'there',
            property_title: propertyTitle || 'the property',
            start_date: startDate,
            end_date: endDate,
            message_preview: (message || '').slice(0, 280),
            action_link: actionLink || redirectTo,
          },
        };
        const res = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': brevoKey }, body: JSON.stringify(emailPayload) });
        emailSent = res.ok;
        if (!res.ok) {
          const txt = await res.text();
          console.warn('[submit-inquiry-lite] brevo_send_failed', res.status, txt);
        }
      } catch (e) {
        console.warn('[submit-inquiry-lite] brevo_send_crashed', String(e));
      }
    }

    return new Response(JSON.stringify({ success: true, inquiryId, userId, actionLink, emailSent, notice: 'We sent a secure link to your email so you can continue your inquiry.' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
