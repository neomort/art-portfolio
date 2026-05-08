# 🔄 Complete Stripe Reconfiguration Guide

## Step 1: Update Environment Variables

### A. Get Your New Stripe Keys
1. **Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)**
2. **Copy your Publishable key** (starts with `pk_test_` or `pk_live_`)
3. **Copy your Secret key** (starts with `sk_test_` or `sk_live_`)

### B. Update Your Local Environment
Update your `.env` file with the new keys:

```env
VITE_STRIPE_PUBLIC_KEY=pk_test_your_new_publishable_key_here
```

### C. Update Supabase Environment Variables
1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Navigate to:** Settings → Environment Variables
3. **Update or add these variables:**
   - `STRIPE_SECRET_KEY` = `sk_test_your_new_secret_key_here`
   - `STRIPE_WEBHOOK_SECRET` = (we'll get this in Step 2)
   - `FRONTEND_URL` = `https://splitspace.com`

## Step 2: Configure Webhook Endpoint

### A. Delete Old Webhook (if exists)
1. **Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)**
2. **Delete any existing webhook endpoints**

### B. Create New Webhook
1. **Click "Add endpoint"**
2. **Endpoint URL:** `https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook`
3. **Listen to:** Events on your account
4. **Select these events:**
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
5. **Click "Add endpoint"**

### C. Get Webhook Secret
1. **Click on your newly created webhook**
2. **In "Signing secret" section, click "Reveal"**
3. **Copy the secret** (starts with `whsec_`)
4. **Add to Supabase Environment Variables:**
   - `STRIPE_WEBHOOK_SECRET` = `whsec_your_webhook_secret_here`

## Step 3: Test Your Configuration

### A. Test Environment Variables
1. **Restart your development server** (`npm run dev`)
2. **Go to `/stripe-test` in your app**
3. **Click "Run Stripe Tests"**
4. **Verify all tests pass** ✅

### B. Test Webhook
1. **Go to `/webhook-debug` in your app**
2. **Click "Test Webhook"**
3. **Should return:** `{"received": true}`

### C. Test Payment Flow
1. **Create a test booking**
2. **Use test card:** `4242 4242 4242 4242`
3. **Any future expiry date:** `12/34`
4. **Any CVC:** `123`
5. **Complete payment**
6. **Verify booking status changes to "Confirmed"**

## Step 4: Verify Everything Works

### ✅ Checklist:
- [ ] New Stripe keys added to `.env`
- [ ] New Stripe secret key in Supabase
- [ ] New webhook endpoint created
- [ ] Webhook secret in Supabase
- [ ] Development server restarted
- [ ] Stripe tests pass
- [ ] Webhook test passes
- [ ] Test payment completes successfully

## Common Issues & Solutions

### Issue 1: "Invalid API Key"
- **Solution:** Double-check you copied the correct keys
- **Verify:** Keys start with `pk_test_` and `sk_test_` for test mode

### Issue 2: "Webhook signature verification failed"
- **Solution:** Ensure webhook secret matches exactly
- **Check:** No extra spaces or characters when copying

### Issue 3: "Environment variables not updating"
- **Solution:** Restart development server after changing `.env`
- **For Supabase:** Changes are immediate, no restart needed

### Issue 4: "Payment intent creation fails"
- **Solution:** Check Supabase function logs
- **Verify:** All environment variables are set correctly

## Testing Commands

```bash
# Restart development server
npm run dev

# Test webhook endpoint directly
curl -X POST https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook

# Should return: Missing signature or endpoint secret (this is expected)
```

## Next Steps After Configuration

1. **Test with real payments** (if using live keys)
2. **Update any hardcoded references** to old Stripe account
3. **Test webhook deliveries** in Stripe Dashboard
4. **Monitor Supabase function logs** for any errors

---

## 🆘 If You Need Help

1. **Check Supabase Function Logs:**
   - Supabase Dashboard → Functions → create-payment-intent → Logs
   - Look for authentication or Stripe API errors

2. **Check Stripe Webhook Logs:**
   - Stripe Dashboard → Webhooks → Your endpoint → Recent deliveries
   - Look for failed deliveries or error responses

3. **Use Debug Pages:**
   - `/stripe-test` - Tests configuration
   - `/webhook-debug` - Tests webhook and syncs payments