import { NextResponse } from "next/server";
import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { validateInternationalShipment } from "@/lib/international";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to create an order draft." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rate = body?.rate as CarrierRate | undefined;
  const shipment = body?.shipment as ShipmentInput | undefined;
  const quoteId = typeof body?.quoteId === "string" ? body.quoteId : undefined;

  if (!rate || !shipment) {
    return NextResponse.json({ message: "A selected rate and shipment are required." }, { status: 400 });
  }

  const internationalValidationError = validateInternationalShipment(shipment);
  if (internationalValidationError) {
    return NextResponse.json({ message: internationalValidationError }, { status: 400 });
  }

  if (rate.carrier === "UPS" && user.pricingProfile?.allowUpsPurchase === false) {
    return NextResponse.json({ message: "UPS purchase is disabled for this customer." }, { status: 403 });
  }

  if (rate.carrier === "FEDEX" && user.pricingProfile?.allowFedexPurchase === false) {
    return NextResponse.json({ message: "FedEx purchase is disabled for this customer." }, { status: 403 });
  }

  const storedShipment = {
    ...shipment,
    userId: user.id
  };
  const margin = Number((rate.customerPrice - rate.carrierCost).toFixed(2));

  let quote;

  if (quoteId) {
    const existing = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        userId: user.id
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "Quote not found for this customer." }, { status: 404 });
    }

    quote = await prisma.quote.update({
      where: { id: existing.id },
      data: {
        status: "CONVERTED",
        shipmentJson: storedShipment,
        ratesJson: [rate]
      }
    });
  } else {
    quote = await prisma.quote.create({
      data: {
        userId: user.id,
        status: "CONVERTED",
        shipFromPostalCode: storedShipment.shipFrom.postalCode,
        shipToPostalCode: storedShipment.shipTo.postalCode,
        shipDate: storedShipment.shipDate ? new Date(storedShipment.shipDate) : undefined,
        packageLength: storedShipment.packageLength,
        packageWidth: storedShipment.packageWidth,
        packageHeight: storedShipment.packageHeight,
        packageWeight: storedShipment.packageWeight,
        declaredValue: storedShipment.declaredValue,
        residential: storedShipment.residential,
        signatureRequired: storedShipment.signatureRequired,
        shipmentJson: storedShipment,
        ratesJson: [rate]
      }
    });
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      quoteId: quote.id,
      status: "PENDING_PAYMENT",
      selectedCarrier: rate.carrier,
      selectedService: rate.serviceCode,
      quotedCustomerAmount: rate.customerPrice,
      quotedCarrierAmount: rate.carrierCost,
      marginAmount: margin,
      shipmentJson: storedShipment,
      selectedRateJson: rate
    }
  });

  return NextResponse.json({
    order: {
      id: order.id,
      shipment: storedShipment,
      rate,
      customerPrice: rate.customerPrice,
      carrierCost: rate.carrierCost,
      margin,
      status: "draft"
    },
    note: "Order draft created and stored for the signed-in customer."
  });
}
