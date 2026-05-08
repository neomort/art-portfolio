// @ts-nocheck
import { createLogger } from '../_shared/logger.ts'

const ALLOWED_ORIGIN = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

Deno.serve({ permissions: { net: ["*.supabase.co"] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || req.headers.get('x-request-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const url = new URL(req.url)

  const log = createLogger({ function: 'echo-correlation', correlationId: cid })

  // Request-scoped helpers
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...corsHeaders, 'X-Correlation-Id': cid }, status }
    )
  const corsOk = () => new Response('ok', { headers: { ...corsHeaders, 'X-Correlation-Id': cid } })

  if (req.method === 'OPTIONS') {
    log.info('cors_preflight_ok')
    return corsOk()
  }

  try {
    log.info('echo_request', {
      method: req.method,
      path: url.pathname,
    })

    return json(200, {
      ok: true,
      method: req.method,
      path: url.pathname,
    })
  } catch (err) {
    log.error('echo_error', { err: String(err) })
    return json(500, { ok: false, error: 'internal_error' })
  }
})
