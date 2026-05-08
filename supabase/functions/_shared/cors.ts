// @ts-nocheck
// Shared CORS utilities for Supabase Edge Functions
// Usage:
//   import { buildCorsHeaders, handleOptions } from '../_shared/cors.ts'
//   const pre = handleOptions(req, 'GET, POST, OPTIONS')
//   if (pre) return pre
//   return new Response(JSON.stringify(data), { headers: { ...buildCorsHeaders(req.headers.get('origin'), 'GET, POST, OPTIONS'), 'Content-Type': 'application/json' } })

const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-correlation-id'

function parseAllowedOrigins(): string[] {
  // FRONTEND_URL: single origin
  // FRONTEND_ORIGINS: comma-separated list of origins
  const fromSingle = (Deno.env.get('FRONTEND_URL') || '').trim()
  const fromList = (Deno.env.get('FRONTEND_ORIGINS') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5175', 'http://127.0.0.1:5175']
  const all = [...defaults, ...(fromSingle ? [fromSingle] : []), ...fromList]
  // Deduplicate
  return Array.from(new Set(all))
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  try {
    const allowed = parseAllowedOrigins()
    return allowed.includes(origin)
  } catch (_) {
    return false
  }
}

export function buildCorsHeaders(origin: string | null, methods: string, extraHeaders?: string): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin) ? (origin as string) : 'null'
  const allowHeaders = extraHeaders ? `${DEFAULT_ALLOWED_HEADERS}, ${extraHeaders}` : DEFAULT_ALLOWED_HEADERS
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': methods,
  }
}

export function handleOptions(req: Request, methods: string, extraHeaders?: string): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req.headers.get('origin'), methods, extraHeaders) })
  }
  return null
}
