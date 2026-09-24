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
    what: "Dice cómo está tu forma física. Cada entreno o partido la sube; se mantiene hasta 4 días sin entrenar ni jugar y, a partir del 5º, baja cada día un poco más.",
    goesUp: ["Entrenas, sobre todo físico.", "Juegas partidos: cuantos más minutos, más sube."],
    goesDown: [
      "Pasan más de 4 días seguidos sin entrenar ni jugar, por el motivo que sea (lesión, vacaciones, no convocado…).",
    ],
    numbersTitle: "Tus números (últimas 12 semanas)",
  },
  readiness: {
    title: "Rodaje",
    what: "Dice cuánto conoces la forma de jugar del equipo. Se gana entrenando, sobre todo táctica, y jugando partidos. Se mantiene 3 semanas sin actividad y después baja despacio.",
    goesUp: ["Entrenas, sobre todo táctica.", "Juegas partidos, sobre todo de liga."],
    goesDown: ["Pasan más de 3 semanas seguidas sin entrenar ni jugar."],
    numbersTitle: "Tus números (últimas 12 semanas)",
  },
  fatigue: {
    title: "Cansancio",
    what: "Dice cuánta carga has acumulado en los últimos días. Entrenar, sobre todo físico, y jugar lo sube; con unos días de descanso baja. Si está alto, conviene descansar.",
    goesUp: ["Entrenaste o jugaste hace poco.", "Lo que entrenaste fue físico."],
    goesDown: ["Llevas días sin entrenar ni jugar."],
    numbersTitle: "Tus números (últimos 14 días)",
  },
};
