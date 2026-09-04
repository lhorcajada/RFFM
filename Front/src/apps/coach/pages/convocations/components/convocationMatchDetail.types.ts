/** Minimal match info passed via router state from Convocations calendar */
export type MatchState = {
  date: string;
  time: string;
  localTeamName: string;
  localTeamShield: string;
  visitorTeamName: string;
  visitorTeamShield: string;
  isFinished: boolean;
  /** true if the user's team is playing as the local/home team */
  isHomeTeam: boolean;
  field: string;
  codacta: string | null;
  /** Kit number selected for this match (1 = primera, 2 = segunda, null = no selected). */
  selectedKitNumber: number | null;
  /** Google Maps (or similar) URL for the venue, when known. Null when the event has no
   *  configured map link — consumers should fall back to a search-based maps link. */
  locationMapUrl: string | null;
  /** Internal sport event id — lets the match detail screen re-fetch this match from the
   *  backend on a hard refresh (F5) or direct URL navigation, when router state is lost. */
  eventId: string | null;
};

/** One cell in the desconvocatorias grid */
export type GridCell = {
  /** null = no convocation record this match */
  statusId: number | null;
  excuseTypeId: number | null;
  statusName: string;
  excuseName: string | null;
};

/** A past match event enriched with the full convocation map */
export type MatchColumn = {
  eventId: string;
  /** Short label e.g. "J3 · 12 abr" */
  label: string;
  date: string;
  rival: string | null;
};

/** Drop zones for drag-and-drop convocation management */
export type DropZone = "available" | "called" | "notCalled";

/** Status IDs that count as convocado (called up): Pending (1) and Accepted (2) */
export const CALLED_STATUS_IDS: ReadonlySet<number> = new Set([1, 2]);

/** Status ID for pending acceptance (player has not yet confirmed) */
export const PENDING_STATUS_ID = 1;

/** Status ID used when calling up a player (Accepted) */
export const CALLED_STATUS_ID = 2;

/** Status ID for officially not called by coach (Deconvoke) */
export const NOT_CALLED_STATUS_ID = 5;

/** Status ID for justified absence */
export const JUSTIFIED_STATUS_ID = 4;

/** @deprecated — kept for backward compat; use CALLED_STATUS_IDS instead */
export const LEGACY_NOT_CALLED_STATUS_ID = -1;
