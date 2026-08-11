// ADN hierarchy: GameModel → Principle → Subprincipio → (Zona 0..N | direct) → SubSubPrincipio → Habilidad
// Notas anchor to Principle/Subprincipio/Zona/SubSubPrincipio and arrive nested at their level.
// SetPieceRule (flat, Balón Parado) and OpenIssue are top-level, flat lists.
// See docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md

export type NotaTipo = "riesgo-aceptado" | "objetivo-temporada" | "nota" | "excepcion";

export const NOTA_TIPOS: NotaTipo[] = [
  "riesgo-aceptado",
  "objetivo-temporada",
  "nota",
  "excepcion",
];

export const NOTA_TIPO_LABELS: Record<NotaTipo, string> = {
  "riesgo-aceptado": "Riesgo aceptado",
  "objetivo-temporada": "Objetivo de temporada",
  nota: "Nota",
  excepcion: "Excepción",
};

/** The 14-value closed vocabulary — spec §4. */
export const HABILIDAD_VOCABULARY = [
  "Perfilamiento",
  "Anticipación",
  "Activación",
  "Carga",
  "Temporización",
  "Comunicación",
  "Entrada",
  "Conducción",
  "Protección de balón",
  "Control orientado",
  "Pase",
  "Centro",
  "Remate",
  "Remate de cabeza",
] as const;

export type HabilidadNombre = (typeof HABILIDAD_VOCABULARY)[number];

/** Zone key tokens — spec §1, plus the pseudo-values "todas"/"compuesta". */
export const ZONE_KEY_OPTIONS: { key: string; label: string }[] = [
  { key: "iniciacion", label: "Zona de Iniciación" },
  { key: "creacion-propia", label: "Zona de Creación Propia" },
  { key: "creacion-rival", label: "Zona de Creación Rival" },
  { key: "finalizacion", label: "Zona de Finalización" },
  { key: "todas", label: "Todas las zonas" },
  { key: "compuesta", label: "Compuesta (caso especial)" },
];

/** Balón Parado subtypes — spec §5. */
export const SET_PIECE_SUBTYPES = [
  "corners-defensivos",
  "corners-ofensivos",
  "faltas-defendiendo",
  "faltas-atacando",
  "saques-banda",
  "saque-porteria",
  "saque-centro",
  "penaltis",
] as const;

export type SetPieceSubtype = (typeof SET_PIECE_SUBTYPES)[number];

export const SET_PIECE_SUBTYPE_LABELS: Record<SetPieceSubtype, string> = {
  "corners-defensivos": "Córners defensivos",
  "corners-ofensivos": "Córners ofensivos",
  "faltas-defendiendo": "Faltas defendiendo",
  "faltas-atacando": "Faltas atacando",
  "saques-banda": "Saques de banda",
  "saque-porteria": "Saque de portería",
  "saque-centro": "Saque de centro",
  penaltis: "Penaltis",
};

export const OPEN_ISSUE_STATUSES = ["open", "resolved"] as const;
export type OpenIssueStatus = (typeof OPEN_ISSUE_STATUSES)[number];

// ── Entities ──────────────────────────────────────────────────────────

export interface Habilidad {
  /** Client-side key (negative = unsaved) — for reducer/list stability. */
  id: number;
  /** Backend UUID. */
  apiId?: string;
  nombre: string;
  descripcion: string;
  entrenable: string;
  referenciaAKey?: string | null;
}

export interface Nota {
  id: number;
  apiId?: string;
  tipo: NotaTipo;
  texto: string;
}

export interface SubSubPrincipio {
  id: number;
  apiId?: string;
  key?: string;
  numero: string;
  rol: string;
  texto: string;
  habilidades: Habilidad[];
  notas: Nota[];
}

export interface Zona {
  id: number;
  apiId?: string;
  key?: string;
  /** Zone key tokens, e.g. ["creacion-propia", "iniciacion"]. */
  zoneKeys: string[];
  /** Optional sub-grouping label within the same Subprincipio, e.g. "Ataque del centro". */
  label?: string | null;
  /** Free text for a "compuesta" zone that doesn't fit the catalog. */
  zonaTexto?: string | null;
  texto: string;
  subSubPrincipios: SubSubPrincipio[];
  notas: Nota[];
}

export interface Subprincipio {
  id: number;
  apiId?: string;
  key?: string;
  /** Literal numbering as written in the legible document, e.g. "1.1". */
  numero: string;
  titulo: string;
  texto: string;
  /** Mutually exclusive with subSubPrincipios — a Subprincipio's children hang either off
   * its Zonas (if any) or directly off it, never both. */
  zonas: Zona[];
  subSubPrincipios: SubSubPrincipio[];
  notas: Nota[];
}

export interface Principle {
  id: number;
  apiId?: string;
  key?: string;
  gameMomentId: number;
  gameMomentName?: string;
  /** Literal numbering as written in the legible document, e.g. 1. */
  numero: number;
  titulo: string;
  texto: string;
  subprincipios: Subprincipio[];
  notas: Nota[];
}

export interface SetPieceRule {
  id: number;
  apiId?: string;
  subtype: string;
  texto: string;
}

export interface OpenIssue {
  id: number;
  apiId?: string;
  topic: string;
  description: string;
  status: string;
}

export interface GameModel {
  id: string;
  teamId: string;
  name: string;
  season: string;
  principles: Principle[];
  setPieceRules: SetPieceRule[];
  openIssues: OpenIssue[];
}

// ── Catalogs ──────────────────────────────────────────────────────────

export interface GameMomentCatalogItem {
  id: number;
  name: string;
  order: number;
}
