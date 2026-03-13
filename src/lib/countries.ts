type CountryOption = {
  value: string;
  label: string;
};

const countryCodes = [
  "AE", "AR", "AT", "AU", "BE", "BG", "BH", "BR", "CA", "CH", "CL", "CN", "CO", "CR", "CY", "CZ",
  "DE", "DK", "DO", "DZ", "EC", "EE", "EG", "ES", "FI", "FR", "GB", "GH", "GR", "GT", "HK", "HN",
  "HR", "HU", "ID", "IE", "IL", "IN", "IS", "IT", "JM", "JO", "JP", "KE", "KR", "KW", "KZ", "LB",
  "LI", "LT", "LU", "LV", "MA", "MD", "ME", "MX", "MY", "NG", "NI", "NL", "NO", "NZ", "OM", "PA",
  "PE", "PH", "PK", "PL", "PR", "PT", "PY", "QA", "RO", "RS", "SA", "SE", "SG", "SI", "SK", "SV",
  "TH", "TN", "TR", "TW", "UA", "US", "UY", "VN", "ZA"
] as const;

export const COUNTRY_OPTIONS: CountryOption[] = [...countryCodes]
  .map((value) => ({
    value,
    label: new Intl.DisplayNames(["en"], { type: "region" }).of(value) ?? value
  }))
  .sort((left, right) => left.label.localeCompare(right.label));
