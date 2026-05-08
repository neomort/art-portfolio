# Testing Your Stripe Webhook

## Method 1: Send Test Webhook from Stripe Dashboard (Recommended)

1. **Go to Stripe Dashboard** → Developers → Webhooks
2. **Click on your webhook endpoint**
3. **Click "Send test webhook"**
4. **Select event type: `payment_intent.succeeded`**
5. **Click "Send test webhook"**

### What to Check:
- **Supabase Logs**: Go to Supabase → Functions → stripe-webhook → Logs
- **Look for**: "Webhook received", "Payment intent succeeded", etc.

## Method 2: Make a Test Payment

1. **Go to your app and create a booking**
2. **Use Stripe test card**: `4242 4242 4242 4242`
3. **Use any future expiry date** (e.g., 12/34)
4. **Use any 3-digit CVC** (e.g., 123)
5. **Complete the payment**

### Expected Flow:
1. Payment completes → Stripe sends webhook
2. Webhook updates booking status in database
3. User sees "Confirmed" status

## Method 3: Check Webhook Logs

**In Supabase Dashboard:**
1. Go to **Functions** → **stripe-webhook** → **Logs**
2. Look for recent entries
3. Check for errors or success messages

## Troubleshooting

### If No Logs Appear:
- ❌ Webhook URL might be wrong
- ❌ Webhook might not be enabled
- ❌ Events might not be selected

### If Logs Show Errors:
- Check the error message in logs
- Verify webhook signing secret is correct
- Check if booking exists in database

### Quick Test Commands:
```bash
# Test webhook endpoint is reachable
curl -X POST https://coandrdclvjebyoadoau.supabase.co/functions/v1/stripe-webhook

# Should return: Missing signature or endpoint secret
```

## What Each Log Message Means:

- ✅ **"Webhook received"** = Webhook endpoint is working
- ✅ **"Payment intent succeeded"** = Stripe event parsed correctly
- ✅ **"Found booking"** = Database lookup successful
- ✅ **"Successfully updated booking"** = Status updated in database
- ❌ **"Missing signature"** = Webhook secret issue
- ❌ **"Failed to find booking"** = Database lookup failed

## Environment Variables Check

Make sure these environment variables are set correctly:

1. In your `.env` file:
   - `VITE_FRONTEND_URL=https://splitspace.com`

2. In Supabase Dashboard → Settings → Environment Variables:
   - `FRONTEND_URL=https://splitspace.com`
   - `STRIPE_WEBHOOK_SECRET=whsec_xxxxx` (your actual secret)
   - `STRIPE_SECRET_KEY=sk_xxxxx` (your actual key)