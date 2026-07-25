export type ExerciseType =
  | "Physical"
  | "Technical"
  | "Tactical"
  | "Game"
  | "Cognitive"
  | "Psychological";
export type ExerciseSection = "Calentamiento" | "Principal" | "VueltaALaCalma";

export interface SkillCoverage {
  essentialSkillId: string;
  skillName: string;
}

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
  durationTotal: number;
  playersNumber: number;
  goalPeekersNumber: number;
  fieldSpace: string;
  subSubPrincipleId?: string | null;
  subSubPrincipleName?: string | null;
  subPrincipleId?: string | null;
  subPrincipleName?: string | null;
  skills: SkillCoverage[];
  urlImage?: string | null;
  boardStateJson?: string | null;
  conditions: ExerciseCondition[];
  // Type-specific (only present from list endpoint now)
  series?: number;
  durationSeries?: number;
  restSeries?: number;
  touchesNumber?: number;
  wildCards?: number;
}

export interface CreateExerciseRequest {
  clubId: string;
  name: string;
  description: string;
  types: ExerciseType[];
  section: ExerciseSection;
  durationTotal: number;
  playersNumber: number;
  goalPeekersNumber: number;
  fieldSpace: string;
  subSubPrincipleId?: string | null;
  subPrincipleId?: string | null;
  essentialSkillIds: string[];
  boardStateJson?: string | null;
  // Physical
  series?: number;
  durationSeries?: number;
  restSeries?: number;
  // Technical/Tactical
  touchesNumber?: number;
  wildCards?: number;
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
  subPrincipleId?: string | null;
  subPrincipleName?: string | null;
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
  skills: SkillCoverage[];
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
  subPrincipleId?: string | null;
  exercises: SessionExerciseEntry[];
}

export type UpdateSessionRequest = Omit<CreateSessionRequest, "teamId">;
