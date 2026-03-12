# CALFIE EXPRESS

This repository contains:

- a legacy static prototype in `index.html`, `styles.css`, and `app.js`
- the active product in `src/` as a Next.js + Prisma + Stripe shipping portal

## Current product state

The app is now a working multi-surface shipping portal with:

- customer registration and login
- per-customer pricing profiles
- per-customer UPS and FedEx quote access
- per-customer UPS and FedEx purchase access
- live UPS quotes and live UPS label purchase
- FedEx live quote support
- FedEx purchase path behind the live-purchase safety gate
- wallet balance, top-up, wallet checkout, refunds, and admin wallet adjustments
- saved recipient address book
- UPS batch CSV preview, purchase, duplicate blocking, retry flow, and batch history
- customer quote history with dashboard reload
- customer order history and order detail
- customer payment settings for saved default cards
- customer account settings
- customer carrier-adjustment history
- admin customer management
- admin order filters
- admin batch history
- admin carrier-adjustment workflow
- Stripe checkout, setup intents, and webhooks
- Postmark-backed email notifications when configured

## Verified local checks

The current app has been verified locally with:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Note: production build currently uses `next build --webpack` because Turbopack hit a Windows + Prisma junction issue in this workspace.

## Important local files

- `.env.local`: real local secrets and config
- `.env.local.example`: clean local template
- `.env.example`: generic environment template
- `docs/local-development.md`: local setup and smoke-test notes
- `docs/deployment-vercel.md`: deployment checklist
- `prisma/schema.prisma`: current database schema

## Core app areas

- `src/app/login/page.tsx`: customer auth
- `src/app/dashboard/page.tsx`: main shipping dashboard
- `src/app/wallet/page.tsx`: wallet funding and ledger
- `src/app/payments/page.tsx`: saved-card settings
- `src/app/addresses/page.tsx`: address book
- `src/app/quotes/page.tsx`: quote history
- `src/app/orders/page.tsx`: order history
- `src/app/adjustments/page.tsx`: customer adjustment history
- `src/app/batch/ups/page.tsx`: UPS batch upload
- `src/app/batch/history/page.tsx`: customer batch history
- `src/app/admin/page.tsx`: admin overview
- `src/app/admin/customers/page.tsx`: admin customer management
- `src/app/admin/orders/page.tsx`: admin orders
- `src/app/admin/batches/page.tsx`: admin batches
- `src/app/admin/adjustments/page.tsx`: admin adjustment queue

## Key backend areas

- `src/app/api/quotes/route.ts`: carrier quote creation + quote persistence
- `src/app/api/orders/route.ts`: order draft creation
- `src/app/api/orders/complete/route.ts`: checkout completion
- `src/app/api/wallet/*`: wallet flows
- `src/app/api/admin/adjustments/*`: admin adjustment actions
- `src/app/api/payments/*`: Stripe payment/setup routes
- `src/app/api/webhooks/stripe/route.ts`: Stripe webhook processing
- `src/lib/orders/fulfillment.ts`: shared post-payment fulfillment
- `src/lib/payments/stripe.ts`: Stripe customer/payment helpers
- `src/lib/wallet.ts`: wallet ledger logic
- `src/lib/adjustments.ts`: carrier adjustment workflow
- `src/lib/quotes.ts`: quote history helpers
- `src/lib/batch-purchases.ts`: batch history helpers

## Environment notes

Primary variables in active use include:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `UPS_ACCOUNT_NUMBER`
- `UPS_ACCOUNT_NUMBERS`
- `UPS_API_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ALLOW_LIVE_LABEL_PURCHASE`
- `ALLOW_FEDEX_LABEL_PURCHASE`
- `FEDEX_API_KEY`
- `FEDEX_SECRET_KEY`
- `FEDEX_ACCOUNT_NUMBER`
- `FEDEX_API_BASE_URL`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`

## Still realistically left

The biggest remaining production-grade tasks are:

- durable label storage instead of carrier/demo URLs only
- final FedEx live purchase rollout and production validation
- deployment hardening and production runbook cleanup
- better operational reporting and reconciliations
- docs cleanup beyond the core setup files
