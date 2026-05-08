# 🔧 Complete Stripe Webhook Setup Guide

## 🎯 Your Webhook URL:
```
https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook
```

## 📋 Step-by-Step Configuration:

### Step 1: Open Stripe Dashboard
1. Go to [**Stripe Dashboard**](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"** (or edit existing one)

### Step 2: Configure Endpoint
**Endpoint URL:** 
```
https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook
```

**Listen to:** Select **"Events on your account"**

### Step 3: Select Events (CRITICAL!)
Make sure these events are checked:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed` 
- ✅ `payment_intent.canceled`

### Step 4: Save and Get Signing Secret
1. Click **"Add endpoint"**
2. Click on your newly created endpoint
3. In **"Signing secret"** section, click **"Reveal"**
4. Copy the secret (starts with `whsec_`)

### Step 5: Verify Supabase Environment Variable
1. Go to **Supabase Dashboard** → **Settings** → **Environment Variables**
2. Confirm `STRIPE_WEBHOOK_SECRET` matches the secret from Step 4
3. Also add `FRONTEND_URL=https://splitspace.com`
4. If any values are different, update them and **save**

## 🧪 Test Your Setup:

### Method 1: Test from Stripe Dashboard
1. In Stripe → **Developers** → **Webhooks**
2. Click your webhook endpoint
3. Click **"Send test webhook"**
4. Select **"payment_intent.succeeded"**
5. Click **"Send test webhook"**

### Method 2: Test from Your App
1. Go to `/webhook-debug` in your app
2. Click **"Test Webhook"** 
3. Should return success ✅

### Method 3: Real Payment Test
1. Create a test booking
2. Pay with `4242 4242 4242 4242`
3. Check if status automatically updates to "Confirmed"

## 🚨 Common Issues:

### Issue 1: Wrong URL
❌ **Wrong:** `https://coandrdclvjebyoadoau.supabase.co/functions/v1/webhook`
✅ **Correct:** `https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook`

### Issue 2: Missing Events
Make sure you selected the payment_intent events in Step 3

### Issue 3: Wrong Secret
The webhook secret in Supabase must EXACTLY match the one from Stripe

### Issue 4: Multiple Endpoints
If you have multiple webhook endpoints in Stripe, disable the old ones

## 🔍 Troubleshooting:

### Check Stripe Webhook Logs:
1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click your endpoint
3. Check **"Recent deliveries"** for errors

### Check Supabase Function Logs:
1. **Supabase Dashboard** → **Functions** → **stripe-webhook**
2. Click **"Logs"** tab
3. Look for recent webhook calls

## ✅ Success Indicators:
- Stripe webhook shows **"200"** responses
- Supabase logs show **"Payment intent succeeded"**
- Bookings automatically change from "Payment Pending" to "Confirmed"

## 🛟 Quick Fix (While Testing):
Until webhooks work automatically, you can:
1. Use **"Sync from Stripe"** button on `/webhook-debug` page
2. This manually checks Stripe and updates your booking status