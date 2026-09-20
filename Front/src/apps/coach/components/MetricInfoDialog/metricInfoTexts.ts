export type MetricKey = "formStatus" | "readiness" | "fatigue";

export type MetricTexts = {
  title: string;
  what: string;
  goesUp: string[];
  goesDown: string[];
  numbersTitle: string;
};

export const METRIC_TEXTS: Record<MetricKey, MetricTexts> = {
  formStatus: {
    title: "Estado de forma",
    what: "Dice cuánto has entrenado y jugado en las últimas 6 semanas. Para llegar al 100% hacen falta unas 12 sesiones de entrenamiento y jugar casi todo el tiempo en los partidos que juegue el equipo.",
    goesUp: ["Vas a todos los entrenamientos, sobre todo a los de físico.", "Juegas casi todo el partido."],
    goesDown: [
      "Faltas a entrenamientos o partidos, por el motivo que sea (también por una lesión).",
      "Juegas pocos minutos.",
      "Vienes cansado.",
    ],
    numbersTitle: "Tus números (últimas 6 semanas)",
  },
  readiness: {
    title: "Rodaje",
    what: "Dice cuánto conoces la forma de jugar del equipo. Se gana entrenando, sobre todo táctica, y jugando partidos.",
    goesUp: ["Entrenas, sobre todo táctica.", "Juegas partidos."],
    goesDown: [
      "Faltas a entrenamientos o partidos (una lesión te quita mucho).",
      "Pasan semanas sin jugar ni entrenar.",
    ],
    numbersTitle: "Tus números (últimas 8 semanas)",
  },
  fatigue: {
    title: "Cansancio",
    what: "Dice cuánta carga has acumulado en los últimos días. Entrenar, sobre todo físico, y jugar lo sube; con unos días de descanso baja. Si está alto, conviene descansar.",
    goesUp: ["Entrenaste o jugaste hace poco.", "Lo que entrenaste fue físico."],
    goesDown: ["Llevas días sin entrenar ni jugar."],
    numbersTitle: "Tus números (últimos 14 días)",
  },
};
