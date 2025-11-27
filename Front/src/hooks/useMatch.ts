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

  // Try multiple possible fields for codacta and also extract numeric ids from URLs
  let codactaVal: string | null = null;
  const potentialFields = [
    m.codacta,
    m.cod_acta,
    m.id_acta,
    m.idacta,
    m.actaId,
    m.acta,
    m.acta_id,
    // matchDays / new API fields
    (m as any).matchRecordCode,
    (m as any).match_record_code,
    (m as any).originRecordCode,
    (m as any).origin_record_code,
    (m as any).recordCode,
    (m as any).record_code,
  ];
  for (const f of potentialFields) {
    if (f !== undefined && f !== null && String(f).toString().trim() !== "") {
      codactaVal = String(f);
      break;
    }
  }
  // If API provides matchRecordCode-like fields (new matchDays shape), prefer them
  if (!codactaVal) {
    const mrc =
      (m as any).matchRecordCode ??
      (m as any).match_record_code ??
      (m as any).recordCode ??
      (m as any).record_code ??
      null;
    const orc =
      (m as any).originRecordCode ?? (m as any).origin_record_code ?? null;
    if (mrc) codactaVal = String(mrc);
    else if (orc) codactaVal = String(orc);
  }
  // If still not found, try to extract from common URL patterns in raw.url or raw.link
  let urlCandidates: Array<string | undefined | null> = [];
  if (!codactaVal && m.raw) {
    urlCandidates = [
      m.raw.url,
      m.raw.link,
      m.raw.href,
      (m.raw as any).url_acta,
    ];
    for (const uc of urlCandidates) {
      if (!uc) continue;
      const s = String(uc);
      // common patterns: sequences of 5+ digits, or numeric id after '/acta/' or 'id=' query
      const match1 = s.match(/(\d{5,})/);
      if (match1) {
        codactaVal = match1[1];
        break;
      }
      const match2 = s.match(/acta\/(\d+)/i);
      if (match2) {
        codactaVal = match2[1];
        break;
      }
      const match3 = s.match(/[?&]id=(\d+)/i);
      if (match3) {
        codactaVal = match3[1];
        break;
      }
    }
  }

  // Development-time debug log to help diagnose missing codacta values
  try {
    // Vite exposes import.meta.env.MODE; show debug only when not production
    // eslint-disable-next-line no-console
    if (
      (import.meta as any).env &&
      (import.meta as any).env.MODE !== "production"
    ) {
      console.debug("useMatch codacta debug", {
        potentialFields,
        urlCandidates,
        codactaVal,
        raw: m.raw ?? null,
      });
    }
  } catch (e) {
    // ignore logging issues
  }
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

  const isTrueFlag = (v: any) =>
    v === true || v === "1" || v === 1 || v === "true";

  const hasActa = Boolean(
    m.raw?.url ??
      (isTrueFlag((m as any).hasRecords) ? true : null) ??
      (m as any).matchRecordCode ??
      (m as any).recordCode ??
      null
  );

  const actaCerrada = Boolean(
    m.raw?.acta_cerrada ??
      m.raw?.actaCerrada ??
      (isTrueFlag((m as any).recordClosed) ? true : false)
  );
  const estadoVal = String(
    m.raw?.estado ?? (m as any).status ?? ""
  ).toLowerCase();
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
