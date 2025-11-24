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

  const timeRaw = String(m.hora ?? "");

  const rawCampo = String(m.campo ?? "");
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

  const localName = String(m.equipo_local ?? "-");
  const awayName = String(m.equipo_visitante ?? "-");

  const localTeamId = String(m.codigo_equipo_local ?? "");
  const awayTeamId = String(m.codigo_equipo_visitante ?? "");

  const localShield = resolveShield(
    String(m.escudo_equipo_local_url ?? m.escudo_equipo_local ?? "")
  );
  const awayShield = resolveShield(
    String(m.escudo_equipo_visitante_url ?? m.escudo_equipo_visitante ?? "")
  );

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
    const timeHm = parseTimeToHM(m.hora ?? null);
    if (timeHm) {
      const startDt = new Date(dateOnly);
      startDt.setHours(timeHm.h, timeHm.m, 0, 0);
      const endMs = startDt.getTime() + MATCH_DURATION_MIN * 60 * 1000;
      scheduledFinished = Date.now() >= endMs;
    }
  }
  const finished =
    hasActa || actaCerrada || estadoFinished || scheduledFinished;

  const localGoalsNum = parseGoalValue(m.goles_casa ?? m.goles ?? null);
  const awayGoalsNum = parseGoalValue(m.goles_visitante ?? null);

  return {
    codactaVal,
    timeRaw,
    fieldName,
    cityName,
    mapsUrl,
    localName,
    awayName,
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
