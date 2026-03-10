import { env } from "@/lib/config";
import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";

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
  const accountNumber = rate.accountNumber ?? env.UPS_ACCOUNT_NUMBER ?? env.UPS_ACCOUNT_NUMBERS[0];
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

