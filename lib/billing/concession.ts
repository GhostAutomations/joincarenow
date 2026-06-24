// Translate the free-text sales concession (prospect.proposed_offer / company
// .agreed_offer) into structured billing instructions applied at checkout.
//   "3 months free"      -> freeMonths: 3        (100% off coupon)
//   "+100 SMS a month"   -> extraSms: 100        (added to the monthly allowance)
//   "£45/mo" / "£45"     -> customMonthlyPence: 4500  (custom recurring price)
// Unrecognised text is kept in `raw` and applied as nothing (founder can adjust
// manually in the billing console).

export type Concession = {
  raw: string;
  freeMonths?: number;
  extraSms?: number;
  customMonthlyPence?: number;
};

export function parseConcession(offer: string | null | undefined): Concession | null {
  const raw = (offer ?? "").trim();
  if (!raw) return null;
  const c: Concession = { raw };

  const months = raw.match(/(\d+)\s*month/i);
  if (months) c.freeMonths = Math.min(12, parseInt(months[1], 10));

  const sms = raw.match(/\+?\s*(\d+)\s*sms/i);
  if (sms) c.extraSms = parseInt(sms[1], 10);

  const price = raw.match(/£\s*(\d+(?:\.\d{1,2})?)/);
  if (price) c.customMonthlyPence = Math.round(parseFloat(price[1]) * 100);

  return c;
}

/** Short human label for the founder/timeline. */
export function describeConcession(c: Concession | null): string | null {
  if (!c) return null;
  const bits: string[] = [];
  if (c.freeMonths) bits.push(`${c.freeMonths} month${c.freeMonths === 1 ? "" : "s"} free`);
  if (c.customMonthlyPence) bits.push(`£${(c.customMonthlyPence / 100).toFixed(2)}/mo custom price`);
  if (c.extraSms) bits.push(`+${c.extraSms} SMS/mo`);
  return bits.length ? bits.join(", ") : c.raw;
}
