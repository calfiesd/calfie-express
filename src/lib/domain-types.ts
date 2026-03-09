export type CarrierCode = "UPS" | "FEDEX";

export type PricingProfile = {
  userId: string;
  markupPercent: number;
  flatFee: number;
  minimumProfit: number;
  residentialSurcharge: number;
  signatureSurcharge: number;
};

export type AddressInput = {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

export type ShipmentInput = {
  userId: string;
  shipFrom: AddressInput;
  shipTo: AddressInput;
  packageLength: number;
  packageWidth: number;
  packageHeight: number;
  packageWeight: number;
  declaredValue: number;
  residential: boolean;
  signatureRequired: boolean;
  shipDate?: string;
};

export type CarrierRate = {
  carrier: CarrierCode;
  serviceCode: string;
  serviceName: string;
  transitDays: number;
  carrierCost: number;
  customerPrice: number;
  currency: "USD";
  accountNumber?: string;
  accountLabel?: string;
};

export type UpsQuoteResponse = {
  shipment: ShipmentInput;
  rates: CarrierRate[];
  source: "live" | "fallback";
  diagnostic?: string;
  note: string;
};

export type OrderDraft = {
  id: string;
  shipment: ShipmentInput;
  rate: CarrierRate;
  customerPrice: number;
  carrierCost: number;
  margin: number;
  status: "draft";
};

export type CheckoutDraft = {
  orderId: string;
  amount: number;
  currency: "usd";
  paymentMode: "live" | "demo";
  clientSecret: string;
  paymentIntentId: string;
  status: "requires_payment_method" | "requires_confirmation" | "demo_ready";
};

export type PurchasedLabel = {
  carrier: CarrierCode;
  serviceName: string;
  trackingNumber: string;
  labelUrl: string;
  carrierCharge: number;
};

export type CustomerAccountSummary = {
  id: string;
  name: string;
  email: string;
  companyName?: string;
  stripeCustomerId?: string;
  pricingProfile: PricingProfile;
};