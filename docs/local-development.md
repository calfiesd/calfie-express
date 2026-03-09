# Local Development

You do not need a domain name yet.

Use local development for phase 1:

- App URL: `http://127.0.0.1:3010`
- Database: local PostgreSQL
- Stripe webhook testing: Stripe CLI forwarding to localhost
- Carrier integration: UPS first

## Files already prepared

- `.env.local`: fill this in with your real local secrets
- `.env.local.example`: clean copy of the same template
- `.gitignore`: ignores `.env.local` so your secrets stay local

## 1. Install prerequisites

Install these on your Windows machine:

- Node.js LTS
- PostgreSQL
- Stripe CLI

## 2. Fill in `.env.local`

Open `.env.local` and replace the placeholder values with:

- UPS client ID
- UPS client secret
- UPS account number
- Stripe secret key
- Stripe publishable key
- Stripe webhook signing secret

For now keep:

- `NEXT_PUBLIC_APP_URL="http://127.0.0.1:3010"`

## 3. Create the database

Create a PostgreSQL database named:

- `calfie_express`

If your username/password are different, update `DATABASE_URL` in `.env.local` and `.env`.

## 4. Install dependencies

Run:

```powershell
npm install
```

## 5. Generate Prisma client and migrate

Run:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

## 6. Start the app

Run:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Then open:

- `http://127.0.0.1:3010`

## 7. Test Stripe webhooks locally

In another terminal, run:

```powershell
stripe login
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

Stripe CLI will print a webhook signing secret.
Put that value into:

- `STRIPE_WEBHOOK_SECRET`

Then restart the app if needed.

## 8. Current test endpoints

- `POST /api/auth/login`
- `POST /api/payments/setup-intent`
- `POST /api/quotes`

## 9. Current limitation

The codebase now includes auth scaffolding, Stripe setup-intent scaffolding, and a UPS OAuth/rating foundation.
UPS shipment purchase, full persistent auth, and Stripe Elements UI are still the next implementation steps.