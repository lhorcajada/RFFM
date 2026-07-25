export interface SkillOption {
  id: string;
  name: string;
  description: string;
}

export interface NavState {
  returnTo?: string;
}

export interface ChapaPosition {
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  locked?: boolean;
  anonymous?: boolean;
}

export interface PetoOption {
  key: string;
  label: string;
  color: string;
}

export type MaterialKind =
  | "balones"
  | "setas"
  | "conos"
  | "vallas"
  | "aros"
  | "miniporterias"
  | "picas"
  | "porterias-f11";

export interface MaterialTemplate {
  key: MaterialKind;
  label: string;
}

export interface PlacedMaterial {
  id: string;
  kind: MaterialKind;
  x: number;
  y: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  locked?: boolean;
}

export type SpaceKind =
  | "square"
  | "rectangle"
  | "triangle"
  | "pentagon"
  | "hexagon"
  | "heptagon"
  | "octagon"
  | "circle";

export interface SpacePosition {
  id: string;
  kind: SpaceKind;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  locked: boolean;
  color?: string;
}

export interface SpaceTemplate {
  kind: SpaceKind;
  label: string;
}

export interface Vertex {
  x: number;
  y: number;
}

export interface ResizeSession {
  spaceId: string;
  handle: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startScaleX: number;
  startScaleY: number;
  startX: number;
  startY: number;
  rotationDeg: number;
  touchlineBandPercent: number;
  goalBackBandPercent: number;
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type LineKind = "straight" | "dashed" | "arrow" | "arrow-dashed" | "curved" | "free";

export interface PlacedLine {
  id: string;
  kind: LineKind;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx?: number;
  cy?: number;
  points?: { x: number; y: number }[];
}

export interface DrawingState {
  kind: LineKind;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: { x: number; y: number }[];
}

export interface LineColorOption {
  key: string;
  value: string;
  label: string;
}

export interface LineKindOption {
  kind: LineKind;
  label: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
}

export interface PlacedText extends TextStyle {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  locked: boolean;
}

export interface TacticalBoardSnapshot {
  placedChapas: Record<string, ChapaPosition>;
  chapaPetoById: Record<string, string>;
  placedSpaces: SpacePosition[];
  placedMaterials: PlacedMaterial[];
  placedLines: PlacedLine[];
  placedTexts?: PlacedText[];
}
