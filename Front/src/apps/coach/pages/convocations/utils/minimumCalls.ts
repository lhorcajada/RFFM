/** Places in each matchday's squad when the team does not say otherwise. */
export const DEFAULT_MAX_CALLED_PLAYERS = 18;

export type MinimumCallsInput = {
  /** Matches already played that the player could have played. */
  playedAvailable: number;
  /** Places in each matchday's squad. */
  maxCalledPlayers: number;
  squadSize: number;
  /** 100 = the fair share; lower asks for fewer calls, higher for more. */
  percent: number;
};

/** Calls a player should reach: his fair share of the squad places (scaled by `percent`), never above the matches he could play. */
export function minimumCalls({ playedAvailable, maxCalledPlayers, squadSize, percent }: MinimumCallsInput): number {
  const share = Math.floor((playedAvailable * maxCalledPlayers * percent) / (Math.max(1, squadSize) * 100));
  return Math.max(0, Math.min(playedAvailable, share));
}
