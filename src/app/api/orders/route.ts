import { NextResponse } from "next/server";
import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to create an order draft." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rate = body?.rate as CarrierRate | undefined;
  const shipment = body?.shipment as ShipmentInput | undefined;

  if (!rate || !shipment) {
    return NextResponse.json({ message: "A selected rate and shipment are required." }, { status: 400 });
  }

  const storedShipment = {
    ...shipment,
    userId: user.id
  };
  const margin = Number((rate.customerPrice - rate.carrierCost).toFixed(2));

  const quote = await prisma.quote.create({
    data: {
      userId: user.id,
      status: "PRICED",
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