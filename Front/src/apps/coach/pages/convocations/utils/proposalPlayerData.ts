import type { PlayerProposal } from "./deconvokeProposal";

/** What the proposal computed for a player, without the decision taken about him. */
export type PlayerData = Pick<
  PlayerProposal,
  "calledCount" | "startsCount" | "startsDataAvailable" | "minRequiredCalls" | "weeklyTraining" | "detail"
>;

export type PlayerDataRow = { label: string; value: string };

/** Detail rows that state a reason of the proposal, not a figure the proposal is based on. */
const REASON_RULES = new Set(["Regla obligatoria", "Mínimo por posición"]);

export function playerDataChips(data: PlayerData): string[] {
  const chips = [`${data.calledCount} conv.`];
  if (data.startsDataAvailable) chips.push(`${data.startsCount} tit.`);
  chips.push(`Mín. conv: ${data.minRequiredCalls}`);
  if (data.weeklyTraining.totalTrainings > 0) {
    chips.push(`${data.weeklyTraining.attendedTrainings}/${data.weeklyTraining.totalTrainings} entrenos`);
  }
  return chips;
}

export function playerDataRows(data: PlayerData): PlayerDataRow[] {
  return data.detail
    .filter((row) => !REASON_RULES.has(row.rule))
    .map((row) => ({ label: row.rule, value: row.value }));
}
