// Centralized Winston logger for browser (Vite)
// Usage: const log = getLogger({ page: 'ManagePropertyPage' }); log.info('msg', { extra: 123 })

import { createLogger, format, transports, Logger } from 'winston';

// Determine level from env
const level = (import.meta as any).env?.MODE === 'production' ? 'info' : 'debug';

// Base logger
const baseLogger: Logger = createLogger({
  level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { app: 'art-portfolio' },
  transports: [
    new transports.Console({
      // Human-readable in dev console; JSON format already part of logger, but console transport
      // will render a string for easier reading in dev tools
      format: (import.meta as any).env?.MODE === 'production'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
  ],
});

export function setLogLevel(newLevel: string) {
  baseLogger.level = newLevel;
}

// Create a child logger with contextual metadata (e.g., page, correlationId, userId)
export function getLogger(context?: Record<string, unknown>): Logger {
  return context ? baseLogger.child(context) : baseLogger;
}

// Helper to include correlationId from Edge responses
export function withCorrelation(log: Logger, correlationId?: string | null) {
  return correlationId ? log.child({ correlationId }) : log;
}
