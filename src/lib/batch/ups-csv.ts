import type { ShipmentInput } from "@/lib/domain-types";

export type UpsBatchParsedRow = {
  rowNumber: number;
  shipment: ShipmentInput;
  requestedServiceCode: string;
  requestedServiceName: string;
  reference1?: string;
  recipientName: string;
  companyName?: string;
  destination: string;
};

const SERVICE_NAMES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "59": "UPS 2nd Day Air A.M."
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeCountry(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized || "US";
}

function normalizeResidential(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "Y" || normalized === "YES" || normalized === "TRUE" || normalized === "1";
}

function toNumber(value: string, fallback = 0) {
  const normalized = Number(value.trim());
  return Number.isFinite(normalized) ? normalized : fallback;
}

function compactAddressLines(...parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(", ");
}

export function parseUpsBatchCsv(csvText: string, shipFrom: ShipmentInput["shipFrom"], userId: string) {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return lines.map((line, index) => {
    const columns = parseCsvLine(line);

    if (columns.length < 25) {
      throw new Error(`Row ${index + 1} has ${columns.length} columns. Expected at least 25 columns from the UPS batch template.`);
    }

    const contactName = columns[0] || columns[1] || `Recipient ${index + 1}`;
    const companyName = columns[1] || undefined;
    const countryCode = normalizeCountry(columns[2]);
    const addressLine1 = columns[3] || "";
    const addressLine2 = columns[4] || "";
    const addressLine3 = columns[5] || "";
    const city = columns[6] || "";
    const state = columns[7] || "";
    const postalCode = columns[8] || "";
    const phone = columns[9] || shipFrom.phone;
    const email = columns[12] || undefined;
    const declaredValue = toNumber(columns[23] || columns[14], 0);
    const packageWeight = toNumber(columns[15], 0);
    const packageLength = toNumber(columns[16], 0);
    const packageWidth = toNumber(columns[17], 0);
    const packageHeight = toNumber(columns[18], 0);
    const requestedServiceCode = (columns[24] || "03").trim();
    const reference1 = columns[32] || undefined;

    if (!addressLine1 || !city || !state || !postalCode) {
      throw new Error(`Row ${index + 1} is missing a required destination field (address, city, state, or postal code).`);
    }

    return {
      rowNumber: index + 1,
      recipientName: contactName,
      companyName,
      destination: compactAddressLines(addressLine1, addressLine2, addressLine3, `${city}, ${state} ${postalCode}`),
      reference1,
      requestedServiceCode,
      requestedServiceName: SERVICE_NAMES[requestedServiceCode] ?? `UPS ${requestedServiceCode}`,
      shipment: {
        userId,
        shipFrom,
        shipTo: {
          name: contactName,
          company: companyName,
          phone,
          email,
          line1: compactAddressLines(addressLine1, addressLine2, addressLine3),
          city,
          state,
          postalCode,
          countryCode
        },
        packageLength,
        packageWidth,
        packageHeight,
        packageWeight,
        declaredValue,
        residential: normalizeResidential(columns[11]),
        signatureRequired: false,
        simpleRate: true,
        shipDate: new Date().toISOString()
      }
    } satisfies UpsBatchParsedRow;
  });
}
