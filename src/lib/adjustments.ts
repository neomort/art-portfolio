import type { Json } from '../types/database';

export type AdjustmentLike = {
  id?: string | null;
  type?: string | null;
  data?: Record<string, Json | undefined> | null;
};

const normalizePart = (value?: string | null) => (value ?? '').trim().toLowerCase();

export const computeLegacyAdjustmentKey = (adjustment: AdjustmentLike): string => {
  const type = normalizePart(adjustment.type) || 'unknown';
  const data = adjustment.data ?? {};
  const requiredDocumentation = normalizePart(
    (data.requiredDocumentation as string) ??
    (data.required_documentation as string) ??
    (data.documentation as string) ??
    null
  );
  const name = normalizePart((data.name as string) ?? null);
  const label = requiredDocumentation || name || normalizePart(adjustment.id ?? null) || 'unlabeled';
  return `${type}:${label}`;
};

export const computeAdjustmentKey = (adjustment: AdjustmentLike): string => {
  const type = normalizePart(adjustment.type) || 'unknown';
  const data = adjustment.data ?? {};
  const stableKey = normalizePart((data.stableKey as string) ?? (data.stable_key as string) ?? null);
  if (stableKey) return `${type}:${stableKey}`;
  return computeLegacyAdjustmentKey(adjustment);
};

export const parseAppliedAdjustmentTokens = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim());
  }

  if (typeof value === 'string') {
    // Either JSON array or comma-separated legacy string
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim());
      }
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }

  return [];
};

export const isAdjustmentApplied = (adjustment: AdjustmentLike, appliedTokens: Set<string>): boolean => {
  const key = computeAdjustmentKey(adjustment);
  if (appliedTokens.has(key)) return true;

  // Back-compat: if we now have stableKey but the property stored a legacy key, still treat it as applied.
  const legacyKey = computeLegacyAdjustmentKey(adjustment);
  if (legacyKey !== key && appliedTokens.has(legacyKey)) return true;

  const id = adjustment.id?.trim();
  return !!id && appliedTokens.has(id);
};
