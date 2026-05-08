# Edge Function Deployment Guide

## Issue
The `send-notification` edge function is not deployed to your Supabase project, causing "Failed to fetch" errors when trying to send notifications.

## Solution
You need to manually deploy the edge function to your Supabase project. Here's how:

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref coandrdclvjebyoadoau
   ```

4. **Deploy the edge function**:
   ```bash
   supabase functions deploy send-notification
   ```

### Option 2: Manual Deployment via Supabase Dashboard

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard/project/coandrdclvjebyoadoau

2. **Navigate to Edge Functions**:
   - Click on "Edge Functions" in the left sidebar
   - Click "Create a new function"

3. **Create the function**:
   - Function name: `send-notification`
   - Copy the entire content from `supabase/functions/send-notification/index.ts`
   - Paste it into the function editor
   - Click "Deploy function"

4. **Set Environment Variables**:
   - In the Edge Functions section, click on your `send-notification` function
   - Go to the "Settings" tab
   - Add the following environment variables:
     - `BREVO_API_KEY`: (Get this from your Brevo account)
     - `SUPABASE_URL`: `https://coandrdclvjebyoadoau.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY`: (Get this from your Supabase Dashboard → Settings → API → service_role key)
     - `FRONTEND_URL`: `https://splitspace.com`

### Verification

After deployment, test the function by:

1. Going to the webhook debug page: `/webhook-debug`
2. Clicking "Test Booking Confirmation"
3. The notification should send successfully

### Troubleshooting

If you still get errors after deployment:

1. **Check function logs**:
   - Go to Supabase Dashboard → Edge Functions → send-notification → Logs
   - Look for any deployment or runtime errors

2. **Verify environment variables**:
   - Ensure all required environment variables are set in the function settings

3. **Check function URL**:
   - The function should be accessible at: `https://coandrdclvjebyoadoau.supabase.co/functions/v1/send-notification`

## Next Steps

Once the edge function is deployed, your notification system should work properly. The webhook debug page will be able to send test notifications successfully.