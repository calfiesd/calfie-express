# Shipping Label Platform Blueprint

## Goal

Build a website where customers can buy shipping labels online while you fulfill them using your own discounted UPS and FedEx accounts.

## Best architecture

Use a private backend between the browser and the carrier APIs.

The browser should only talk to your application backend. Your backend should:

- authenticate users
- validate addresses
- request live rates from carriers
- apply pricing rules
- create payment intents
- buy labels after payment
- store PDFs and tracking numbers
- handle voids and refunds

## Why this matters

If you call carrier APIs directly from the browser, you risk exposing account credentials and rate logic. That can let someone abuse your carrier accounts or scrape your negotiated pricing.

## Recommended database tables

- `users`
- `saved_addresses`
- `quotes`
- `quote_rates`
- `orders`
- `shipments`
- `shipment_packages`
- `carrier_transactions`
- `label_files`
- `tracking_events`
- `refunds`
- `audit_logs`

## Internal API design

### Public app routes

- `POST /api/quotes`
- `POST /api/checkout/session`
- `GET /api/orders/:id`
- `POST /api/orders/:id/reprint`
- `POST /api/orders/:id/void`

### Admin routes

- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders/:id/refund`
- `POST /api/admin/pricing-rules`

## Carrier adapter pattern

Create one internal interface per operation:

- `getRates(shipmentInput)`
- `buyLabel(purchasedQuote)`
- `voidLabel(carrierShipmentId)`
- `trackShipment(trackingNumber)`
- `validateAddress(address)`

Then implement:

- `UpsAdapter`
- `FedExAdapter`

This keeps your frontend and order system stable even if carrier APIs differ.

## Pricing strategy

Use explicit pricing rules instead of hard-coded math.

Suggested model:

- base flat fee per label
- optional percent markup
- minimum profit floor
- service-specific overrides
- signature or insurance surcharge
- residential surcharge pass-through or blended pricing

## Fraud and abuse controls

- rate limit quote creation by IP and account
- require login for high-risk shipments
- enforce card AVS/CVV checks
- hold orders with mismatched billing and ship-from patterns
- cap daily label volume for new accounts
- block repeated void-abuse behavior

## Operational risks to plan for

- invalid addresses
- dimensional-weight disputes
- duplicate label purchases from double clicks
- payment succeeded but carrier purchase failed
- carrier purchase succeeded but webhook delivery failed
- label void requested after carrier cutoff

## Build order

1. Quote flow
2. Payment flow
3. Single-carrier label purchase
4. Order history and label reprint
5. Void/refund tooling
6. Second carrier integration
7. Tracking sync and notification automation

## Current source notes

- UPS developer resources list APIs for Rating, Shipping, Time in Transit, Pickup, and Address Validation.
- FedEx Ship API supports label creation for package shipments, and FedEx documentation indicates some projects require validation or shipping-label certification before production use.
- EzeeShip publishes an API with endpoints for shipment creation, label download, and tracking, which confirms the benchmark product model you referenced.
