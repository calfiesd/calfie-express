# Vercel Deployment Checklist

This is the recommended first production path for CALFIE EXPRESS.

## Recommended stack

- Hosting: Vercel
- Database: Neon PostgreSQL
- Payments: Stripe
- Carrier: UPS
- Email: Postmark later, once a domain is ready

## Why this path

- Vercel is the simplest official deployment target for a Next.js app.
- Neon works cleanly with Prisma/PostgreSQL.
- You can launch first on a `*.vercel.app` URL and connect your custom domain later.

## Before you deploy

1. Make sure local webhooks and live UPS purchases are already working.
2. Upgrade local packages with:
   - `npm install`
3. Confirm your local app still starts with:
   - `npm run dev -- --hostname 127.0.0.1 --port 3010`
4. Commit the project to Git.
5. Push to GitHub.

## Create production services

### 1. Create a Neon database

- Create a new Neon project.
- Copy the production `DATABASE_URL`.

### 2. Create a Vercel project

- Import the GitHub repository into Vercel.
- Keep the framework as Next.js.
- Do not add a custom domain yet unless you already bought one.

## Production environment variables

Add these in Vercel Project Settings -> Environment Variables.

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_NAME=CALFIE EXPRESS`
- `NEXT_PUBLIC_APP_URL=https://your-project.vercel.app`
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `UPS_ACCOUNT_NUMBER`
- `UPS_API_BASE_URL=https://onlinetools.ups.com`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- later: `POSTMARK_SERVER_TOKEN`
- later: `POSTMARK_FROM_EMAIL`

## Production database migration

After the first deployment, run Prisma migration against the production database.

Use a machine where `npm` works and point `DATABASE_URL` at the Neon production database, then run:

```powershell
npx prisma migrate deploy
```

## Stripe production webhook

After Vercel gives you the production URL, create a Stripe webhook endpoint for:

- `https://your-project.vercel.app/api/webhooks/stripe`

Subscribe at least to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Then copy the Stripe production webhook signing secret into Vercel as:

- `STRIPE_WEBHOOK_SECRET`

## First production test

1. Create a customer account on the Vercel URL.
2. Request a live UPS quote.
3. Create an order draft.
4. Complete a Stripe test-mode payment if you are still in test mode.
5. Confirm:
   - order row saved in database
   - webhook returns `200`
   - tracking number saved
   - label available on the order detail page

## After the custom domain is purchased

1. Connect the domain in Vercel.
2. Update:
   - `NEXT_PUBLIC_APP_URL`
   - Stripe webhook endpoint URL
3. If you enable email, verify your sender/domain in Postmark.
4. Set:
   - `POSTMARK_SERVER_TOKEN`
   - `POSTMARK_FROM_EMAIL`

## Recommended next production tasks

- Add admin customer management
- Add label void/refund flow
- Store labels in durable object/file storage
- Add FedEx as phase 2