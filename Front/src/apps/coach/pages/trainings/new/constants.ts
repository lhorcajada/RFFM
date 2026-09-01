import type { CreateExerciseRequest, ExerciseTipo } from "../../../types/training";
import type { LineColorOption, LineKindOption, MaterialTemplate, PetoOption, SpaceKind, SpaceTemplate, TextStyle } from "./types";

export const HALF_FIELD_LENGTH_METERS = 52.5;
export const FIELD_WIDTH_METERS = 68;
export const FULL_FIELD_LENGTH_METERS = HALF_FIELD_LENGTH_METERS * 2;

// Fútbol 7 pitch, marked crosswise within each F11 half (goals facing the F11
// touchlines), standard RFEF-common sizing.
export const F7_LENGTH_METERS = 60;
export const F7_WIDTH_METERS = 40;
export const F7_GOAL_WIDTH_METERS = 6;
export const F7_GOAL_DEPTH_METERS = 2;
export const F7_GOAL_AREA_WIDTH_METERS = 13;
export const F7_GOAL_AREA_DEPTH_METERS = 5;

export const REGULAR_POLYGON_SIDES: Partial<Record<SpaceKind, number>> = {
  triangle: 3,
  pentagon: 5,
  hexagon: 6,
  heptagon: 7,
  octagon: 8,
};

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  { kind: "square", label: "Cuadrado" },
  { kind: "rectangle", label: "Rectangulo" },
  { kind: "triangle", label: "Triangulo" },
  { kind: "pentagon", label: "Pentagono" },
  { kind: "hexagon", label: "Hexagono" },
  { kind: "heptagon", label: "Heptagono" },
  { kind: "octagon", label: "Octogono" },
  { kind: "circle", label: "Circulo" },
];

export const MATERIAL_OPTIONS: MaterialTemplate[] = [
  { key: "balones", label: "Balones" },
  { key: "setas", label: "Setas" },
  { key: "conos", label: "Conos" },
  { key: "vallas", label: "Vallas" },
  { key: "aros", label: "Aros" },
  { key: "miniporterias", label: "Miniporterias" },
  { key: "picas", label: "Picas" },
  { key: "porterias-f11", label: "Porterias de F11" },
];

export const LINE_COLORS: LineColorOption[] = [
  { key: "white", value: "#ffffff", label: "Blanco" },
  { key: "yellow", value: "#ffe066", label: "Amarillo" },
  { key: "red", value: "#ff4444", label: "Rojo" },
  { key: "green", value: "#44dd77", label: "Verde" },
  { key: "cyan", value: "#44c8ff", label: "Azul" },
  { key: "orange", value: "#ff9944", label: "Naranja" },
  { key: "black", value: "#1a1a1a", label: "Negro" },
];

export const SPACE_COLORS: LineColorOption[] = LINE_COLORS;

export const LINE_KIND_OPTIONS: LineKindOption[] = [
  { kind: "straight", label: "Recta" },
  { kind: "dashed", label: "Discontinua" },
  { kind: "arrow", label: "Flecha" },
  { kind: "arrow-dashed", label: "Fl. discontinua" },
  { kind: "curved", label: "Curva" },
  { kind: "free", label: "Libre" },
];

export const tipoOptions: { value: ExerciseTipo; label: string }[] = [
  { value: "Analitico", label: "Analítico" },
  { value: "Situacional", label: "Situacional" },
  { value: "Global", label: "Global" },
];

export const petoOptions: PetoOption[] = [
  { key: "yellow", label: "Amarillo", color: "#f1c40f" },
  { key: "orange", label: "Naranja", color: "#e67e22" },
  { key: "red", label: "Rojo", color: "#e74c3c" },
  { key: "blue", label: "Azul", color: "#3498db" },
  { key: "green", label: "Verde", color: "#2ecc71" },
  { key: "white", label: "Blanco", color: "#ecf0f1" },
  { key: "black", label: "Negro", color: "#2c3e50" },
];

export const anonymousChapaOptions: PetoOption[] = [
  { key: "anon-yellow", label: "Amarilla", color: "#f1c40f" },
  { key: "anon-orange", label: "Naranja", color: "#e67e22" },
  { key: "anon-red", label: "Roja", color: "#e74c3c" },
  { key: "anon-blue", label: "Azul", color: "#3498db" },
  { key: "anon-green", label: "Verde", color: "#2ecc71" },
  { key: "anon-white", label: "Blanca", color: "#ecf0f1" },
  { key: "anon-black", label: "Negra", color: "#2c3e50" },
];

export const emptyExercise: CreateExerciseRequest = {
  clubId: "",
  name: "",
  tipo: "Situacional",
  objetivo: "",
  objetivoPorRol: null,
  modelRelations: [],
  nivelesColumnas: ["Palanca 1"],
  niveles: [
    { nivel: 1, valores: {} },
    { nivel: 2, valores: {} },
  ],
  logistica: "",
  durationMinutes: null,
  porteros: null,
  dibujo: null,
  descripcion: "",
  boardStateJson: null,
};

export const TEXT_FONT_OPTIONS = [
  { key: "Arial, sans-serif", label: "Arial" },
  { key: "'Roboto', sans-serif", label: "Roboto" },
  { key: "Georgia, serif", label: "Georgia" },
  { key: "'Courier New', monospace", label: "Courier" },
  { key: "'Comic Sans MS', cursive", label: "Comic" },
];

export const TEXT_SIZE_OPTIONS = [12, 14, 16, 20, 24, 32, 40];

export const DEFAULT_TEXT_STYLE = {
  fontFamily: TEXT_FONT_OPTIONS[0].key,
  fontSize: 16,
  bold: false,
  italic: false,
  color: "#ffffff",
} satisfies TextStyle;
