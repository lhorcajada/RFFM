import type { ExcuseType } from "../../../services/excuseTypeService";

export const INJURY_EXCUSE_ID = 1;
/** Used by the backend for both federation and coach (internal discipline) sanctions. */
export const SANCTION_EXCUSE_ID = 8;

export type MatchUnavailability = { excuseTypeId: number; reason: string };

function isTechnicalDecision(excuse: ExcuseType): boolean {
  return excuse.name.toLowerCase().includes("decisi");
}

/**
 * Players not available for the match: deconvoked with any reason other than a technical
 * decision, including those who answered "not available".
 */
export function buildMatchUnavailability(
  notCalledIds: string[],
  excuseMap: Record<string, number | null>,
  excuseTypes: ExcuseType[],
): Map<string, MatchUnavailability> {
  const excuseById = new Map(excuseTypes.map((e) => [e.id, e]));
  const unavailable = new Map<string, MatchUnavailability>();
  for (const playerId of notCalledIds) {
    const excuseId = excuseMap[playerId];
    const excuse = excuseId != null ? excuseById.get(excuseId) : undefined;
    if (excuse && !isTechnicalDecision(excuse)) {
      unavailable.set(playerId, { excuseTypeId: excuse.id, reason: excuse.name });
    }
  }
  return unavailable;
}
