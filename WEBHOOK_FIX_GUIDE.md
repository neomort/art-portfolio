# 🔧 Webhook Configuration Fix Guide

## ✅ What We Know:
- ✅ Webhook endpoint is reachable
- ❌ Missing signature or endpoint secret

## 🛠️ Step-by-Step Fix:

### Step 1: Check Supabase Environment Variables
1. Go to **Supabase Dashboard** → **Settings** → **Environment Variables**
2. Look for `STRIPE_WEBHOOK_SECRET`
3. If missing, add it with the value from Stripe

### Step 2: Get Webhook Secret from Stripe
1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. In the **Signing secret** section, click **"Reveal"**
4. Copy the secret (starts with `whsec_`)

### Step 3: Add Secret to Supabase
1. **Supabase Dashboard** → **Settings** → **Environment Variables**
2. Add new variables:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_xxxxxxxxxxxxx` (your actual secret)
   - **Name**: `FRONTEND_URL`
   - **Value**: `https://splitspace.com`
3. **Save**

### Step 4: Verify Webhook URL in Stripe
Your webhook URL should be:
```
https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook
```

### Step 5: Verify Frontend URL
Make sure the frontend URL is set correctly:
1. In your `.env` file, set `VITE_FRONTEND_URL=https://splitspace.com`
2. In Supabase environment variables, set `FRONTEND_URL=https://splitspace.com`

### Step 5: Check Events in Stripe Webhook
Make sure these events are selected:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `payment_intent.canceled`

## 🧪 Test After Fix:
1. Click **"Test Webhook"** again on debug page
2. Should return `{"received":true}` instead of error
3. Try **"Sync from Stripe"** on pending bookings

## 🚀 Quick Fix for Current Bookings:
While fixing webhook, you can:
1. Click **"Sync from Stripe"** on each pending booking
2. Or click **"Mark Paid"** if you've confirmed payment in Stripe Dashboard