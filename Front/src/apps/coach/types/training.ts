export type ExerciseType =
  | "Physical"
  | "Technical"
  | "Tactical"
  | "Game"
  | "Cognitive"
  | "Psychological";
export type ExerciseSection = "Calentamiento" | "Principal" | "VueltaALaCalma";
export type ExerciseMethodology = "Analitico" | "Integrado" | "Global";

export interface ExerciseCondition {
  id: string;
  text: string;
  order: number;
}

/** A link from an exercise to a single Subprincipio or SubSubPrincipio of the team's
 * GameModel (exactly one of the two id pairs is populated), tagged FOCO/INTEGRADO.
 * Denormalized display fields are read-side only, populated from GetExercises/GetExerciseById. */
export interface ExerciseModelLink {
  id: string;
  subprincipioId?: string | null;
  subprincipioNumero?: string | null;
  subprincipioTitulo?: string | null;
  subSubPrincipioId?: string | null;
  subSubPrincipioNumero?: string | null;
  subSubPrincipioRol?: string | null;
  isFoco: boolean;
}

/** Write-side shape of an `ExerciseModelLink`, sent on create/update. */
export interface ExerciseModelLinkRequest {
  subprincipioId?: string | null;
  subSubPrincipioId?: string | null;
  isFoco: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  types: ExerciseType[];
  section: ExerciseSection;
  methodology: ExerciseMethodology;
  durationTotal: number;
  playersNumber: number;
  goalPeekersNumber: number;
  fieldSpace: string;
  urlImage?: string | null;
  boardStateJson?: string | null;
  conditions: ExerciseCondition[];
  // Type-specific (only present from list endpoint now)
  series?: number;
  durationSeries?: number;
  restSeries?: number;
  touchesNumber?: number;
  wildCards?: number;
  /** Optional link to a SeasonPlan Microciclo (week of the season planning calendar). */
  microcicloId?: string | null;
  /** GameModel Subprincipio/SubSubPrincipio links this exercise trains, tagged FOCO/INTEGRADO. */
  modelLinks: ExerciseModelLink[];
  /** Closed-vocabulary Habilidad names this exercise targets — see `HABILIDAD_VOCABULARY`. */
  habilidades: string[];
}

export interface CreateExerciseRequest {
  clubId: string;
  name: string;
  description: string;
  types: ExerciseType[];
  section: ExerciseSection;
  methodology: ExerciseMethodology;
  durationTotal: number;
  playersNumber: number;
  goalPeekersNumber: number;
  fieldSpace: string;
  boardStateJson?: string | null;
  // Physical
  series?: number;
  durationSeries?: number;
  restSeries?: number;
  // Technical/Tactical
  touchesNumber?: number;
  wildCards?: number;
  /** Optional link to a SeasonPlan Microciclo (week of the season planning calendar). */
  microcicloId?: string | null;
  /** GameModel Subprincipio/SubSubPrincipio links this exercise trains, tagged FOCO/INTEGRADO. */
  modelLinks: ExerciseModelLinkRequest[];
  /** Closed-vocabulary Habilidad names this exercise targets — see `HABILIDAD_VOCABULARY`. */
  habilidades: string[];
}

export type UpdateExerciseRequest = Omit<CreateExerciseRequest, "clubId">;

export interface TrainingSession {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  sportEventName?: string | null;
  exerciseCount: number;
}

export interface SessionExerciseItem {
  taskTrainingId: string;
  order: number;
  exerciseId: string;
  name: string;
  description: string;
  types: ExerciseType[];
  section: ExerciseSection;
  durationTotal: number;
  playersNumber: number;
  goalPeekersNumber: number;
  fieldSpace: string;
  urlImage?: string | null;
  boardStateJson?: string | null;
  conditions: ExerciseCondition[];
}

export interface TrainingSessionDetail {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  sportEventName?: string | null;
  exercises: SessionExerciseItem[];
}

export interface SessionExerciseEntry {
  exerciseId: string;
  section: ExerciseSection;
}

export interface CreateSessionRequest {
  teamId: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  exercises: SessionExerciseEntry[];
}

export type UpdateSessionRequest = Omit<CreateSessionRequest, "teamId">;
