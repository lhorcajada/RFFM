export interface SeasonPrepTestSimulationState {
  version: 1;
  sportEventId?: string | null;
  blueSlots: Record<number, string | null>;
  redSlots: Record<number, string | null>;
  started: boolean;
  updatedAt: string;
}

function getStorageKey(sportEventId?: string | null): string {
  return `rffm_season_prep_test_simulation:v1:${sportEventId ?? "global"}`;
}

export function loadSeasonPrepTestSimulation(sportEventId?: string | null): SeasonPrepTestSimulationState | null {
  try {
    const raw = localStorage.getItem(getStorageKey(sportEventId));
    if (!raw) return null;
    return JSON.parse(raw) as SeasonPrepTestSimulationState;
  } catch {
    return null;
  }
}

export function saveSeasonPrepTestSimulation(state: SeasonPrepTestSimulationState, sportEventId?: string | null): void {
  localStorage.setItem(getStorageKey(sportEventId ?? state.sportEventId ?? null), JSON.stringify(state));
}

export function clearSeasonPrepTestSimulation(sportEventId?: string | null): void {
  localStorage.removeItem(getStorageKey(sportEventId));
}
