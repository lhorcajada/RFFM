import type { Acta, CardEvent, GoalEvent, PlayerActa, Substitution, Technician } from "../types/acta";

export type ActaPdfTeam = {
  name: string;
  starters: string[];
  substitutes: string[];
  substitutions: string[];
  cards: string[];
  staff: string[];
};

export type ActaPdfModel = {
  matchInfo: string;
  placeInfo: string;
  scoreLine: string;
  teams: [ActaPdfTeam, ActaPdfTeam];
  goals: string[];
  referees: string[];
};

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
};

const pick = (o: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = text(o[k]);
    if (v) return v;
  }
  return "";
};

const label = (dorsal: string, name: string): string => [dorsal, name].filter(Boolean).join(" ");

const minuteOf = (v: unknown): number => {
  const n = parseInt(text(v), 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
};

const minuteLabel = (v: unknown): string => {
  const m = text(v);
  return m ? `${m}'` : "";
};

const withMinute = (minute: unknown, body: string): string => [minuteLabel(minute), body].filter(Boolean).join("  ");

const staffLine = (role: string, name: string): string | null => (name ? `${role}  ${name}` : null);

const compact = (lines: Array<string | null>): string[] => lines.filter((l): l is string => !!l);

function buildStaff(
  coach: string | undefined,
  coach2: string | undefined,
  delegate: string | undefined,
  others: Technician[] | undefined,
): string[] {
  return compact([
    staffLine("ENTRENADOR", text(coach)),
    staffLine("ENTRENADOR", text(coach2)),
    staffLine("DELEGADO", text(delegate)),
    ...(Array.isArray(others) ? others : []).map((t) =>
      staffLine(text(t.tipo) || "TÉCNICO", text(t.nombre)),
    ),
  ]);
}

function playerLine(p: PlayerActa): string {
  const tags = [text(p.portero) === "1" ? "(P)" : "", text(p.capitan) === "1" ? "(C)" : ""].filter(Boolean);
  return [`${text(p.dorsal)}  ${text(p.nombre_jugador)}`.trim(), ...tags].join(" ");
}

function substitutionLine(s: Substitution): string {
  const rec = s as Record<string, unknown>;
  const enters = label(pick(rec, ["entradorsal", "EnteringNumber"]), pick(rec, ["nombre_jugador_entra", "EnteringPlayerName"]));
  const exits = label(pick(rec, ["saledorsal", "ExitingNumber"]), pick(rec, ["nombre_jugador_sale", "ExitingPlayerName"]));
  const body = [enters ? `Entra ${enters}` : "", exits ? `Sale ${exits}` : ""].filter(Boolean).join(" · ");
  return withMinute(pick(rec, ["minuto", "Minute"]), body);
}

function cardKind(c: CardEvent): string {
  const type = text(c.codigo_tipo_amonestacion);
  if (type === "102" || text(c.segunda_amarilla) === "1") return "Doble amarilla";
  if (type === "101") return "Roja";
  return "Amarilla";
}

export function buildActaPdfModel(acta: Acta): ActaPdfModel {
  const localName = text(acta.equipo_local) || "Local";
  const visitorName = text(acta.equipo_visitante) || "Visitante";
  const localPlayers = Array.isArray(acta.jugadores_equipo_local) ? acta.jugadores_equipo_local : [];
  const visitorPlayers = Array.isArray(acta.jugadores_equipo_visitante) ? acta.jugadores_equipo_visitante : [];

  const playerByCode = new Map<string, PlayerActa>();
  [...localPlayers, ...visitorPlayers].forEach((p) => {
    const code = text(p.codjugador);
    if (code) playerByCode.set(code, p);
  });

  const personLabel = (code: unknown, fallbackName: unknown): string => {
    const p = playerByCode.get(text(code));
    return label(text(p?.dorsal), text(p?.nombre_jugador) || text(fallbackName));
  };

  const cardLines = (cards: CardEvent[] | undefined): string[] =>
    (Array.isArray(cards) ? cards : []).map((c) =>
      withMinute(c.minuto, `${cardKind(c)} · ${personLabel(c.codjugador, c.nombre_jugador)}`),
    );

  const substitutionLines = (subs: Substitution[] | undefined): string[] =>
    (Array.isArray(subs) ? subs : []).map(substitutionLine);

  const teamOf = (
    name: string,
    players: PlayerActa[],
    subs: Substitution[] | undefined,
    cards: CardEvent[] | undefined,
    staff: string[],
  ): ActaPdfTeam => ({
    name,
    starters: players.filter((p) => text(p.titular) === "1").map(playerLine),
    substitutes: players.filter((p) => text(p.titular) !== "1").map(playerLine),
    substitutions: substitutionLines(subs),
    cards: cardLines(cards),
    staff,
  });

  type TaggedGoal = { goal: GoalEvent; side: "local" | "visitor"; order: number };
  const tagged: TaggedGoal[] = [
    ...(Array.isArray(acta.goles_equipo_local) ? acta.goles_equipo_local : []).map((goal) => ({ goal, side: "local" as const })),
    ...(Array.isArray(acta.goles_equipo_visitante) ? acta.goles_equipo_visitante : []).map((goal) => ({ goal, side: "visitor" as const })),
  ].map((g, order) => ({ ...g, order }));
  tagged.sort((a, b) => minuteOf(a.goal.minuto) - minuteOf(b.goal.minuto) || a.order - b.order);

  let localScore = 0;
  let visitorScore = 0;
  const goals = tagged.map(({ goal, side }) => {
    if (side === "local") localScore += 1;
    else visitorScore += 1;
    const type = text(goal.tipo_gol);
    const tag = type === "102" ? " (en propia puerta)" : type === "101" ? " (penalti)" : "";
    const scorer = personLabel(goal.codjugador, goal.nombre_jugador);
    const team = side === "local" ? localName : visitorName;
    return withMinute(goal.minuto, `${team} · ${scorer}${tag}   ${localScore} - ${visitorScore}`);
  });

  const penalties =
    text(acta.hay_penaltis) === "1" ? ` (penaltis ${text(acta.penaltis_casa)}-${text(acta.penaltis_fuera)})` : "";
  const scoreLine =
    [localName, text(acta.goles_local), "-", text(acta.goles_visitante), visitorName].filter(Boolean).join(" ") + penalties;

  const jornada = text(acta.jornada);
  return {
    matchInfo: [text(acta.nombre_competicion), text(acta.nombre_grupo), jornada ? `Jornada ${jornada}` : ""]
      .filter(Boolean)
      .join(" · "),
    placeInfo: [text(acta.fecha), text(acta.hora), text(acta.campo)].filter(Boolean).join(" · "),
    scoreLine,
    teams: [
      teamOf(
        localName,
        localPlayers,
        acta.sustituciones_equipo_local,
        acta.tarjetas_equipo_local,
        buildStaff(acta.entrenador_local, acta.entrenador2_local, acta.delegadolocal, acta.otros_tecnicos_local),
      ),
      teamOf(
        visitorName,
        visitorPlayers,
        acta.sustituciones_equipo_visitante,
        acta.tarjetas_equipo_visitante,
        buildStaff(
          acta.entrenador_visitante,
          acta.entrenador2_visitante,
          acta.delegado_visitante,
          acta.otros_tecnicos_visitante,
        ),
      ),
    ],
    goals,
    referees: (Array.isArray(acta.arbitros_partido) ? acta.arbitros_partido : []).map(
      (r) => `${text(r.tipo_arbitro)}  ${text(r.nombre_arbitro)}`.trim(),
    ),
  };
}

export function actaPdfFileName(acta: Acta): string {
  return `Acta ${text(acta.equipo_local) || "Local"} - ${text(acta.equipo_visitante) || "Visitante"}.pdf`;
}
