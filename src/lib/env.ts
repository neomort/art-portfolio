// Centralized environment variable access compatible with Vite and Jest/Node
// Avoid direct references to import.meta so CommonJS/Jest doesn't choke.
const nodeEnv: any = (globalThis as any)?.process?.env;
const isJest = typeof nodeEnv?.JEST_WORKER_ID !== 'undefined' || nodeEnv?.NODE_ENV === 'test';
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getViteEnv = (): any => {
  if (!isBrowser || isJest) return undefined;
  // Use eval-only approach to avoid literal import.meta in the source,
  // which breaks Jest/CommonJS parsing.
  try {
    // eslint-disable-next-line no-eval
    return (0, eval)('import.meta.env');
  } catch {
    return undefined;
  }
};
const viteEnv: any = getViteEnv();
// Vite define() injected globals (set in vite.config.ts). These exist at runtime if defined.
// Vite replace-time constants. They are undefined at type level during tests/build
// but replaced to string literals at compile time when defined in vite.config.ts.
// Declare them so TypeScript doesn't error when referencing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __VITE_SUPABASE_URL__: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __VITE_SUPABASE_ANON_KEY__: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __VITE_FRONTEND_URL__: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __VITE_STRIPE_PUBLIC_KEY__: string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defineEnv: any = {
  VITE_SUPABASE_URL: typeof __VITE_SUPABASE_URL__ !== 'undefined' ? __VITE_SUPABASE_URL__ : undefined,
  VITE_SUPABASE_ANON_KEY: typeof __VITE_SUPABASE_ANON_KEY__ !== 'undefined' ? __VITE_SUPABASE_ANON_KEY__ : undefined,
  VITE_FRONTEND_URL: typeof __VITE_FRONTEND_URL__ !== 'undefined' ? __VITE_FRONTEND_URL__ : undefined,
  VITE_STRIPE_PUBLIC_KEY: typeof __VITE_STRIPE_PUBLIC_KEY__ !== 'undefined' ? __VITE_STRIPE_PUBLIC_KEY__ : undefined,
};

// Coerce common string values to boolean
const toBool = (val: unknown, fallback = false): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  return fallback;
};

export const env = {
  // Prefer Vite-exposed vars, but also accept non-VITE names for flexibility
  VITE_SUPABASE_URL:
    viteEnv?.VITE_SUPABASE_URL
    ?? defineEnv?.VITE_SUPABASE_URL
    ?? viteEnv?.SUPABASE_URL
    ?? nodeEnv?.VITE_SUPABASE_URL
    ?? nodeEnv?.SUPABASE_URL
    ?? (isJest ? 'https://example.supabase.co' : undefined),
  VITE_SUPABASE_ANON_KEY:
    viteEnv?.VITE_SUPABASE_ANON_KEY
    ?? defineEnv?.VITE_SUPABASE_ANON_KEY
    ?? viteEnv?.SUPABASE_ANON_KEY
    ?? nodeEnv?.VITE_SUPABASE_ANON_KEY
    ?? nodeEnv?.SUPABASE_ANON_KEY
    ?? (isJest ? 'test_anon_key' : undefined),
  // Additional vars used in codebase
  VITE_BREVO_API_KEY: viteEnv?.VITE_BREVO_API_KEY ?? defineEnv?.VITE_BREVO_API_KEY ?? nodeEnv?.VITE_BREVO_API_KEY,
  VITE_FRONTEND_URL: viteEnv?.VITE_FRONTEND_URL ?? defineEnv?.VITE_FRONTEND_URL ?? nodeEnv?.VITE_FRONTEND_URL,
  VITE_STRIPE_PUBLIC_KEY: viteEnv?.VITE_STRIPE_PUBLIC_KEY ?? defineEnv?.VITE_STRIPE_PUBLIC_KEY ?? nodeEnv?.VITE_STRIPE_PUBLIC_KEY,
  // Master switch for all Stripe functionality. Defaults to false; see STRIPE_DISABLED.md
  // to re-enable. When false, Stripe Connect UI is hidden and payment pages are unrouted.
  STRIPE_ENABLED: toBool(
    viteEnv?.VITE_STRIPE_ENABLED ?? nodeEnv?.VITE_STRIPE_ENABLED,
    false,
  ),
  // Master switch for Survey/onboarding functionality. Defaults to false; see SURVEY_DISABLED.md
  // to re-enable. When false, survey forms are not loaded and InquirySettingsPage is unrouted.
  SURVEY_ENABLED: toBool(
    viteEnv?.VITE_SURVEY_ENABLED ?? nodeEnv?.VITE_SURVEY_ENABLED,
    false,
  ),
  // Whether email confirmation is required for signup. When false, hide confirmation page.
  AUTH_EMAIL_CONFIRM_ENABLED: toBool(
    viteEnv?.VITE_AUTH_EMAIL_CONFIRM_ENABLED ?? nodeEnv?.VITE_AUTH_EMAIL_CONFIRM_ENABLED,
    true,
  ),
};

export default env;
