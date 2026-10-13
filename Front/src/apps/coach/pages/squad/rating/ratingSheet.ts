import type { PlayerRating } from "../../../types/playerRating";
import type { TeamRatingItem } from "../../../services/playerRatingService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import { isGoalkeeperPosition } from "./positionCategory";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  type CharacteristicDef,
} from "./ratingConcepts";

export type SheetType = "field" | "goalkeeper";

/** característica → nivel (1–10) */
export type PlayerLevels = Record<string, number>;

/** teamPlayerId → niveles del jugador */
export type SheetDraft = Record<string, PlayerLevels>;

export type SavePlan = {
  items: TeamRatingItem[];
  incompletePlayers: PlayerResponse[];
};

export function sheetOf(player: PlayerResponse): SheetType {
  return isGoalkeeperPosition(player.position) ? "goalkeeper" : "field";
}

export function characteristicsFor(sheet: SheetType): CharacteristicDef[] {
  return sheet === "goalkeeper" ? GOALKEEPER_CHARACTERISTICS : FIELD_PLAYER_CHARACTERISTICS;
}

export function buildInitialDraft(
  players: PlayerResponse[],
  latestRatings: Record<string, PlayerRating>,
): SheetDraft {
  const draft: SheetDraft = {};
  for (const player of players) {
    const sheetKeys = new Set(characteristicsFor(sheetOf(player)).map((c) => c.key));
    const levels: PlayerLevels = {};
    for (const answer of latestRatings[player.id]?.answers ?? []) {
      if (sheetKeys.has(answer.characteristicKey)) levels[answer.characteristicKey] = answer.level;
    }
    draft[player.id] = levels;
  }
  return draft;
}

export function isComplete(sheet: SheetType, levels: PlayerLevels): boolean {
  return characteristicsFor(sheet).every((c) => levels[c.key] != null);
}

function sameLevels(a: PlayerLevels, b: PlayerLevels): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function planSave(
  players: PlayerResponse[],
  draft: SheetDraft,
  baseline: SheetDraft,
  latestRatings: Record<string, PlayerRating>,
): SavePlan {
  const plan: SavePlan = { items: [], incompletePlayers: [] };
  for (const player of players) {
    const levels = draft[player.id] ?? {};
    if (sameLevels(levels, baseline[player.id] ?? {})) continue;

    const sheet = sheetOf(player);
    if (!isComplete(sheet, levels)) {
      plan.incompletePlayers.push(player);
      continue;
    }

    plan.items.push({
      teamPlayerId: player.id,
      isGoalkeeper: sheet === "goalkeeper",
      answers: characteristicsFor(sheet).map((c) => ({
        characteristicKey: c.key,
        level: levels[c.key],
        concept: c.levels[levels[c.key] - 1].concept,
        categoryKey: c.categoryKey,
      })),
      notes: latestRatings[player.id]?.notes ?? null,
    });
  }
  return plan;
}
