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

/** Status ID used when calling up a player */
export const CALLED_STATUS_ID = 1;

/** Status ID for officially not called (desconvocado) — maps to "Deconvoke" (5) on the backend */
export const NOT_CALLED_STATUS_ID = 5;

/** Legacy status ID that was incorrectly used for desconvocados; kept for backward-compat loading */
export const LEGACY_NOT_CALLED_STATUS_ID = 2;
