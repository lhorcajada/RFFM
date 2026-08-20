// SeasonPlan hierarchy: SeasonPlan → Macrociclo → Mesociclo → Microciclo.
// One SeasonPlan per Team+Season, edited as a whole (full-aggregate CRUD), mirroring
// the GameModel tree shape. See openspec/changes/2026-08-11-add-coach-season-planning.

/** Denormalized Subprincipio display fields for a Microciclo session link — read-side only. */
export interface AdnSubprincipioSummary {
  id: string;
  numero: string;
  titulo: string;
  gameMomentName: string;
}

/** Denormalized SubSubPrincipio display fields for a Microciclo session link — read-side only. */
export interface AdnSubSubPrincipioSummary {
  id: string;
  numero: string;
  rol: string;
}

/** Option offered by a Subprincipio picker — same shape as the read-side summary. */
export type AdnSubprincipioOption = AdnSubprincipioSummary;

/** Option offered by a SubSubPrincipio picker; carries its parent Subprincipio id so the
 * picker can narrow its list to children of the currently-selected Subprincipios. */
export interface AdnSubSubPrincipioOption {
  id: string;
  numero: string;
  rol: string;
  subprincipioId: string;
}

/** Flattened ADN tree for a team+season, used to feed the Microciclo session pickers.
 * Empty arrays (not an error) when the team has no GameModel yet for that season. */
export interface AdnOptions {
  subprincipios: AdnSubprincipioOption[];
  subSubPrincipios: AdnSubSubPrincipioOption[];
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
  objetivoSesionA: string;
  objetivoSesionB: string;
  /** Number of exercises (TaskTrainingBase rows) linked to this Microciclo. */
  exerciseCount: number;
  /** Selected Subprincipio ids for Sesión A — write side (sent on create/update). */
  sesionASubprincipioIds: string[];
  /** Selected SubSubPrincipio ids for Sesión A — write side. */
  sesionASubSubPrincipioIds: string[];
  /** Selected Habilidad names for Sesión A (closed 15-value vocabulary). */
  sesionAHabilidades: string[];
  /** Denormalized Subprincipio summaries for Sesión A — read side, populated from GetSeasonPlan. */
  sesionASubprincipios: AdnSubprincipioSummary[];
  /** Denormalized SubSubPrincipio summaries for Sesión A — read side. */
  sesionASubSubPrincipios: AdnSubSubPrincipioSummary[];
  /** Selected Subprincipio ids for Sesión B — write side. */
  sesionBSubprincipioIds: string[];
  /** Selected SubSubPrincipio ids for Sesión B — write side. */
  sesionBSubSubPrincipioIds: string[];
  /** Selected Habilidad names for Sesión B. */
  sesionBHabilidades: string[];
  /** Denormalized Subprincipio summaries for Sesión B — read side. */
  sesionBSubprincipios: AdnSubprincipioSummary[];
  /** Denormalized SubSubPrincipio summaries for Sesión B — read side. */
  sesionBSubSubPrincipios: AdnSubSubPrincipioSummary[];
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
