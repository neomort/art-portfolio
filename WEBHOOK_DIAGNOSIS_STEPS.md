# 🔧 Webhook Diagnosis & Fix Guide

## Step 1: Check Webhook Deliveries in Stripe

1. **Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)**
2. **Click on your webhook endpoint**
3. **Click "Recent deliveries" tab**
4. **Look for deliveries from when you made your payment**

### What to look for:
- ✅ **200 status code** = Webhook working
- ❌ **4xx/5xx status codes** = Webhook failing
- ❌ **No recent deliveries** = Stripe not sending webhooks

---

## Step 2: Test Webhook Configuration

Visit your app at: `/webhook-debug`

1. **Click "Test Webhook"**
2. **Should return**: `{"received": true}`
3. **If it fails**, note the error message

---

## Step 3: Sync Payment Status (Quick Fix)

While we fix the webhook, you can manually sync your booking:

1. **Go to**: `/webhook-debug` in your app
2. **Find your pending booking**
3. **Click "Sync from Stripe"** button
4. **This will check Stripe and update your booking status**

---

## Step 4: Fix Webhook Configuration

### A. Verify Webhook URL
Your webhook URL should be:
```
https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook
```

### B. Check Required Events
In Stripe webhook settings, ensure these events are selected:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed` 
- ✅ `payment_intent.canceled`

### C. Get Webhook Secret
1. **In Stripe webhook settings**, click "Reveal" on signing secret
2. **Copy the secret** (starts with `whsec_`)

### D. Update Supabase Environment Variables
1. **Go to Supabase Dashboard** → Settings → Environment Variables
2. **Add/Update**: `STRIPE_WEBHOOK_SECRET` = `whsec_your_secret_here`
3. **Add/Update**: `FRONTEND_URL` = `https://splitspace.com`

---

## Step 5: Test the Fix

1. **Go back to `/webhook-debug`**
2. **Click "Test Webhook" again**
3. **Should now return**: `{"received": true}`
4. **Make a small test payment** with card `4242 4242 4242 4242`
5. **Verify booking status updates automatically**

---

## Quick Commands for Immediate Relief

### Option A: Manual Sync
- Go to `/webhook-debug`
- Click "Sync from Stripe" on your pending booking

### Option B: Manual Mark as Paid
- Go to `/webhook-debug` 
- Click "Mark Paid" if you've confirmed payment in Stripe

### Option C: Check Deployment Status
- Go to `/payment-debug`
- Run configuration tests to verify everything is set up correctly

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No webhook deliveries in Stripe | Check webhook URL and events |
| Webhook returning 401/403 | Update webhook secret in Supabase |
| Webhook returning 500 | Check Supabase function logs |
| Multiple webhook endpoints | Disable old ones, keep only the correct URL |
| Wrong domain in emails | Update FRONTEND_URL in Supabase environment variables |

---

## Need Help?

If the webhook is still not working after these steps:

1. **Check Supabase Function Logs**:
   - Supabase Dashboard → Functions → stripe-webhook → Logs
   
2. **Use the debug tools**:
   - `/webhook-debug` - Test webhook and sync payments
   - `/stripe-test` - Test Stripe configuration
   - `/payment-debug` - Comprehensive payment system testing

The most important immediate fix is Step 3 - you can sync your payment status right now while we resolve the webhook issue.