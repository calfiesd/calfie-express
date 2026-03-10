# CALFIE EXPRESS

This workspace now contains two layers:

- A static prototype in `index.html`, `styles.css`, and `app.js`
- A production app in `src/` for a Next.js + Prisma + Stripe shipping platform

## Current platform status

- Brand: CALFIE EXPRESS
- Guest checkout: disabled
- Real customer accounts: enabled
- Different customers can have different markup percentages and pricing rules
- Saved payment methods are supported through Stripe
- Phase 1 carrier: UPS only
- FedEx: planned for phase 2
- UPS OAuth, rating, and shipping: wired
- Multi-account UPS quoting: lowest configured account per service is selected automatically
- Stripe checkout + webhooks: wired
- PostgreSQL persistence: wired
- Email notifications: supported when Postmark env vars are configured

## Important local files

- `.env.local`: your real local secrets and config
- `.env.local.example`: clean local template copy
- `.env.example`: generic environment template
- `docs/local-development.md`: exact local setup steps
- `docs/deployment-vercel.md`: recommended production deployment path
- `docs/ups-phase1-plan.md`: UPS-only rollout plan

## Production app highlights

- `src/app/login/page.tsx`: customer registration and login
- `src/app/dashboard/page.tsx`: customer shipping dashboard with live UPS pricing
- `src/app/orders/page.tsx`: customer order history
- `src/app/admin/orders/page.tsx`: admin order list
- `src/app/api/quotes/route.ts`: UPS quote endpoint
- `src/app/api/orders/route.ts`: order draft creation
- `src/app/api/orders/complete/route.ts`: browser-driven payment completion
- `src/app/api/webhooks/stripe/route.ts`: Stripe webhook fulfillment
- `src/lib/orders/fulfillment.ts`: shared post-payment fulfillment logic
- `src/lib/carriers/ups.ts`: UPS adapter for rating and shipment purchase
- `src/lib/payments/stripe.ts`: Stripe customer, payment intent, and webhook helpers
- `prisma/schema.prisma`: users, pricing profiles, quotes, orders, and carrier adjustments

## Deployment prep

- Node.js target: `20.9+`
- Next.js dependency is prepared for the Next 16 deployment path
- ESLint uses the standard CLI instead of `next lint`
- Prisma client generation runs in `postinstall`
- Use Vercel + Neon for the simplest first production deployment

See [docs/deployment-vercel.md](/C:/Users/towei/OneDrive/文档/太阳能/website/docs/deployment-vercel.md) for the exact production checklist.