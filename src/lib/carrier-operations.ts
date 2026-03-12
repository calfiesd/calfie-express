import { getFedExVoidStatus } from "@/lib/carriers/fedex";
import { getUpsVoidStatus } from "@/lib/carriers/ups";
import type { CarrierCode } from "@/lib/domain-types";

export type CarrierVoidGuidance = {
  carrier: CarrierCode;
  mode: "live" | "manual" | "demo";
  title: string;
  summary: string;
  diagnostic: string;
  portalLabel: string;
  portalUrl: string;
  steps: string[];
};

function buildGuidance(args: {
  carrier: CarrierCode;
  trackingNumber?: string | null;
  paymentSource: string;
}) : CarrierVoidGuidance {
  const base = args.carrier === "FEDEX" ? getFedExVoidStatus() : getUpsVoidStatus();
  const trackingLabel = args.trackingNumber ?? "the shipment tracking number";
  const portalLabel = args.carrier === "FEDEX" ? "Open FedEx Shipping Portal" : "Open UPS Shipping Portal";
  const portalUrl = args.carrier === "FEDEX"
    ? "https://www.fedex.com/en-us/shipping.html"
    : "https://www.ups.com/ship";
  const refundInstruction = args.paymentSource === "WALLET"
    ? "Return here and complete the refund so the wallet credit is posted."
    : "Return here and complete the refund so the Stripe charge is reversed.";

  return {
    carrier: args.carrier,
    mode: base.mode,
    title: `${args.carrier} void workflow`,
    summary: base.enabled
      ? `${args.carrier} automatic voids are enabled for this environment.`
      : `${args.carrier} voids still require manual confirmation in the carrier portal before the app should finalize the refund.`,
    diagnostic: base.diagnostic,
    portalLabel,
    portalUrl,
    steps: [
      `Open the ${args.carrier} carrier portal and locate shipment ${trackingLabel}.`,
      `Confirm that the shipment is eligible to void and submit the carrier-side cancel request.`,
      refundInstruction,
      "After carrier confirmation, use the order refund action to close the loop and keep the order state accurate."
    ]
  };
}

export function getOrderVoidGuidance(args: {
  carrier: CarrierCode;
  trackingNumber?: string | null;
  paymentSource: string;
}) {
  return buildGuidance(args);
}
