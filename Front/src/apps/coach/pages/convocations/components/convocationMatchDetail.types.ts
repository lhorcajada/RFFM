/** Minimal match info passed via router state from Convocations calendar */
export type MatchState = {
  date: string;
  time: string;
  localTeamName: string;
  localTeamShield: string;
  visitorTeamName: string;
  visitorTeamShield: string;
  isFinished: boolean;
  field: string;
  codacta: string | null;
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
export type DropZone = "available" | "called" | "notCalled" | "noDisponible";

/** Status IDs considered "not called up" / "declined" */
export const NOT_CALLED_STATUS_IDS = new Set([2, 3]); // 2=Desconvocado, 3=No disponible

/** Status ID used when calling up a player */
export const CALLED_STATUS_ID = 1;

/** Status ID for officially not called (desconvocado) */
export const NOT_CALLED_STATUS_ID = 2;

/** Status ID for no disponible */
export const NO_DISPONIBLE_STATUS_ID = 3;
