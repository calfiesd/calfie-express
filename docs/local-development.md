# Local Development

This project is actively developed on Windows with local PostgreSQL, Prisma, Stripe, and carrier credentials.

## Recommended local stack

- Node.js 20.x
- PostgreSQL
- Stripe CLI
- optional: Git for branch/commit work

## Local app URL

- App URL: `http://127.0.0.1:3010`

## 1. Install dependencies

```powershell
npm install
```

## 2. Fill in `.env.local`

Configure at least:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL="http://127.0.0.1:3010"`
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `UPS_ACCOUNT_NUMBER`
- `UPS_API_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional but already supported:

- `UPS_ACCOUNT_NUMBERS`
- `ALLOW_LIVE_LABEL_PURCHASE`
- `ALLOW_FEDEX_LABEL_PURCHASE`
- `FEDEX_API_KEY`
- `FEDEX_SECRET_KEY`
- `FEDEX_ACCOUNT_NUMBER`
- `FEDEX_CHILD_KEY`
- `FEDEX_CHILD_SECRET`
- `FEDEX_API_BASE_URL`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`

## 3. Generate Prisma client and run migrations

For a fresh local database:

```powershell
npx prisma generate
npx prisma migrate dev
```

For an existing database that should match the checked-in schema:

```powershell
npx prisma generate
npx prisma migrate deploy
```

## 4. Start the app

Development:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Production-style verification:

```powershell
npm run build
npm run start -- --port 3010
```

## 5. Stripe webhooks

In a second terminal:

```powershell
stripe login
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

Copy the printed signing secret into:

- `STRIPE_WEBHOOK_SECRET`

## 6. Standard verification commands

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## 7. Current working areas

These are already implemented locally:

- customer auth
- live UPS quotes and live UPS purchase
- FedEx live quotes
- wallet and ledger flows
- saved payment method setup
- saved addresses
- quote history
- orders and refunds/voids
- UPS batch purchase and history
- admin customer management
- admin batch history
- admin carrier adjustments

## 8. Useful local smoke-test pages

- `/login`
- `/dashboard`
- `/wallet`
- `/payments`
- `/addresses`
- `/quotes`
- `/orders`
- `/adjustments`
- `/batch/ups`
- `/batch/history`
- `/admin`
- `/admin/customers`
- `/admin/orders`
- `/admin/batches`
- `/admin/adjustments`

## 9. Known local note

`npm run build` uses webpack intentionally. In this workspace, Turbopack hit a Windows Prisma junction issue, so webpack is the stable path.
