# Vercel Deployment Checklist

This is the simplest first production path for CALFIE EXPRESS.

## Recommended stack

- Hosting: Vercel
- Database: Neon PostgreSQL
- Payments: Stripe
- Carrier: UPS first, FedEx after production validation
- Email: Postmark when sender/domain are ready

## Before deployment

Confirm locally:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Also confirm your key flows:

- customer registration/login
- live UPS quote
- live UPS purchase
- wallet top-up
- wallet pay-for-label
- UPS batch preview and purchase
- Stripe webhook fulfillment
- admin customer management
- admin adjustment workflow
- admin launch readiness page

## Create production services

### 1. Neon

- create a Neon PostgreSQL database
- copy the production `DATABASE_URL`

### 2. Vercel

- import the repo into Vercel
- keep framework as Next.js
- use Node 20

## Production environment variables

Configure these in Vercel:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_NAME=CALFIE EXPRESS`
- `NEXT_PUBLIC_APP_URL=https://your-project.vercel.app`
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `UPS_ACCOUNT_NUMBER`
- `UPS_ACCOUNT_NUMBERS`
- `UPS_API_BASE_URL=https://onlinetools.ups.com`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ALLOW_LIVE_LABEL_PURCHASE`
- `ALLOW_FEDEX_LABEL_PURCHASE`
- `LABEL_STORAGE_BACKEND=vercel_blob`
- `BLOB_READ_WRITE_TOKEN`

Configure these when ready:

- `FEDEX_API_KEY`
- `FEDEX_SECRET_KEY`
- `FEDEX_ACCOUNT_NUMBER`
- `FEDEX_CHILD_KEY`
- `FEDEX_CHILD_SECRET`
- `FEDEX_API_BASE_URL=https://apis.fedex.com`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`

## Database migration

After the first deployment, run:

```powershell
npx prisma migrate deploy
```

Then regenerate client if needed:

```powershell
npx prisma generate
```

## Stripe webhook

Create a production webhook endpoint:

- `https://your-project.vercel.app/api/webhooks/stripe`

Subscribe at least to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy the production signing secret into:

- `STRIPE_WEBHOOK_SECRET`

## First production smoke test

1. Create a customer account.
2. Save a default card.
3. Request a live UPS quote.
4. Create an order draft.
5. Complete payment.
6. Confirm:
   - order row exists
   - webhook returns `200`
   - tracking number saved
   - label available on order detail
   - wallet page loads
   - admin pages load

## Launch-readiness review

Before enabling broad customer traffic, open:

- `/admin/launch`
- `/admin/carriers`
- `/admin/reconciliation`

Use these pages to confirm:

- no blocked readiness items remain
- UPS production purchase is enabled only when intended
- FedEx purchase stays guarded until production drills pass
- wallet liability and open adjustment exposure are understood

## Important caveat

If `LABEL_STORAGE_BACKEND` remains `local`, labels are written under `public/stored-labels/`.
That is acceptable for local or single-instance operation, but real multi-instance production should use Vercel Blob.

## After launch

Recommended next production hardening tasks:

- enable Postmark and verify customer emails
- validate FedEx production purchase flow before enabling broadly
- move labels to durable storage
- add backup/reconciliation runbooks
- create clean commits and release notes from the current branch state
