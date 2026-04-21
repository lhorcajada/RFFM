import type { PoolPlayer, PlayerEvaluation, ConceptEval } from "../SeasonPrep";

export type { ConceptEval };
export type ConceptKey = keyof Omit<PlayerEvaluation, "notes">;

export function playerIsGk(player: PoolPlayer): boolean {
  if (player.isGoalkeeper) return true;
  const pos = player.position?.toLowerCase() ?? "";
  return pos.includes("portero") || pos.includes("keeper") || pos.includes("arquero");
}

// ── Concept definition type ───────────────────────────────────────────────────

export type ConceptDef = {
  key: ConceptKey;
  label: string;
  descriptor: string;
  consistenciaOptions: string[];
  tendenciaOptions: string[];
};

// ── Field player concept groups ───────────────────────────────────────────────

export const FP_COMBATE: ConceptDef[] = [
  {
    key: "valentiaDiv",
    label: "Valentía / Divididos",
    descriptor: "Capacidad para disputar el balón sin protegerse o dudar.",
    consistenciaOptions: ["Nunca", "Rara vez", "Intermitente", "Habitual"],
    tendenciaOptions: ["A la baja", "Estancado", "Al alza", "Mejorando notablemente"],
  },
  {
    key: "duelos",
    label: "Duelos (1vs1)",
    descriptor: "Eficacia en el contacto físico para arrebatar o proteger.",
    consistenciaOptions: ["Avasallado", "Superado", "Cumplidor", "Dominante"],
    tendenciaOptions: ["En caída", "Inestable", "Recuperando nivel", "Ganando confianza"],
  },
  {
    key: "segundasJugadas",
    label: "Segundas jugadas",
    descriptor: "Capacidad de anticipar dónde caerá el rechace.",
    consistenciaOptions: ["Pasivo", "Reacciona tarde", "Intuitivo", "Siempre en posición"],
    tendenciaOptions: ["Perdiendo anticipación", "Estático", "Mejorando lectura", "Gran progreso"],
  },
];

export const FP_DEFENSA: ConceptDef[] = [
  {
    key: "marcajeFerreo",
    label: "Marcaje férreo",
    descriptor: "Capacidad de reducir el espacio del rival (contacto visual y físico).",
    consistenciaOptions: ["Sin marca", "Distraído", "Concesivo", "Asfixiante"],
    tendenciaOptions: ["Empeorando", "Despistado", "Constante", "Más responsable"],
  },
  {
    key: "pressingTrasPerdida",
    label: "Pressing tras pérdida",
    descriptor: "Reacción inmediata de acoso al perder el balón.",
    consistenciaOptions: ["Inexistente", "Selectiva", "Instantánea", "Automática"],
    tendenciaOptions: ["Inconsistente", "Necesita aviso", "Interiorizado", "Muy mejorado"],
  },
];

export const FP_ATAQUE: ConceptDef[] = [
  {
    key: "controlOrientado",
    label: "Control orientado",
    descriptor: "¿El primer toque le permite ejecutar la siguiente acción?",
    consistenciaOptions: ["Deficiente", "Neutro", "Ventajoso", "Excepcional"],
    tendenciaOptions: ["Perdiendo soltura", "Técnico", "Más fluido", "Dominando"],
  },
  {
    key: "visionFiltrados",
    label: "Visión / Filtrados",
    descriptor: "Detecta y ejecuta pases que saltan líneas rivales.",
    consistenciaOptions: ["Limitado", "Conservador", "Seguro", "Clarividente"],
    tendenciaOptions: ["Estancado", "Tímido", "Arriesgando más", "Expansivo"],
  },
  {
    key: "finalizacionCentro",
    label: "Finalización / Centro",
    descriptor: "Calidad en el último toque (tiro o centro largo).",
    consistenciaOptions: ["Precipitado", "Impreciso", "Preciso", "Letal"],
    tendenciaOptions: ["Irregular", "En desarrollo", "Efectivo", "Determinante"],
  },
];

export const FP_FISICO: ConceptDef[] = [
  {
    key: "velocidadAccion",
    label: "Velocidad (Acción)",
    descriptor: "Capacidad para llegar antes o ganar metros en carrera.",
    consistenciaOptions: ["Muy lento", "Lento", "Ritmo medio", "Explosivo"],
    tendenciaOptions: ["Fatiga", "Estable", "Mejorando punta", "Gran explosión"],
  },
  {
    key: "fuerzaUso",
    label: "Fuerza (Uso)",
    descriptor: "Capacidad para usar el cuerpo como palanca o escudo.",
    consistenciaOptions: ["Frágil", "Se desequilibra", "Sólido", "Imponente"],
    tendenciaOptions: ["Solo choque", "En desarrollo", "Uso inteligente", "Referencia física"],
  },
  {
    key: "usoAltura",
    label: "Uso de la Altura",
    descriptor: "Dominio del juego aéreo o protección de balón por envergadura.",
    consistenciaOptions: ["Superado", "No aprovecha", "Dominante", "Arma aérea"],
    tendenciaOptions: ["Regresando", "Pasivo", "Aprendiendo a saltar", "Destaca en juego aéreo"],
  },
];

export const FP_GROUPS: { title: string; concepts: ConceptDef[] }[] = [
  { title: "⚔️ Combate", concepts: FP_COMBATE },
  { title: "🛡️ Defensa", concepts: FP_DEFENSA },
  { title: "⚡ Ataque", concepts: FP_ATAQUE },
  { title: "💪 Físico", concepts: FP_FISICO },
];

export const FP_ALL_KEYS: ConceptKey[] = [
  ...FP_COMBATE,
  ...FP_DEFENSA,
  ...FP_ATAQUE,
  ...FP_FISICO,
].map((c) => c.key);

export const FP_ALL_CONCEPTS: ConceptDef[] = [
  ...FP_COMBATE,
  ...FP_DEFENSA,
  ...FP_ATAQUE,
  ...FP_FISICO,
];

// ── Goalkeeper concept groups ─────────────────────────────────────────────────

export const GK_MANOS: ConceptDef[] = [
  {
    key: "seguridadManos",
    label: "Seguridad de manos",
    descriptor: "Capacidad para blocar (hacerse con el balón) en lugar de despejar.",
    consistenciaOptions: ["Pierde el balón", "Manos blandas", "Rechace frecuente", "Blocaje seguro"],
    tendenciaOptions: ["Inestable", "Constante", "Ganando firmeza", "Muy fiable"],
  },
  {
    key: "gestionRechace",
    label: "Gestión del rechace",
    descriptor: "Si no bloca, ¿orienta el balón a zonas seguras (bandas)?",
    consistenciaOptions: ["Sin control", "Al centro (peligro)", "Rechace inteligente", "Orientado y limpio"],
    tendenciaOptions: ["Inconsistente", "Erático", "Más consciente", "Fiable en el rechace"],
  },
  {
    key: "reflejosReaccion",
    label: "Reflejos y Reacción",
    descriptor: "Capacidad de respuesta ante tiros a bocajarro o desvíos.",
    consistenciaOptions: ["Sin reacción", "Lento de reacción", "Correcto", "Felino"],
    tendenciaOptions: ["Falta de chispa", "Irregular", "Activo", "Muy alerta"],
  },
];

export const GK_VALENTIA: ConceptDef[] = [
  {
    key: "valentiaSalidas",
    label: "Valentía (Salidas)",
    descriptor: "Capacidad de ir a los pies del rival o chocar en el aire.",
    consistenciaOptions: ["Se queda en línea", "Dudoso", "Seguro en salidas", "Temerario (Positivo)"],
    tendenciaOptions: ["Perdiendo confianza", "Estable", "Más valiente", "Decisivo y contundente"],
  },
  {
    key: "dominioAereo",
    label: "Dominio Aéreo",
    descriptor: "Seguridad en centros laterales y balones colgados.",
    consistenciaOptions: ["No sale", "Sale y no llega", "Dominante", "Arma en el área"],
    tendenciaOptions: ["Regresando", "Estático", "Mejorando lectura", "Gran seguridad aérea"],
  },
  {
    key: "duelos1v1Gk",
    label: "Duelos 1 vs 1",
    descriptor: "Capacidad de aguantar el tipo y \"hacerse grande\" ante el delantero.",
    consistenciaOptions: ["Precipitado", "Se vence pronto", "Aguanta hasta el final", "Intimidante"],
    tendenciaOptions: ["Irregular", "Nervioso", "Más templado", "Muy sólido"],
  },
];

export const GK_JUEGO: ConceptDef[] = [
  {
    key: "juegosDePies",
    label: "Juego de pies",
    descriptor: "¿El control orientado le permite dar salida limpia al equipo?",
    consistenciaOptions: ["Muy limitado", "Limitado (solo despeje)", "Cumplidor", "Un jugador más"],
    tendenciaOptions: ["Estancado", "Necesita técnica", "Más fluido", "Motor del equipo"],
  },
  {
    key: "precisionSaque",
    label: "Precisión de Saque",
    descriptor: "Calidad y ventaja que da el pase (mano o pie) para la contra.",
    consistenciaOptions: ["Impreciso", "Solo devuelve el balón", "Pase con ventaja", "Crea superioridad"],
    tendenciaOptions: ["Inconsistente", "Precipitado", "Mejorando visión", "Lanzador clave"],
  },
];

export const GK_FISICO: ConceptDef[] = [
  {
    key: "velocidadDesplazamiento",
    label: "Velocidad de Desplazamiento",
    descriptor: "Rapidez para corregir la posición o salir a un cruce.",
    consistenciaOptions: ["Reacción tardía", "Pesado", "Ágil y rápido", "Felino en el área"],
    tendenciaOptions: ["Irregular", "Lento", "En forma", "Muy veloz"],
  },
  {
    key: "potenciaSalto",
    label: "Potencia de Salto",
    descriptor: "Capacidad para llegar a balones altos o estiradas extremas.",
    consistenciaOptions: ["No despega", "Salto limitado", "Gran alcance", "Imposible de superar"],
    tendenciaOptions: ["Falta de fuerza", "Estancado", "Potencia al alza", "Dominador aéreo"],
  },
];

export const GK_GROUPS: { title: string; concepts: ConceptDef[] }[] = [
  { title: "🧤 Manos",    concepts: GK_MANOS    },
  { title: "🦁 Valentía", concepts: GK_VALENTIA },
  { title: "👟 Juego",    concepts: GK_JUEGO    },
  { title: "💪 Físico",   concepts: GK_FISICO   },
];

export const GK_ALL_KEYS: ConceptKey[] = [
  ...GK_MANOS,
  ...GK_VALENTIA,
  ...GK_JUEGO,
  ...GK_FISICO,
].map((c) => c.key);

export const GK_ALL_CONCEPTS: ConceptDef[] = [
  ...GK_MANOS,
  ...GK_VALENTIA,
  ...GK_JUEGO,
  ...GK_FISICO,
];
