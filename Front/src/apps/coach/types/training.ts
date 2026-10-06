// Exercise ("Ejercicio") and TrainingSession ("Sesión") types, mirroring the backend's
// reduced-template model (docs/game-model/Plantilla-Ejercicio.md,
// docs/game-model/Plantilla-Sesion.md). See openspec/changes/session-exercise-plan-redesign.

export type ExerciseTipo = "Analitico" | "Situacional" | "Global";

/** Independiente del Tipo: cualquier subtipo se puede combinar con cualquier tipo. */
export type ExerciseSubtipo =
  | "RuedasDePase"
  | "Rondos"
  | "AtaqueOrganizado"
  | "DefensaOrganizada"
  | "TransicionDefensaAtaque"
  | "TransicionAtaqueDefensa"
  | "Abp"
  | "Posesion"
  | "Mantenimiento"
  | "JuegosLudicos"
  | "Circuito"
  | "JuegoDePosicion"
  | "PartidoCondicionado"
  | "Partido";

export interface ExerciseLevelRow {
  nivel: number;
  valores: Record<string, string>;
}

/** Denormalized display fields for an ExerciseModelRelationItem — read-side only. */
export interface ExerciseModelRelationItem {
  id: string;
  subSubPrincipioId: string;
  subSubPrincipioNumero?: string | null;
  subSubPrincipioRol?: string | null;
  isFoco: boolean;
}
export type ExerciseModelRelationItemRequest = Pick<ExerciseModelRelationItem, "subSubPrincipioId" | "isFoco">;

/** Denormalized display fields for an ExerciseModelRelation — read-side only. */
export interface ExerciseModelRelation {
  id: string;
  subprincipioId: string;
  subprincipioNumero?: string | null;
  subprincipioTitulo?: string | null;
  isFoco: boolean;
  habilidadesImprescindibles: string[];
  items: ExerciseModelRelationItem[];
}
export interface ExerciseModelRelationRequest {
  subprincipioId: string;
  isFoco: boolean;
  habilidadesImprescindibles: string[];
  items: ExerciseModelRelationItemRequest[];
}

export interface Exercise {
  id: string;
  name: string;
  tipo: ExerciseTipo;
  subtipo?: ExerciseSubtipo | null;
  objetivo: string;
  objetivoPorRol?: string | null;
  modelRelations: ExerciseModelRelation[];
  nivelesColumnas: string[];
  niveles: ExerciseLevelRow[];
  logistica: string;
  durationMinutes?: number | null;
  porteros?: string | null;
  dibujo?: string | null;
  descripcion: string;
  urlImage?: string | null;
  boardStateJson?: string | null;
  /** True when `modelRelations.length > 0` (also sent directly by the API). */
  isAssociatedToGameModel: boolean;
}

export interface CreateExerciseRequest {
  clubId: string;
  name: string;
  tipo: ExerciseTipo;
  subtipo?: ExerciseSubtipo | null;
  objetivo: string;
  objetivoPorRol?: string | null;
  modelRelations: ExerciseModelRelationRequest[];
  nivelesColumnas: string[];
  niveles: ExerciseLevelRow[];
  logistica: string;
  durationMinutes?: number | null;
  porteros?: string | null;
  dibujo?: string | null;
  descripcion: string;
  boardStateJson?: string | null;
}
export type UpdateExerciseRequest = Omit<CreateExerciseRequest, "clubId">;

export interface SessionBlockExercise {
  id: string;
  exerciseId: string;
  position: number;
  /** Campos con los que `GET /api/trainings/sessions/{id}` envía el ejercicio (`SessionBlockExerciseDetail`). */
  name?: string;
  tipo?: ExerciseTipo;
  objetivo?: string;
  durationMinutes?: number | null;
  urlImage?: string | null;
  /** @deprecated La API no envía estos nombres; se mantienen porque `sessionPrint.ts` aún los lee. */
  exerciseName?: string;
  exerciseTipo?: ExerciseTipo;
  exerciseObjetivo?: string;
  exerciseDurationMinutes?: number | null;
  exerciseUrlImage?: string | null;
}
export type SessionBlockExerciseRequest = Pick<SessionBlockExercise, "exerciseId" | "position">;

export interface SessionBlock {
  id: string;
  order: number;
  nombre: string;
  rotacionEntreEjercicios?: string | null;
  exercises: SessionBlockExercise[];
}
export type SessionBlockRequest = Omit<SessionBlock, "id" | "exercises"> & {
  exercises: SessionBlockExerciseRequest[];
};

/** One Sub-subprincipio targeted by a TrainingSession, full ADN breadcrumb inlined (Fase ›
 * Principio › Subprincipio › Zona › Rol) so a target chip never needs a second lookup against
 * the GameModel tree. Mirrors the backend's `SessionTargetDetail` record exactly (see
 * `Back/ExtractionApi/.../Trainings/Sessions/GetSession.cs`). */
export interface SessionTargetDetail {
  subSubPrincipioId: string;
  rol: string;
  numero: string;
  subprincipioId: string;
  subprincipioTitulo: string;
  zonaId?: string | null;
  zonaLabel?: string | null;
  principioId: string;
  principioTitulo: string;
  gameMomentId: number;
  gameMomentName: string;
  /** Descripción del sub-subprincipio en el modelo de juego. */
  texto?: string;
}

export interface TrainingSession {
  id: string;
  name: string;
  description: string;
  /** Nullable — an "unscheduled" (content-first) session has no date yet. */
  date: string | null;
  /** Nullable — an "unscheduled" session has no start time yet. */
  startTime: string | null;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  sportEventName?: string | null;
  microcicloId?: string | null;
  microcicloWeekLabel?: string | null;
  /** True when `microcicloId != null`. */
  isAssociatedToPlan: boolean;
  exerciseCount: number;
  targets: SessionTargetDetail[];
}

export interface TrainingSessionDetail extends Omit<TrainingSession, "exerciseCount"> {
  objetivoGeneral?: string | null;
  mapaCampoTexto?: string | null;
  urlImage?: string | null;
  blocks: SessionBlock[];
}

export interface CreateSessionRequest {
  teamId: string;
  name: string;
  description: string;
  /** Nullable — creating an unscheduled ("content-first") session sends `date: null`. */
  date: string | null;
  /** Nullable — see `date`. */
  startTime: string | null;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  microcicloId?: string | null;
  objetivoGeneral?: string | null;
  mapaCampoTexto?: string | null;
  blocks: SessionBlockRequest[];
  targetSubSubPrincipioIds: string[];
}
export type UpdateSessionRequest = Omit<CreateSessionRequest, "teamId">;
