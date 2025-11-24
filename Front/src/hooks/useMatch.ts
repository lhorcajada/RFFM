import { useMemo } from "react";
import { MatchEntry } from "../types/match";
import { getMapsUrlByNameCity } from "../services/maps";
import { parseTimeToHM, parseGoalValue, resolveShield } from "../utils/match";

type UseMatchInput = {
  item: {
    match: MatchEntry;
    parsedDate?: Date | null;
    rawDate?: string | null;
  };
};

export function computeMatchData(item: UseMatchInput["item"]) {
  const m = item.match;

  const codactaVal =
    m.codacta ??
    (m.raw?.url ? String((m.raw.url.match(/(\d{5,})/) || [])[1]) : null);
  const timeRaw = String(m.hora ?? (m as any).time ?? "");

  const rawCampo = String(m.campo ?? (m as any).field ?? "");
  let fieldName = rawCampo;
  let cityName: string | null = null;
  if (rawCampo && rawCampo.indexOf("-") !== -1) {
    const parts = rawCampo
      .split("-")
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      cityName = parts[0];
      fieldName = parts.slice(1).join(" - ");
    }
  }

  const mapsUrl = getMapsUrlByNameCity(
    fieldName || null,
    cityName || m.ciudad || m.city || null
  );

  const localNameFinal = String(
    m.equipo_local ??
      (m as any).localTeamName ??
      (m as any).local ??
      (m as any).nombre ??
      "-"
  );
  const awayNameFinal = String(
    m.equipo_visitante ??
      (m as any).visitorTeamName ??
      (m as any).awayTeamName ??
      (m as any).visitante ??
      "-"
  );

  const localTeamId = String(
    m.codigo_equipo_local ??
      (m as any).localTeamCode ??
      (m as any).localCode ??
      ""
  );
  const awayTeamId = String(
    m.codigo_equipo_visitante ??
      (m as any).visitorTeamCode ??
      (m as any).awayTeamId ??
      (m as any).awayCode ??
      ""
  );

  const localShield = resolveShield(
    String(
      m.escudo_equipo_local_url ??
        m.escudo_equipo_local ??
        (m as any).localImage ??
        (m as any).localTeamImageUrl ??
        ""
    )
  );
  const awayShield = resolveShield(
    String(
      m.escudo_equipo_visitante_url ??
        m.escudo_equipo_visitante ??
        (m as any).awayImage ??
        (m as any).visitorTeamImageUrl ??
        ""
    )
  );

  // DEBUG: log incoming shield fields and resolved values (remove in production)
  try {
    // eslint-disable-next-line no-console
    console.debug("useMatch shields", {
      escudo_equipo_local_url: m.escudo_equipo_local_url,
      escudo_equipo_local: m.escudo_equipo_local,
      localImage: (m as any).localImage,
      localTeamImageUrl: (m as any).localTeamImageUrl,
      resolvedLocal: localShield,
      escudo_equipo_visitante_url: m.escudo_equipo_visitante_url,
      escudo_equipo_visitante: m.escudo_equipo_visitante,
      awayImage: (m as any).awayImage,
      visitorTeamImageUrl: (m as any).visitorTeamImageUrl,
      resolvedAway: awayShield,
    });
  } catch (e) {
    // ignore
  }

  const hasActa = Boolean(m.raw?.url ?? null);
  const actaCerrada = Boolean(
    m.raw?.acta_cerrada ?? m.raw?.actaCerrada ?? false
  );
  const estadoVal = String(m.raw?.estado ?? "").toLowerCase();
  const estadoFinished =
    /final|terminad|ended|cerrad|closed|finalizado|jugado/i.test(estadoVal);

  const MATCH_DURATION_MIN = 120;
  let scheduledFinished = false;
  const dateOnly = item.parsedDate ?? null;
  if (dateOnly) {
    const timeHm = parseTimeToHM((m as any).hora ?? (m as any).time ?? null);
    if (timeHm) {
      const startDt = new Date(dateOnly);
      startDt.setHours(timeHm.h, timeHm.m, 0, 0);
      const endMs = startDt.getTime() + MATCH_DURATION_MIN * 60 * 1000;
      scheduledFinished = Date.now() >= endMs;
    }
  }
  const finished =
    hasActa || actaCerrada || estadoFinished || scheduledFinished;

  const localGoalsNum = parseGoalValue(
    m.goles_casa ??
      (m as any).LocalGoals ??
      (m as any).localGoals ??
      m.goles ??
      null
  );
  const awayGoalsNum = parseGoalValue(
    m.goles_visitante ?? (m as any).AwayGoals ?? (m as any).visitorGoals ?? null
  );

  return {
    codactaVal,
    timeRaw,
    fieldName,
    cityName,
    mapsUrl,
    localName: localNameFinal,
    awayName: awayNameFinal,
    localTeamId,
    awayTeamId,
    localShield,
    awayShield,
    finished,
    localGoalsNum,
    awayGoalsNum,
    raw: m.raw ?? null,
    match: m,
  };
}

export default function useMatch({ item }: UseMatchInput) {
  return useMemo(() => computeMatchData(item), [item]);
}
