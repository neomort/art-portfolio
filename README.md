Art Portfolio

> A personal art portfolio platform built with React, Supabase, and Vite. This project adapts the SplitSpace real estate marketplace for showcasing artwork and exhibitions.

> Security/RLS: See the Row Level Security model for `public.profiles` (authenticated-only read + JWT admin overrides) in docs/SYSTEM_ARCHITECTURE.md → Row Level Security (RLS).
> Link: ./docs/SYSTEM_ARCHITECTURE.md#row-level-security-rls

# Edge Function: mint-upload-url

This function mints signed upload URLs for property images and enforces per-user and per-IP rate limits. It also records an audit row per successful mint in `public.edge_rate_limits`.

## Required secrets

- `FRONTEND_URLS`: Comma-separated list of allowed origins (e.g., `https://your-prod.com,https://staging.your-prod.com`).
- `FRONTEND_URL`: Default origin fallback (e.g., `http://localhost:5173`).
- `MINT_UPLOAD_PER_MINUTE`: Max requests per minute per user/IP (default 30).
- `MINT_UPLOAD_PER_HOUR`: Max requests per hour per user/IP (default 200).

Set or update via Supabase CLI:

```bash
supabase secrets set \
  FRONTEND_URLS='https://your-prod.com,https://staging.your-prod.com' \
  FRONTEND_URL='http://localhost:5173' \
  MINT_UPLOAD_PER_MINUTE=30 \
  MINT_UPLOAD_PER_HOUR=200

supabase functions deploy mint-upload-url
```

## Behavior and limits

- Each invoke counts as 1 request, regardless of number of files in the payload.
- Limits apply per-user and per-IP in rolling windows (1 minute and 1 hour).
- On success, response contains `{ bucket, uploads: [{ path, token }, ...] }`.
- On limit breach, the function returns HTTP 429 with a JSON error body.

## Testing rate limits

Optionally lower limits temporarily to force 429:

```bash
supabase secrets set MINT_UPLOAD_PER_MINUTE=1 MINT_UPLOAD_PER_HOUR=5
supabase functions deploy mint-upload-url
```

Trigger two separate uploads within 60 seconds (from the app’s List or Manage flows). The second should return 429. Then restore real values and redeploy.

## Troubleshooting

- __CORS/Origin__: The function validates the `Origin` header. Ensure your domain(s) are present in `FRONTEND_URLS`. If not, you may see generic non-2xx errors in the client.
- __401 Authentication__: The function requires a valid bearer token; ensure the user is logged in and `supabase-js` is sending the session token.
- __400 Validation__: Files must be 10MB or less and one of the allowed MIME types: jpeg, png, webp, gif, heic, heif. Payload must include `propertyId` and a non-empty `files` array.
- __429 Too Many Requests__: Expected when exceeding configured limits. The UI surfaces a friendly message in both List and Manage pages.
- __500 Server Error__: Check Supabase Functions logs (Functions → Logs) for `mint-upload-url` errors.

## Audit and retention

The table `public.edge_rate_limits` stores audit rows for successful mints. A pg_cron job is scheduled to delete rows older than 30 days.

Verify the job (in SQL editor):

```sql
select jobid, jobname, schedule, command
from cron.job
where jobname = 'edge_rate_limits_cleanup_daily';
```

Manual check of recent activity:

```sql
select user_id, ip, function, created_at
from public.edge_rate_limits
where function = 'mint-upload-url'
order by created_at desc
limit 20;
```

## Logging (Frontend)

We use Winston for structured logging in the React app.

- Utility: `src/lib/logger.ts`
- Usage:

```ts
import { getLogger, withCorrelation } from '../lib/logger';

const log = getLogger({ page: 'ListPropertyPage' });
log.info('Starting submission', { images: images.length });

try {
  const { data, error } = await supabase.functions.invoke('mint-upload-url', { body });
  if (error) {
    const headers = (error as any)?.context?.response?.headers;
    const correlationId = (headers?.get ? headers.get('x-correlation-id') : headers?.['x-correlation-id']) || undefined;
    withCorrelation(log, correlationId).error('Mint failed', { status: (error as any)?.status, err: error });
  }
} catch (err) {
  log.error('Unhandled error', { err });
}
```

Notes:

- In development, logs are colorized and human-readable. In production, logs are JSON.
- Vite is configured with `vite-plugin-node-polyfills` to support Winston in the browser. Ensure dependencies are installed:
  - `npm i winston`
  - `npm i -D vite-plugin-node-polyfills`
- Prefer including contextual metadata (e.g., `page`, `propertyId`, `userId`) when creating a page-level logger.

## Correlation ID logging (Edge Functions) & API-only test

Our Edge Functions propagate a correlation ID and echo it back in responses for observability.

- Core example: `supabase/functions/refresh-stripe-status/index.ts`
  - A request-scoped `cid` is derived from `x-correlation-id` or `crypto.randomUUID()`.
  - Helpers like `json()` include `correlationId` in the response body and `X-Correlation-Id` header.
- Public echo endpoint for testing: `supabase/functions/echo-correlation/index.ts`
  - Config: `supabase/functions/echo-correlation/supabase.toml` with `[functions] verify_jwt = false`.
  - Returns 200 with JSON `{ ok: true, correlationId, method, path }` and sets `X-Correlation-Id`.

### Run API-only Playwright test (hosted Supabase)

Files:

- Test spec: `tests/smoke/correlation-id.spec.ts`
- API-only config: `tests/api.playwright.config.ts`

Environment:

- `SUPABASE_URL` e.g. `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY` (Settings → API → anon key)

Command:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<your_anon_key_here> \
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
./node_modules/.bin/playwright test "smoke/correlation-id.spec.ts" \
  --reporter=list \
  --config=tests/api.playwright.config.ts
```

Expected:

- HTTP 200 from `functions/v1/echo-correlation`
- Body `correlationId` matches the sent `x-correlation-id`
- Header `x-correlation-id` may be present (asserted optionally in the test)

### Run against local Supabase (optional)

Start local stack (requires Docker Desktop):

```bash
supabase start
```

Run the test:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
./node_modules/.bin/playwright test "smoke/correlation-id.spec.ts" \
  --reporter=list \
  --config=tests/api.playwright.config.ts
```

Notes:

- The echo endpoint is public; only the `apikey` header is required for hosted routing.
- Other functions (like `refresh-stripe-status`) may return 4xx for unauthenticated requests; the echo endpoint avoids that for reliable correlation testing.

## Visual compare: Owner vs Org Member (Percy)

We maintain a Percy visual spec that captures the same journey for two users in the same organization: the property owner (or org admin) and an org member. This helps detect gaps (e.g., payout panel visibility, approval/close controls).

Files:

- Spec: `tests/visual/org-users.spec.ts`
- Storage states creator: `tests/scripts/create-storage-states.mjs`

Prereqs:

- Two test users belonging to the same organization
- Storage states saved to `.auth/owner.json` and `.auth/member.json`

Create storage states (one-time or when tokens expire):

```bash
# Ensure the app is running at http://localhost:5173
# Then run (replace with your real creds)
BASE_URL=http://localhost:5173 \
OWNER_EMAIL='owner@example.com' OWNER_PASSWORD='ownerpass' \
MEMBER_EMAIL='member@example.com' MEMBER_PASSWORD='memberpass' \
node tests/scripts/create-storage-states.mjs
```

Two-build workflow for accurate Percy diffs:

We leverage SAME_NAME and ROLE env vars so Owner snapshots become the baseline and Member snapshots are compared against them.

1) Owner baseline build (approve it in Percy):

```bash
export PERCY_TOKEN=web_...your_token...
export VISUAL_BOOKING_ID=<booking_uuid>   # optional but recommended for determinism
# export VISUAL_INQUIRY_ID=<inquiry_uuid> # optional

SAME_NAME=1 ROLE=owner \
npx percy exec -- npx playwright test tests/visual/org-users.spec.ts --project=chromium -g "Owner"
```

Approve this build in Percy to set the baseline.

2) Member comparison build:

```bash
SAME_NAME=1 ROLE=member \
npx percy exec -- npx playwright test tests/visual/org-users.spec.ts --project=chromium -g "Member"
```

Percy will diff the Member snapshots (same names) against the approved Owner baselines.

Notes:

- SAME_NAME=1 causes both roles to snapshot with identical names (e.g., `Dashboard`, `Messages`).
- ROLE filters which block runs (`owner` or `member`). Omit ROLE to run both (useful for manual side-by-side, less useful for diffs).
- Use `VISUAL_BOOKING_ID`/`VISUAL_INQUIRY_ID` so both roles load the exact same booking/thread.
- If Percy can’t reach the app, ensure `npm run dev` is active or rely on the Playwright `webServer` in `playwright.config.ts`.
