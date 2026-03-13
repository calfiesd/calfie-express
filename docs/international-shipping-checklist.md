# International Shipping Checklist

Use this when validating a real international label purchase in production.

## Before purchase

- Confirm the ship-from and ship-to countries are different.
- Confirm recipient phone and address line 1 are present.
- Confirm `reason for export`, `terms of sale`, `contents summary`, and at least one customs line item are filled in.
- Confirm each customs item has:
  - description
  - quantity > 0
  - unit value > 0
  - unit weight > 0
  - origin country
- Confirm declared merchandise value matches the expected invoice total.

## During draft creation

- Create the order draft from `/dashboard`.
- Verify the draft is created without the API rejecting customs data.
- Open the commercial invoice preview from the draft/order flow.

## During purchase

- Complete payment or wallet checkout.
- Verify the order reaches `LABEL_PURCHASED` if the carrier accepts the shipment.
- If the carrier rejects the shipment, capture the raw diagnostic message shown in the app.

## After purchase

- Open the stored label from the order detail page.
- Open the commercial invoice from the order detail page.
- Verify the invoice shows:
  - exporter
  - consignee
  - invoice number
  - customs line items
  - declared value
- Confirm tracking number is saved on the order.

## Carrier-specific notes

- UPS: international forms are attached only when customs data exists and the shipment is international.
- FedEx: `customsClearanceDetail` is attached only when customs data exists and the shipment is international.
- Domestic shipments should continue to purchase without customs payloads.

## If purchase fails

- Save the exact carrier diagnostic shown by the app.
- Verify whether the failure is:
  - missing customs data
  - unsupported service/country combination
  - account permission issue
  - invalid tax/import information
- Keep `ALLOW_FEDEX_LABEL_PURCHASE=false` until at least one real FedEx international drill succeeds cleanly.
