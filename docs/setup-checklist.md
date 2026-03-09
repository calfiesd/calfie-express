# Go-Live Checklist

## Accounts and credentials

- UPS developer app created
- UPS production access approved
- UPS shipper/account number confirmed
- FedEx developer app created
- FedEx production access approved
- FedEx account number confirmed
- Stripe account created
- Stripe webhook endpoint configured
- Email delivery provider configured

## Legal and policy

- Terms of service explicitly authorize post-shipment carrier adjustment billing
- Privacy policy covers stored payment methods and shipment data
- Refund and void policy documented
- Customer support contact published

## Technical setup

- Node.js installed locally
- PostgreSQL provisioned
- `.env.local` populated
- Prisma migrations applied
- Authentication implemented
- Saved payment method flow implemented
- Rate limiting enabled
- Audit logging enabled

## Shipping operations

- Address validation tested
- Quote expiration policy set
- Double-purchase protection implemented
- Label void workflow tested
- Adjustment import workflow tested
- Failed rebill escalation workflow documented

## Admin operations

- Customer pricing profile editor connected to database
- Search by customer, order, and tracking number
- Manual refund tooling added
- Manual waiver flow for disputed adjustments added
