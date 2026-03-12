import { env } from "@/lib/config";
import type { AddressValidationResult, CarrierRate, ShipmentInput, ValidatableAddress } from "@/lib/domain-types";

type UpsSimpleRateCode = "XS" | "S" | "M" | "L" | "XL";

function getUpsSimpleRateCode(
  input: Pick<ShipmentInput, "simpleRate" | "packageLength" | "packageWidth" | "packageHeight" | "packageWeight" | "shipFrom" | "shipTo">
): UpsSimpleRateCode | undefined {
  if (!input.simpleRate) {
    return undefined;
  }

  if (input.packageWeight > 50 || input.shipFrom.countryCode !== "US" || input.shipTo.countryCode !== "US") {
    return undefined;
  }

  const cubicInches = input.packageLength * input.packageWidth * input.packageHeight;

  if (cubicInches <= 0) {
    return undefined;
  }

  if (cubicInches <= 100) {
    return "XS";
  }

  if (cubicInches <= 250) {
    return "S";
  }

  if (cubicInches <= 650) {
    return "M";
  }

  if (cubicInches <= 1050) {
    return "L";
  }

  if (cubicInches <= 1728) {
    return "XL";
  }

  return undefined;
}

function buildUpsPackageServiceOptions(input: Pick<ShipmentInput, "declaredValue" | "signatureRequired">) {
  const hasDeclaredValue = input.declaredValue > 0;
  const hasSignature = input.signatureRequired;

  if (!hasDeclaredValue && !hasSignature) {
    return undefined;
  }

  return {
    DeclaredValue: hasDeclaredValue
      ? {
          CurrencyCode: "USD",
          MonetaryValue: String(input.declaredValue)
        }
      : undefined,
    DeliveryConfirmation: hasSignature
      ? {
          DCISType: "2"
        }
      : undefined
  };
}

export async function getUpsAccessToken() {
  if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET) {
    return null;
  }

  const credentials = Buffer.from(`${env.UPS_CLIENT_ID}:${env.UPS_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${env.UPS_API_BASE_URL}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`UPS OAuth failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return payload.access_token as string;
}

export async function requestUpsShopRates(accessToken: string, input: ShipmentInput, accountNumber: string) {
  const simpleRateCode = getUpsSimpleRateCode(input);
  const packageServiceOptions = buildUpsPackageServiceOptions(input);
  const body = {
    RateRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: `CALFIE EXPRESS rate request ${accountNumber}`
        }
      },
      PickupType: {
        Code: "01"
      },
      CustomerClassification: {
        Code: "00"
      },
      Shipment: {
        Shipper: {
          ShipperNumber: accountNumber,
          Address: {
            PostalCode: input.shipFrom.postalCode,
            CountryCode: input.shipFrom.countryCode
          }
        },
        ShipTo: {
          Address: {
            PostalCode: input.shipTo.postalCode,
            CountryCode: input.shipTo.countryCode,
            ResidentialAddressIndicator: input.residential ? "Y" : undefined
          }
        },
        ShipFrom: {
          Address: {
            PostalCode: input.shipFrom.postalCode,
            CountryCode: input.shipFrom.countryCode
          }
        },
        PaymentDetails: {
          ShipmentCharge: {
            Type: "01",
            BillShipper: {
              AccountNumber: accountNumber
            }
          }
        },
        ShipmentRatingOptions: simpleRateCode
          ? {
              UserLevelDiscountIndicator: "Y",
              TPFCNegotiatedRatesIndicator: "Y"
            }
          : undefined,
        DeliveryTimeInformation: {
          PackageBillType: "03"
        },
        Package: {
          SimpleRate: simpleRateCode
            ? {
                Description: `Simple Rate ${simpleRateCode}`,
                Code: simpleRateCode
              }
            : undefined,
          PackagingType: {
            Code: "02"
          },
          Dimensions: {
            UnitOfMeasurement: {
              Code: "IN"
            },
            Length: String(input.packageLength),
            Width: String(input.packageWidth),
            Height: String(input.packageHeight)
          },
          PackageWeight: {
            UnitOfMeasurement: {
              Code: "LBS"
            },
            Weight: String(input.packageWeight)
          },
          PackageServiceOptions: packageServiceOptions
        }
      }
    }
  };

  const response = await fetch(`${env.UPS_API_BASE_URL}/api/rating/v2409/Shop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      transId: `calfie-${accountNumber}-${Date.now()}`,
      transactionSrc: "CALFIEEXPRESS",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`UPS rating failed for account ${accountNumber} with status ${response.status}: ${text}`);
  }

  return response.json();
}

export async function requestUpsShipment(accessToken: string, args: {
  orderId: string;
  shipment: ShipmentInput;
  rate: CarrierRate;
}) {
  const { orderId, shipment, rate } = args;
  const accountNumber = rate.accountNumber ?? env.UPS_ACCOUNT_NUMBER;
  const simpleRateCode = getUpsSimpleRateCode(shipment);
  const packageServiceOptions = buildUpsPackageServiceOptions(shipment);

  if (!accountNumber) {
    throw new Error("No UPS account number is available for shipment purchase.");
  }

  const body = {
    ShipmentRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: `CALFIE EXPRESS ${orderId}`
        }
      },
      Shipment: {
        Description: "CALFIE EXPRESS shipment",
        Shipper: {
          Name: shipment.shipFrom.name,
          AttentionName: shipment.shipFrom.name,
          ShipperNumber: accountNumber,
          Phone: {
            Number: shipment.shipFrom.phone
          },
          Address: {
            AddressLine: [shipment.shipFrom.line1],
            City: shipment.shipFrom.city,
            StateProvinceCode: shipment.shipFrom.state,
            PostalCode: shipment.shipFrom.postalCode,
            CountryCode: shipment.shipFrom.countryCode
          }
        },
        ShipTo: {
          Name: shipment.shipTo.name,
          AttentionName: shipment.shipTo.name,
          Phone: {
            Number: shipment.shipTo.phone
          },
          Address: {
            AddressLine: [shipment.shipTo.line1],
            City: shipment.shipTo.city,
            StateProvinceCode: shipment.shipTo.state,
            PostalCode: shipment.shipTo.postalCode,
            CountryCode: shipment.shipTo.countryCode,
            ResidentialAddressIndicator: shipment.residential ? "Y" : undefined
          }
        },
        ShipFrom: {
          Name: shipment.shipFrom.name,
          AttentionName: shipment.shipFrom.name,
          Phone: {
            Number: shipment.shipFrom.phone
          },
          Address: {
            AddressLine: [shipment.shipFrom.line1],
            City: shipment.shipFrom.city,
            StateProvinceCode: shipment.shipFrom.state,
            PostalCode: shipment.shipFrom.postalCode,
            CountryCode: shipment.shipFrom.countryCode
          }
        },
        PaymentInformation: {
          ShipmentCharge: {
            Type: "01",
            BillShipper: {
              AccountNumber: accountNumber
            }
          }
        },
        Service: {
          Code: rate.serviceCode
        },
        Package: {
          Description: "Package",
          SimpleRate: simpleRateCode
            ? {
                Description: `Simple Rate ${simpleRateCode}`,
                Code: simpleRateCode
              }
            : undefined,
          Packaging: {
            Code: "02"
          },
          Dimensions: {
            UnitOfMeasurement: {
              Code: "IN"
            },
            Length: String(shipment.packageLength),
            Width: String(shipment.packageWidth),
            Height: String(shipment.packageHeight)
          },
          PackageWeight: {
            UnitOfMeasurement: {
              Code: "LBS"
            },
            Weight: String(shipment.packageWeight)
          },
          PackageServiceOptions: packageServiceOptions
        }
      },
      LabelSpecification: {
        LabelImageFormat: {
          Code: "GIF"
        },
        HTTPUserAgent: "CALFIEEXPRESS"
      }
    }
  };

  const response = await fetch(`${env.UPS_API_BASE_URL}/api/shipments/v2409/ship`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      transId: `calfie-ship-${accountNumber}-${Date.now()}`,
      transactionSrc: "CALFIEEXPRESS",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`UPS shipment purchase failed with status ${response.status}: ${text}`);
  }

  return response.json();
}

type UpsAddressValidationCandidate = {
  AddressKeyFormat?: {
    AddressLine?: string | string[];
    PoliticalDivision2?: string;
    PoliticalDivision1?: string;
    PostcodePrimaryLow?: string;
    PostcodeExtendedLow?: string;
    CountryCode?: string;
  };
  AddressClassification?: {
    Description?: string;
    Code?: string;
  };
};

type UpsAddressValidationPayload = {
  XAVResponse?: {
    Response?: {
      Alert?: Array<{ Description?: string }> | { Description?: string };
    };
    ValidAddressIndicator?: unknown;
    AmbiguousAddressIndicator?: unknown;
    NoCandidatesIndicator?: unknown;
    AddressClassification?: {
      Description?: string;
      Code?: string;
    };
    Candidate?: UpsAddressValidationCandidate | UpsAddressValidationCandidate[];
  };
};

function asArray<T>(value: T | T[] | undefined | null) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getAddressLines(value: string | string[] | undefined) {
  const lines = asArray(value).map((line) => String(line).trim()).filter(Boolean);
  return {
    line1: lines[0] ?? "",
    line2: lines[1] ?? undefined
  };
}

function normalizeUpsAddressValidation(payload: UpsAddressValidationPayload, requestOption: 1 | 2 | 3): AddressValidationResult {
  const response = payload.XAVResponse;
  const alerts = asArray(response?.Response?.Alert)
    .map((alert) => alert?.Description?.trim())
    .filter((value): value is string => Boolean(value));
  const candidates = asArray(response?.Candidate).map((candidate) => {
    const keyFormat = candidate?.AddressKeyFormat;
    const lines = getAddressLines(keyFormat?.AddressLine);
    const primaryPostal = String(keyFormat?.PostcodePrimaryLow ?? "").trim();
    const extendedPostal = String(keyFormat?.PostcodeExtendedLow ?? "").trim();

    return {
      line1: lines.line1,
      line2: lines.line2,
      city: String(keyFormat?.PoliticalDivision2 ?? "").trim(),
      state: String(keyFormat?.PoliticalDivision1 ?? "").trim(),
      postalCode: primaryPostal,
      postalCodeExtended: extendedPostal || undefined,
      countryCode: String(keyFormat?.CountryCode ?? "").trim(),
      classification: candidate?.AddressClassification?.Description?.trim() || candidate?.AddressClassification?.Code?.trim()
    };
  }).filter((candidate) => candidate.line1 && candidate.city && candidate.state && candidate.postalCode && candidate.countryCode);

  const status: AddressValidationResult["status"] = response?.ValidAddressIndicator
    ? "valid"
    : response?.AmbiguousAddressIndicator
      ? "ambiguous"
      : response?.NoCandidatesIndicator
        ? "invalid"
        : "error";

  return {
    mode: "live",
    requestOption,
    status,
    classification: response?.AddressClassification?.Description?.trim() || response?.AddressClassification?.Code?.trim(),
    alerts,
    candidateCount: candidates.length,
    candidates,
    diagnostic: alerts.join(" || ") || undefined
  };
}

export async function requestUpsAddressValidation(
  accessToken: string,
  address: ValidatableAddress,
  requestOption: 1 | 2 | 3 = 3
) {
  const body = {
    XAVRequest: {
      Request: {
        RequestOption: String(requestOption),
        TransactionReference: {
          CustomerContext: "CALFIE EXPRESS address validation"
        }
      },
      AddressKeyFormat: {
        ConsigneeName: address.name?.trim() || undefined,
        BuildingName: address.company?.trim() || undefined,
        AddressLine: [address.line1, address.line2].filter(Boolean),
        PoliticalDivision2: address.city.trim(),
        PoliticalDivision1: address.state.trim(),
        PostcodePrimaryLow: address.postalCode.trim(),
        CountryCode: address.countryCode.trim().toUpperCase()
      }
    }
  };

  const response = await fetch(`${env.UPS_API_BASE_URL}/api/addressvalidation/v1/${requestOption}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      transId: `calfie-address-${Date.now()}`,
      transactionSrc: "CALFIEEXPRESS",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`UPS address validation failed with status ${response.status}: ${text}`);
  }

  const payload = await response.json() as UpsAddressValidationPayload;
  return normalizeUpsAddressValidation(payload, requestOption);
}

