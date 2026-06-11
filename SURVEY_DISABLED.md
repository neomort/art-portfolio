# Survey/Onboarding System Disabled

The SurveyJS onboarding system has been disabled for the art portfolio use case. This system was inherited from the splitspace project and is not needed for a simple art portfolio website.

## What Was Disabled

1. **NPM Dependencies Removed** (from `package.json`):
   - `survey-core` (^2.3.8)
   - `survey-creator-core` (^2.3.8)
   - `survey-creator-react` (^2.3.8)
   - `survey-react-ui` (^2.3.8)
   - These packages contributed ~1.5MB to the bundle size

2. **Source Files Excluded from Build** (in `tsconfig.app.json`):
   - `src/pages/InquirySettingsPage.tsx` - Survey form builder page
   - `src/types/survey-creator-core.d.ts` - Type shim for survey-creator-core

3. **Code Removed** (from `src/components/property/InquiryForm.tsx`):
   - Survey type definitions (SurveyModel, SurveyComponentType)
   - Survey state variables (_surveyJson, surveyModel, surveyData, SurveyComp)
   - Survey loading useEffect (dynamic imports of survey-core and survey-react-ui)
   - Survey data appending to inquiry messages
   - Survey component rendering in the form

4. **Routes Gated** (in `src/App.tsx`):
   - `InquirySettingsPage` import commented out
   - `/inquiry-settings` route commented out

5. **Feature Flag Added** (in `src/lib/env.ts`):
   - `SURVEY_ENABLED` flag added, defaults to `false`

## Why It Was Disabled

- **Bundle Size**: SurveyJS packages added ~1.5MB to the bundle
- **Complexity**: The survey system required complex dynamic imports and type shims
- **Irrelevant**: Art portfolio doesn't need organization-specific inquiry forms
- **Database**: No `organization_inquiry_forms` table in art portfolio schema
- **Edge Function**: Survey loading relied on `public-property-data` edge function which is unused

## How to Re-enable

If you need to restore the survey/onboarding system in the future:

1. **Restore NPM Dependencies**:
   ```bash
   npm install survey-core@2.3.8 survey-creator-core@2.3.8 survey-creator-react@2.3.8 survey-react-ui@2.3.8
   ```

2. **Remove Exclusions from `tsconfig.app.json`**:
   ```json
   "exclude": [
     "supabase/",
     "src/pages/PaymentPage.tsx",
     "src/pages/PaymentConfirmationPage.tsx",
     "src/pages/PaymentDebugPage.tsx",
     "src/pages/StripeTestPage.tsx",
     "src/components/payment/",
     "src/__tests__/components/payment/",
     "src/__mocks__/stripe-js.ts"
     // Remove these lines:
     // "src/pages/InquirySettingsPage.tsx",
     // "src/types/survey-creator-core.d.ts"
   ]
   ```

3. **Restore Type Shim**:
   - Recreate `src/types/survey-creator-core.d.ts` with the survey-creator-core type definitions

4. **Restore Code in `InquiryForm.tsx`**:
   - Restore survey type definitions
   - Restore survey state variables
   - Restore survey loading useEffect
   - Restore survey data appending to messages
   - Restore Survey component rendering

5. **Restore Route in `App.tsx`**:
   - Uncomment `import InquirySettingsPage from './pages/InquirySettingsPage';`
   - Uncomment `<Route path="/inquiry-settings" element={<InquirySettingsPage />} />`

6. **Enable Feature Flag**:
   - Set `VITE_SURVEY_ENABLED=true` in your environment variables
   - Or set it in `vite.config.ts` define section

7. **Database Requirements** (if needed):
   - Ensure `organization_inquiry_forms` table exists
   - Ensure `public-property-data` edge function is deployed and working

## Related Files

- `package.json` - NPM dependencies
- `tsconfig.app.json` - TypeScript build exclusions
- `src/lib/env.ts` - Feature flag definition
- `src/App.tsx` - Route gating
- `src/components/property/InquiryForm.tsx` - Survey form rendering
- `src/pages/InquirySettingsPage.tsx` - Survey builder page (excluded)
- `src/types/survey-creator-core.d.ts` - Type shim (deleted)

## Date Disabled

May 18, 2026
