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
