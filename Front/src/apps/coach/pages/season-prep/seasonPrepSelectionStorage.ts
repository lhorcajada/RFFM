export type SeasonPrepSelectionState = {
  teamId?: string | null;
  teamName?: string | null;
  sportEventId?: string | null;
  sportEventName?: string | null;
};

const STORAGE_KEY = "rffm_season_prep_selection:v1";

export function loadSeasonPrepSelection(): SeasonPrepSelectionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SeasonPrepSelectionState;
  } catch {
    return null;
  }
}

export function saveSeasonPrepSelection(state: SeasonPrepSelectionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearSeasonPrepSelection(): void {
  localStorage.removeItem(STORAGE_KEY);
}
