# 🚨 Check Stripe Webhook Deliveries

## Step 1: Check Recent Webhook Deliveries
1. **Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)**
2. **Click on your webhook endpoint**
3. **Click "Recent deliveries" or "Logs" tab**
4. **Look for deliveries from the last hour**

### What to Look For:
- ✅ **Recent deliveries with 200 status** = Webhooks working
- 🔴 **Recent deliveries with 4xx/5xx errors** = Webhook failing  
- ❌ **No recent deliveries** = Stripe not sending webhooks

## Step 2: If You See NO Recent Deliveries

This means **Stripe isn't sending webhooks**. Check:

### A. Webhook Events Configuration
1. **In your webhook settings**, verify these events are selected:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`

### B. Webhook Status
1. **Check if webhook is "Enabled"**
2. **Look for any warnings or errors**

### C. Test Mode vs Live Mode
1. **Are you testing with test cards?** (`4242 4242 4242 4242`)
2. **Is your webhook configured for "test mode"?**

## Step 3: If You See FAILED Deliveries

Click on a failed delivery and check the error:
- **401/403 errors** = Authentication issue (webhook secret)
- **500 errors** = Our function is crashing
- **Timeout errors** = Function taking too long

## Step 4: Manual Test Right Now

1. **Create a new $1 test booking**
2. **Pay with `4242 4242 4242 4242`**
3. **Immediately check Stripe webhook deliveries**
4. **This will show us exactly what's happening**

---

## 🛠️ Quick Fix Options:

### Option A: Re-create the Webhook
Sometimes webhooks get "stuck". Try:
1. **Delete current webhook endpoint**
2. **Create a new one with same URL**
3. **Select the events again**

### Option B: Use the Debug Page
Go to `/webhook-debug` and use:
- **"Sync from Stripe"** for each pending booking
- This manually checks Stripe and updates status

### Option C: Check Supabase Function Logs
1. **Supabase Dashboard → Functions → stripe-webhook → Logs**
2. **Look for entries during your payment time**
3. **Should see "Webhook received" if Stripe is calling**