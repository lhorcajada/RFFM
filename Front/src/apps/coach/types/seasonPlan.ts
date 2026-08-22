// SeasonPlan hierarchy: SeasonPlan → Macrociclo → Mesociclo → Microciclo.
// One SeasonPlan per Team+Season, edited as a whole (full-aggregate CRUD), mirroring
// the GameModel tree shape. See openspec/changes/2026-08-11-add-coach-season-planning and
// openspec/changes/session-exercise-plan-redesign (Microciclo now links Sesiones, not
// Sesión A/B ADN targets directly).

/** Denormalized Subprincipio display fields — read-side only. */
export interface AdnSubprincipioSummary {
  id: string;
  numero: string;
  titulo: string;
  gameMomentName: string;
}

/** Denormalized SubSubPrincipio display fields — read-side only. */
export interface AdnSubSubPrincipioSummary {
  id: string;
  numero: string;
  rol: string;
}

/** Option offered by a Subprincipio picker — same shape as the read-side summary. */
export type AdnSubprincipioOption = AdnSubprincipioSummary;

/** Option offered by a SubSubPrincipio picker; carries its parent Subprincipio id so the
 * picker can narrow its list to children of the currently-selected Subprincipio. */
export interface AdnSubSubPrincipioOption {
  id: string;
  numero: string;
  rol: string;
  subprincipioId: string;
}

/** Flattened ADN tree for a team+season, used to feed the Exercise ModelRelationSection and
 * the Session's Microciclo/ADN pickers. Empty arrays (not an error) when the team has no
 * GameModel yet for that season. */
export interface AdnOptions {
  subprincipios: AdnSubprincipioOption[];
  subSubPrincipios: AdnSubSubPrincipioOption[];
}

/** Summary of a TrainingSession linked to a Microciclo. */
export interface SessionSummary {
  id: string;
  name: string;
  objetivoGeneral?: string | null;
  date: string;
  exerciseCount: number;
}

export interface Microciclo {
  /** Client-side key (negative = unsaved) — for reducer/list stability. */
  id: number;
  /** Backend UUID. */
  apiId?: string;
  order: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  /** TrainingSessions linked to this Microciclo — read side, populated from GetSeasonPlan. */
  sessions: SessionSummary[];
  /** Denormalized target-Subprincipio summaries — read side, populated from GetSeasonPlan. */
  subprincipiosObjetivo: AdnSubprincipioSummary[];
  /** Selected Subprincipio ids — write side, sent on create/update (replace-wholesale). */
  subprincipioObjetivoIds: string[];
}

export interface Mesociclo {
  id: number;
  apiId?: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  /** FK to the GameZone catalog (1=Iniciación, 2=Creación Propia, 3=Creación Rival, 4=Finalización). */
  gameZoneId: number;
  microciclos: Microciclo[];
}

export interface Macrociclo {
  id: number;
  apiId?: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  mesociclos: Mesociclo[];
}

export interface SeasonPlan {
  id: string;
  teamId: string;
  seasonId: string;
  macrociclos: Macrociclo[];
}

export interface GameZoneCatalogItem {
  id: number;
  name: string;
  order: number;
}
