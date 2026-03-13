export type CarrierCode = "UPS" | "FEDEX";

export type ShipmentPackageType =
  | "CUSTOMER_SUPPLIED"
  | "UPS_LETTER"
  | "UPS_PAK"
  | "UPS_TUBE"
  | "FEDEX_ENVELOPE"
  | "FEDEX_PAK"
  | "FEDEX_BOX"
  | "FEDEX_TUBE";

export type PricingProfile = {
  userId: string;
  markupPercent: number;
  flatFee: number;
  minimumProfit: number;
  residentialSurcharge: number;
  signatureSurcharge: number;
  allowUps?: boolean;
  allowFedex?: boolean;
  allowUpsPurchase?: boolean;
  allowFedexPurchase?: boolean;
};

export type AddressInput = {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

export type ShipmentCustomsItemInput = {
  id: string;
  description: string;
  quantity: number;
  unitValue: number;
  unitWeight: number;
  hsCode?: string;
  originCountryCode: string;
  sku?: string;
};

export type ShipmentCustomsInput = {
  reasonForExport: string;
  invoiceNumber?: string;
  termsOfSale: string;
  nonDeliveryOption: "RETURN" | "ABANDON";
  exporterTaxId?: string;
  importerTaxId?: string;
  contentsSummary: string;
  items: ShipmentCustomsItemInput[];
};

export type ShipmentInput = {
  userId: string;
  shipFrom: AddressInput;
  shipTo: AddressInput;
  packageLength: number;
  packageWidth: number;
  packageHeight: number;
  packageWeight: number;
  packageType: ShipmentPackageType;
  declaredValue: number;
  residential: boolean;
  signatureRequired: boolean;
  simpleRate: boolean;
  shipDate?: string;
  customs?: ShipmentCustomsInput;
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

export type UpsDebugRate = {
  serviceCode: string;
  serviceName: string;
  totalCharges?: number;
  negotiatedCharges?: number;
  freightNetCharge?: number;
  chargeSource: "published" | "negotiated" | "freight_net";
  selectedCharge: number;
};

export type UpsDebugAccount = {
  accountNumber: string;
  status: "success" | "failure";
  message?: string;
  rates: UpsDebugRate[];
};

export type FedExQuoteStatus = {
  mode: "live" | "fallback" | "misconfigured";
  diagnostic: string;
};

export type UpsQuoteResponse = {
  quoteId?: string;
  shipment: ShipmentInput;
  rates: CarrierRate[];
  source: "live" | "fallback";
  diagnostic?: string;
  debugAccounts?: UpsDebugAccount[];
  fedexStatus?: FedExQuoteStatus;
  note: string;
};

export type UpsBatchRowStatus = "quoted" | "error" | "purchased" | "failed";

export type UpsBatchPreviewRow = {
  rowNumber: number;
  recipientName: string;
  companyName?: string;
  destination: string;
  reference1?: string;
  requestedServiceCode: string;
  requestedServiceName: string;
  accountNumber?: string;
  accountLabel?: string;
  carrierCost?: number;
  customerPrice?: number;
  status: UpsBatchRowStatus;
  message?: string;
  orderId?: string;
  trackingNumber?: string;
  labelUrl?: string;
};

export type UpsBatchPreviewResponse = {
  rows: UpsBatchPreviewRow[];
  totals: {
    rowCount: number;
    quotedCount: number;
    errorCount: number;
    purchasedCount?: number;
    failedCount?: number;
    carrierCostTotal: number;
    customerPriceTotal: number;
  };
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

export type WalletTopUpDraft = {
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

export type WalletTransactionSummary = {
  id: string;
  type: "TOP_UP" | "LABEL_PURCHASE" | "VOID_REFUND" | "MANUAL_CREDIT" | "MANUAL_DEBIT";
  status: "PENDING" | "COMPLETED" | "FAILED";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  stripePaymentIntentId?: string | null;
  createdAt: string;
  order?: {
    id: string;
    selectedCarrier: CarrierCode;
    selectedService: string;
    status: string;
  } | null;
};

export type WalletSummary = {
  balance: number;
  transactions: WalletTransactionSummary[];
};

export type PaymentMethodSummary = {
  mode: "live" | "demo" | "misconfigured";
  customerId?: string | null;
  paymentMethodId?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  funding?: string | null;
};

export type ValidatableAddress = {
  name?: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

export type AddressValidationCandidate = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  postalCodeExtended?: string;
  countryCode: string;
  classification?: string;
};

export type AddressValidationResult = {
  mode: "live" | "fallback";
  requestOption: 1 | 2 | 3;
  status: "valid" | "ambiguous" | "invalid" | "error";
  classification?: string;
  alerts: string[];
  candidateCount: number;
  candidates: AddressValidationCandidate[];
  diagnostic?: string;
};

export type SavedAddressSummary = {
  id: string;
  label: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
};
