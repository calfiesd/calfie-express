import { env } from "@/lib/config";
import type { ShipmentInput } from "@/lib/domain-types";

type FedExRateRequest = {
  accountNumber: { value: string };
  rateRequestControlParameters: {
    returnTransitTimes: boolean;
    servicesNeededOnRateFailure: boolean;
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

function buildFedExRateRequest(input: ShipmentInput): FedExRateRequest {
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

  if (input.declaredValue > 0) {
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
      servicesNeededOnRateFailure: true
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
      pickupType: "USE_SCHEDULED_PICKUP",
      packagingType: "YOUR_PACKAGING",
      rateRequestType: ["ACCOUNT", "LIST"],
      preferredCurrency: "USD",
      shipDateStamp: input.shipDate,
      requestedPackageLineItems: [packageLineItem]
    },
    carrierCodes: ["FEDEX_GROUND", "FEDEX_EXPRESS"]
  };
}

export async function requestFedExRates(accessToken: string, input: ShipmentInput) {
  if (!env.FEDEX_ACCOUNT_NUMBER) {
    throw new Error("FedEx account number is missing.");
  }

  const response = await fetch(`${env.FEDEX_API_BASE_URL}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-customer-transaction-id": `calfie-fedex-${Date.now()}`
    },
    body: JSON.stringify(buildFedExRateRequest(input)),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FedEx rating failed with status ${response.status}: ${text}`);
  }

  return response.json();
}
