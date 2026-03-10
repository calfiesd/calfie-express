import { env } from "@/lib/config";
import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";

type FedExRateRequest = {
  accountNumber: { value: string };
  rateRequestControlParameters: {
    returnTransitTimes: boolean;
    servicesNeededOnRateFailure?: boolean;
    variableOptions?: string[];
  };
  requestedShipment: {
    shipper: {
      address: {
        postalCode: string;
        countryCode: string;
        stateOrProvinceCode?: string;
        city?: string;
        residential?: boolean;
      };
    };
    recipient: {
      address: {
        postalCode: string;
        countryCode: string;
        stateOrProvinceCode?: string;
        city?: string;
        residential?: boolean;
      };
    };
    pickupType: string;
    packagingType: string;
    rateRequestType: string[];
    preferredCurrency?: string;
    requestedPackageLineItems: Array<{
      weight: { units: string; value: number };
      dimensions?: { length: number; width: number; height: number; units: string };
      declaredValue?: { amount: number; currency: string };
    }>;
    shipDateStamp?: string;
  };
  carrierCodes?: string[];
};

let fedexAccessToken: { value: string; expiresAt: number } | null = null;

function toFedExShipDateStamp(value?: string) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function getFedExAuthPayload() {
  if (!env.FEDEX_API_KEY || !env.FEDEX_SECRET_KEY) {
    return null;
  }

  if (env.FEDEX_CHILD_KEY && env.FEDEX_CHILD_SECRET) {
    return new URLSearchParams({
      grant_type: "client_pc_credentials",
      client_id: env.FEDEX_API_KEY,
      client_secret: env.FEDEX_SECRET_KEY,
      child_key: env.FEDEX_CHILD_KEY,
      child_secret: env.FEDEX_CHILD_SECRET
    });
  }

  return new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.FEDEX_API_KEY,
    client_secret: env.FEDEX_SECRET_KEY
  });
}

export async function getFedExAccessToken() {
  if (fedexAccessToken && fedexAccessToken.expiresAt > Date.now() + 60_000) {
    return fedexAccessToken.value;
  }

  const payload = getFedExAuthPayload();
  if (!payload) {
    return null;
  }

  const response = await fetch(`${env.FEDEX_API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FedEx OAuth failed with status ${response.status}: ${text}`);
  }

  const json = await response.json() as { access_token: string; expires_in: number };
  fedexAccessToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in * 1000)
  };

  return json.access_token;
}

function buildFedExRateRequest(
  input: ShipmentInput,
  options: {
    includeDeclaredValue: boolean;
    pickupType: string;
    rateRequestType: string[];
    includeCarrierCodes: boolean;
    servicesNeededOnRateFailure?: boolean;
  }
): FedExRateRequest {
  const packageLineItem: FedExRateRequest["requestedShipment"]["requestedPackageLineItems"][number] = {
    weight: {
      units: "LB",
      value: input.packageWeight
    },
    dimensions: {
      length: input.packageLength,
      width: input.packageWidth,
      height: input.packageHeight,
      units: "IN"
    }
  };

  if (options.includeDeclaredValue && input.declaredValue > 0) {
    packageLineItem.declaredValue = {
      amount: input.declaredValue,
      currency: "USD"
    };
  }

  return {
    accountNumber: {
      value: env.FEDEX_ACCOUNT_NUMBER ?? ""
    },
    rateRequestControlParameters: {
      returnTransitTimes: true,
      ...(options.servicesNeededOnRateFailure === undefined ? {} : { servicesNeededOnRateFailure: options.servicesNeededOnRateFailure })
    },
    requestedShipment: {
      shipper: {
        address: {
          postalCode: input.shipFrom.postalCode,
          countryCode: input.shipFrom.countryCode,
          stateOrProvinceCode: input.shipFrom.state,
          city: input.shipFrom.city,
          residential: false
        }
      },
      recipient: {
        address: {
          postalCode: input.shipTo.postalCode,
          countryCode: input.shipTo.countryCode,
          stateOrProvinceCode: input.shipTo.state,
          city: input.shipTo.city,
          residential: input.residential
        }
      },
      pickupType: options.pickupType,
      packagingType: "YOUR_PACKAGING",
      rateRequestType: options.rateRequestType,
      preferredCurrency: "USD",
      shipDateStamp: toFedExShipDateStamp(input.shipDate),
      requestedPackageLineItems: [packageLineItem]
    },
    ...(options.includeCarrierCodes ? { carrierCodes: ["FEDEX_GROUND", "FEDEX_EXPRESS"] } : {})
  };
}

async function performFedExRateRequest(accessToken: string, request: FedExRateRequest) {
  const response = await fetch(`${env.FEDEX_API_BASE_URL}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-customer-transaction-id": `calfie-fedex-${Date.now()}`
    },
    body: JSON.stringify(request),
    cache: "no-store"
  });

  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

export async function requestFedExRates(accessToken: string, input: ShipmentInput) {
  if (!env.FEDEX_ACCOUNT_NUMBER) {
    throw new Error("FedEx account number is missing.");
  }

  const attempts = [
    {
      label: "full",
      request: buildFedExRateRequest(input, {
        includeDeclaredValue: true,
        pickupType: "USE_SCHEDULED_PICKUP",
        rateRequestType: ["ACCOUNT", "LIST"],
        includeCarrierCodes: true,
        servicesNeededOnRateFailure: true
      })
    },
    {
      label: "minimal",
      request: buildFedExRateRequest(input, {
        includeDeclaredValue: false,
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT"],
        includeCarrierCodes: false,
        servicesNeededOnRateFailure: false
      })
    }
  ];

  const failures: string[] = [];

  for (const attempt of attempts) {
    const result = await performFedExRateRequest(accessToken, attempt.request);

    if (result.ok) {
      return JSON.parse(result.text);
    }

    if (result.status === 401 || result.status === 403) {
      throw new Error(`FedEx rating failed with status ${result.status}: ${result.text}`);
    }

    failures.push(`${attempt.label} attempt -> status ${result.status}: ${result.text}`);
  }

  throw new Error(`FedEx rating failed after retries: ${failures.join(" || ")}`);
}

function buildFedExShipmentRequest(args: {
  orderId: string;
  shipment: ShipmentInput;
  rate: CarrierRate;
}) {
  const { orderId, shipment, rate } = args;

  const packageLineItem: Record<string, unknown> = {
    weight: {
      units: "LB",
      value: shipment.packageWeight
    },
    dimensions: {
      length: shipment.packageLength,
      width: shipment.packageWidth,
      height: shipment.packageHeight,
      units: "IN"
    }
  };

  if (shipment.declaredValue > 0) {
    packageLineItem.declaredValue = {
      amount: shipment.declaredValue,
      currency: "USD"
    };
  }

  return {
    labelResponseOptions: "LABEL",
    accountNumber: {
      value: env.FEDEX_ACCOUNT_NUMBER ?? ""
    },
    requestedShipment: {
      shipDatestamp: toFedExShipDateStamp(shipment.shipDate),
      pickupType: "DROPOFF_AT_FEDEX_LOCATION",
      serviceType: rate.serviceCode,
      packagingType: "YOUR_PACKAGING",
      shipper: {
        contact: {
          personName: shipment.shipFrom.name,
          companyName: shipment.shipFrom.company ?? shipment.shipFrom.name,
          phoneNumber: shipment.shipFrom.phone
        },
        address: {
          streetLines: [shipment.shipFrom.line1],
          city: shipment.shipFrom.city,
          stateOrProvinceCode: shipment.shipFrom.state,
          postalCode: shipment.shipFrom.postalCode,
          countryCode: shipment.shipFrom.countryCode,
          residential: false
        }
      },
      recipients: [{
        contact: {
          personName: shipment.shipTo.name,
          companyName: shipment.shipTo.company ?? shipment.shipTo.name,
          phoneNumber: shipment.shipTo.phone
        },
        address: {
          streetLines: [shipment.shipTo.line1],
          city: shipment.shipTo.city,
          stateOrProvinceCode: shipment.shipTo.state,
          postalCode: shipment.shipTo.postalCode,
          countryCode: shipment.shipTo.countryCode,
          residential: shipment.residential
        }
      }],
      shippingChargesPayment: {
        paymentType: "SENDER",
        payor: {
          responsibleParty: {
            accountNumber: {
              value: env.FEDEX_ACCOUNT_NUMBER ?? ""
            }
          }
        }
      },
      labelSpecification: {
        imageType: "PDF",
        labelStockType: "PAPER_85X11_TOP_HALF_LABEL"
      },
      requestedPackageLineItems: [
        {
          sequenceNumber: 1,
          groupPackageCount: 1,
          ...packageLineItem
        }
      ],
      totalPackageCount: 1,
      customerReferences: [
        {
          customerReferenceType: "CUSTOMER_REFERENCE",
          value: orderId
        }
      ]
    }
  };
}

export async function requestFedExShipment(accessToken: string, args: {
  orderId: string;
  shipment: ShipmentInput;
  rate: CarrierRate;
}) {
  if (!env.FEDEX_ACCOUNT_NUMBER) {
    throw new Error("FedEx account number is missing.");
  }

  const response = await fetch(`${env.FEDEX_API_BASE_URL}/ship/v1/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-customer-transaction-id": `calfie-fedex-ship-${Date.now()}`
    },
    body: JSON.stringify(buildFedExShipmentRequest(args)),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FedEx shipment purchase failed with status ${response.status}: ${text}`);
  }

  return response.json();
}