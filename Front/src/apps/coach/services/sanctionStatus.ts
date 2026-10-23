import type { SanctionRecord } from "./teamplayerSanctionService";

/** Pending fine amount: the backend's computed `pendingAmount` when present,
 * otherwise `fine - amountPaid`; `null` for sanctions without a fine. */
export function getPendingAmount(sanction: SanctionRecord): number | null {
  if (sanction.pendingAmount != null) return sanction.pendingAmount;
  return sanction.fine != null ? sanction.fine - (sanction.amountPaid ?? 0) : null;
}

export function isSanctionNotServed(sanction: SanctionRecord): boolean {
  return sanction.status ? sanction.status !== "Fulfilled" : !sanction.endDate;
}

/** A sanction counts as pending when the sportive punishment hasn't been served yet
 * (status/endDate) OR there is still an unpaid fine, whichever comes first. */
export function isSanctionPending(sanction: SanctionRecord): boolean {
  const pendingAmount = getPendingAmount(sanction);
  return isSanctionNotServed(sanction) || (pendingAmount != null && pendingAmount > 0);
}
