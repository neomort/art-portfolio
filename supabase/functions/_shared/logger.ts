// Deno-friendly minimal structured logger
// Emits JSON logs to console with consistent fields.
// Usage:
//   const log = createLogger({ function: 'mint-upload-url', correlationId });
//   log.info('request_received', { origin });
//   log.error('handler_error', { err });

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface BaseMeta {
  function?: string
  correlationId?: string
  [key: string]: unknown
}

interface Logger {
  debug: (event: string, meta?: Record<string, unknown>) => void
  info: (event: string, meta?: Record<string, unknown>) => void
  warn: (event: string, meta?: Record<string, unknown>) => void
  error: (event: string, meta?: Record<string, unknown>) => void
  child: (extra: Record<string, unknown>) => Logger
}

function emit(level: LogLevel, event: string, base: BaseMeta, meta?: Record<string, unknown>) {
  // Ensure we do not throw on circular structures
  const safe = (value: unknown) => {
    try {
      return JSON.parse(JSON.stringify(value, (_k, v) => (v instanceof Error ? String(v.stack || v.message) : v)))
    } catch {
      return String(value)
    }
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...base,
    ...(meta ? safe(meta) : {}),
  }

  const json = JSON.stringify(payload)
  if (level === 'error') {
    console.error(json)
  } else if (level === 'warn') {
    console.warn(json)
  } else if (level === 'debug') {
    console.debug(json)
  } else {
    console.log(json)
  }
}

export function createLogger(base: BaseMeta = {}): Logger {
  const api: Logger = {
    debug: (event, meta) => emit('debug', event, base, meta),
    info: (event, meta) => emit('info', event, base, meta),
    warn: (event, meta) => emit('warn', event, base, meta),
    error: (event, meta) => emit('error', event, base, meta),
    child: (extra) => createLogger({ ...base, ...extra }),
  }
  return api
}
