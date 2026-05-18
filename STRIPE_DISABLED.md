# Stripe Functionality — Disabled

Stripe payment processing has been disabled in this codebase because the art
portfolio does not currently sell artwork through the site. Source code is
preserved in case it is revived later.

## What is disabled

- **Routes removed** from `src/App.tsx`:
  - `/payment/:id`
  - `/payment/:id/confirmation`
  - `/stripe-test`
  - `/payment-debug`
- **Source files excluded** from TypeScript build (see `tsconfig.app.json`):
  - `src/pages/PaymentPage.tsx`
  - `src/pages/PaymentConfirmationPage.tsx`
  - `src/pages/PaymentDebugPage.tsx`
  - `src/pages/StripeTestPage.tsx`
  - `src/components/payment/`
  - `src/__tests__/components/payment/`
  - `src/__mocks__/stripe-js.ts`
- **UI sections gated** behind `env.STRIPE_ENABLED` (default false):
  - `ProfilePage.tsx`: Payment Provider card and Payout Details card
  - `ListPropertyPage.tsx`: Stripe Connect verification on publish
- **npm packages removed**:
  - `@stripe/stripe-js`
  - `@stripe/react-stripe-js`
- **Supabase edge functions left in place** at `supabase/functions/` but are
  not deployed by default. They will only run if explicitly deployed via
  `supabase functions deploy`.

## What is preserved

All source code is intact in the repository. To re-enable:

1. **Reinstall deps**:
   ```bash
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```
2. **Remove the `exclude` entries** for payment files in `tsconfig.app.json`.
3. **Uncomment the page imports and routes** in `src/App.tsx`:
   - `PaymentPage`, `PaymentConfirmationPage`, `StripeTestPage`, `PaymentDebugPage`
4. **Set the feature flag** in your environment:
   ```
   VITE_STRIPE_ENABLED=true
   VITE_STRIPE_PUBLIC_KEY=pk_live_...
   ```
5. **Configure Supabase secrets** for the edge functions:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
6. **Deploy the edge functions**:
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy create-express-account-link
   supabase functions deploy reconcile-booking-payment
   supabase functions deploy export-payout-summary
   ```
7. **Verify the database schema** still has the required columns
   (`organizations.stripe_account_id`, `charges_enabled`, `payouts_enabled`,
   `payment_provider`).

That's it — the original integration should light back up.
