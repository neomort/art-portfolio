// @ts-nocheck
import { createLogger } from '../_shared/logger.ts'
import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'

Deno.serve({ permissions: { net: ["*.supabase.co"] } }, async (req) => {
  const incomingCid = req.headers.get('x-correlation-id') || req.headers.get('x-request-id') || undefined
  const cid = incomingCid ?? crypto.randomUUID()
  const log = createLogger({ function: 'health', correlationId: cid })

  const methods = 'GET, OPTIONS'
  const origin = req.headers.get('origin')
  const cors = buildCorsHeaders(origin, methods)
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(
      JSON.stringify({ ...body, correlationId: cid }),
      { headers: { ...cors, 'X-Correlation-Id': cid, 'Content-Type': 'application/json' }, status }
    )
  const corsOk = () => new Response('ok', { headers: { ...cors, 'X-Correlation-Id': cid } })

  const pre = handleOptions(req, methods)
  if (pre) { log.info('cors_preflight_ok'); return pre }

  if (req.method !== 'GET') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  try {
    return json(200, {
      ok: true,
      status: 'healthy',
      time: new Date().toISOString(),
    })
  } catch (err) {
    log.error('health_error', { err: String(err) })
    return json(500, { ok: false, error: 'internal_error' })
  }
})
