// Shared country list for address + phone fields.
// `dial` is the international calling code (no plus). Ordered with the UK and
// the most common origin countries for UK care workers near the top, then A–Z.

export type Country = { name: string; iso: string; dial: string };

export const COUNTRIES: Country[] = [
  { name: "United Kingdom", iso: "GB", dial: "44" },
  { name: "Ireland", iso: "IE", dial: "353" },
  { name: "Philippines", iso: "PH", dial: "63" },
  { name: "India", iso: "IN", dial: "91" },
  { name: "Nigeria", iso: "NG", dial: "234" },
  { name: "Zimbabwe", iso: "ZW", dial: "263" },
  { name: "Ghana", iso: "GH", dial: "233" },
  { name: "Kenya", iso: "KE", dial: "254" },
  { name: "South Africa", iso: "ZA", dial: "27" },
  { name: "Romania", iso: "RO", dial: "40" },
  { name: "Poland", iso: "PL", dial: "48" },
  { name: "Portugal", iso: "PT", dial: "351" },
  { name: "Spain", iso: "ES", dial: "34" },
  { name: "Italy", iso: "IT", dial: "39" },
  { name: "Nepal", iso: "NP", dial: "977" },
  { name: "Sri Lanka", iso: "LK", dial: "94" },
  { name: "Bangladesh", iso: "BD", dial: "880" },
  { name: "Pakistan", iso: "PK", dial: "92" },
  { name: "Zambia", iso: "ZM", dial: "260" },
  { name: "Uganda", iso: "UG", dial: "256" },
  // --- A–Z remainder ---
  { name: "Australia", iso: "AU", dial: "61" },
  { name: "Bulgaria", iso: "BG", dial: "359" },
  { name: "Canada", iso: "CA", dial: "1" },
  { name: "France", iso: "FR", dial: "33" },
  { name: "Germany", iso: "DE", dial: "49" },
  { name: "Hungary", iso: "HU", dial: "36" },
  { name: "Jamaica", iso: "JM", dial: "1" },
  { name: "Latvia", iso: "LV", dial: "371" },
  { name: "Lithuania", iso: "LT", dial: "370" },
  { name: "Malawi", iso: "MW", dial: "265" },
  { name: "Malaysia", iso: "MY", dial: "60" },
  { name: "Netherlands", iso: "NL", dial: "31" },
  { name: "New Zealand", iso: "NZ", dial: "64" },
  { name: "Slovakia", iso: "SK", dial: "421" },
  { name: "United States", iso: "US", dial: "1" },
];

/** Build E.164 (+<dial><national>) from a dial code and a typed national number.
 *  Strips spaces/punctuation and a single leading 0 from the national part. */
export function toE164(dial: string, national: string): string {
  const digits = (national || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return `+${dial}${digits}`;
}
