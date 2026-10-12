import type { CardEvent } from "../components/simulation/liveMatch.types";
import type { FormationSlotDef } from "../../../types/formation";

export type CardStatus = "none" | "yellow" | "red" | "doubleYellow";

const GOALKEEPER_SLOT_INDEX = 0;

/** Card situation of an own-team player in the match, as shown on their photo. */
export function getCardStatus(cards: CardEvent[], teamPlayerId: string): CardStatus {
  const own = cards.filter((c) => !c.isRivalPlayer && c.teamPlayerId === teamPlayerId);
  if (own.some((c) => c.cardType === "red")) return "red";
  const yellows = own.filter((c) => c.cardType === "yellow").length;
  if (yellows >= 2) return "doubleYellow";
  return yellows === 1 ? "yellow" : "none";
}

export function isExpelledStatus(status: CardStatus): boolean {
  return status === "red" || status === "doubleYellow";
}

/** Own-team players sent off: direct red card or second yellow card. */
export function getExpelledIds(cards: CardEvent[]): Set<string> {
  const expelled = new Set<string>();
  for (const card of cards) {
    if (card.isRivalPlayer || !card.teamPlayerId || expelled.has(card.teamPlayerId)) continue;
    if (isExpelledStatus(getCardStatus(cards, card.teamPlayerId))) expelled.add(card.teamPlayerId);
  }
  return expelled;
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

/**
 * Places the players who stay on the field into the slots of the formation applied after an
 * expulsion. The goalkeeper keeps the goal; if the goalkeeper is the one sent off, one of the
 * remaining players (chosen by `pickIndex`) takes it until the coach decides.
 */
export function relocateAfterExpulsion(
  slots: Record<number, string | null>,
  expelledId: string,
  newSlotDefs: FormationSlotDef[],
  pickIndex: (length: number) => number = randomIndex,
): Record<number, string | null> {
  const remaining = Object.entries(slots)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, playerId]) => playerId)
    .filter((playerId): playerId is string => !!playerId && playerId !== expelledId);

  const currentGoalkeeper = slots[GOALKEEPER_SLOT_INDEX] ?? null;
  const keepsGoalkeeper = currentGoalkeeper !== null && currentGoalkeeper !== expelledId;
  const goalkeeper = keepsGoalkeeper ? currentGoalkeeper : (remaining[pickIndex(remaining.length)] ?? null);
  const outfield = remaining.filter((playerId) => playerId !== goalkeeper);

  const result: Record<number, string | null> = {};
  let nextOutfield = 0;
  for (const def of newSlotDefs) {
    if (def.slotIndex === GOALKEEPER_SLOT_INDEX) {
      result[def.slotIndex] = goalkeeper;
    } else {
      result[def.slotIndex] = outfield[nextOutfield] ?? null;
      nextOutfield += 1;
    }
  }
  return result;
}
