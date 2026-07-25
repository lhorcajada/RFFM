import type { CreateExerciseRequest, ExerciseSection, ExerciseType } from "../../../types/training";
import type { LineColorOption, LineKindOption, MaterialTemplate, PetoOption, SpaceKind, SpaceTemplate } from "./types";

export const HALF_FIELD_LENGTH_METERS = 52.5;
export const FIELD_WIDTH_METERS = 68;

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

export const typeOptions: { value: ExerciseType; label: string }[] = [
  { value: "Physical", label: "Fisico" },
  { value: "Technical", label: "Tecnico" },
  { value: "Tactical", label: "Tactico" },
  { value: "Game", label: "Juego" },
  { value: "Cognitive", label: "Cognitivo" },
  { value: "Psychological", label: "Psicologico" },
];

export const sectionOptions: { value: ExerciseSection; label: string }[] = [
  { value: "Calentamiento", label: "Calentamiento" },
  { value: "Principal", label: "Principal" },
  { value: "VueltaALaCalma", label: "Vuelta a la Calma" },
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
  description: "",
  types: ["Tactical"],
  section: "Principal",
  durationTotal: 15,
  playersNumber: 10,
  goalPeekersNumber: 1,
  fieldSpace: "",
  subSubPrincipleId: null,
  subPrincipleId: null,
  essentialSkillIds: [],
  touchesNumber: 0,
  wildCards: 0,
  series: 0,
  durationSeries: 0,
  restSeries: 0,
};
