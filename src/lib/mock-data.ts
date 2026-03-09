import type { PricingProfile, ShipmentInput } from "@/lib/domain-types";

export const demoCustomer = {
  id: "cust_demo_001",
  name: "Demo Customer",
  email: "demo@calfieexpress.com",
  companyName: "Demo Store",
  stripeCustomerId: "cus_demo",
  pricingProfile: {
    userId: "cust_demo_001",
    markupPercent: 12,
    flatFee: 1.5,
    minimumProfit: 4,
    residentialSurcharge: 1,
    signatureSurcharge: 2.5
  } satisfies PricingProfile
};

export const demoShipment: ShipmentInput = {
  userId: demoCustomer.id,
  shipFrom: {
    name: "CALFIE EXPRESS",
    company: "CALFIE EXPRESS",
    phone: "9095550100",
    email: "ops@calfieexpress.com",
    line1: "1450 S Grove Ave",
    city: "Ontario",
    state: "CA",
    postalCode: "91761",
    countryCode: "US"
  },
  shipTo: {
    name: "Demo Receiver",
    company: "Demo Buyer",
    phone: "2125550140",
    email: "receiver@example.com",
    line1: "350 5th Ave",
    city: "New York",
    state: "NY",
    postalCode: "10118",
    countryCode: "US"
  },
  packageLength: 12,
  packageWidth: 10,
  packageHeight: 8,
  packageWeight: 4,
  declaredValue: 120,
  residential: true,
  signatureRequired: false,
  shipDate: new Date().toISOString()
};