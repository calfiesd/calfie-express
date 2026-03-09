# UPS Phase 1 Plan

## Scope

Phase 1 launches CALFIE EXPRESS with UPS only.

## Included

- customer accounts only
- saved payment methods
- customer-specific markup percentages
- UPS rate quoting
- UPS label purchase
- label history and reprint
- post-shipment carrier adjustment billing through Stripe
- admin pricing management

## Deferred to phase 2

- FedEx rating and label purchase
- FedEx-specific service mapping
- cross-carrier comparison UI

## What is already available

- UPS app credentials were provided by the user
- UPS account number was provided by the user
- customer pricing schema exists in `prisma/schema.prisma`
- UPS adapter exists in `src/lib/carriers/ups.ts`

## Remaining requirements

- confirmation that UPS shipping access is approved for production
- Stripe secret key
- Stripe publishable key
- Stripe webhook secret
- domain name for callback and webhook configuration

## Implementation order

1. real auth and customer account records
2. Stripe setup-intent for storing payment methods
3. UPS OAuth token flow
4. UPS rating endpoint integration
5. quote selection and order creation
6. Stripe payment intent for label purchase
7. UPS shipment purchase and label storage
8. order history and reprint
9. adjustment rebilling workflow
