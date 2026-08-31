import type { SportEventResponse } from "../../../services/sportEventService";
import type { NormalizedMatch, MatchResult } from "../types";

export const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function normalizeDateStr(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  const parts = trimmed.split("/");
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return trimmed.substring(0, 10);
}

export function normalizeFromSportEvent(ev: SportEventResponse): NormalizedMatch {
  const dateStr = normalizeDateStr(ev.eveDateTime ?? ev.start ?? null);
  const isHomeMatch = ev.isHomeMatch !== false;
  const rivalName = ev.rivalName ?? ev.rival ?? "";
  const rivalPhoto = ev.rivalPhotoUrl ?? "";
  const myTeamName = ev.teamName ?? "";
  const myTeamPhoto = ev.teamPhotoUrl ?? "";

  const localTeamName = isHomeMatch ? myTeamName : rivalName;
  const localTeamShield = isHomeMatch ? myTeamPhoto : rivalPhoto;
  const visitorTeamName = isHomeMatch ? rivalName : myTeamName;
  const visitorTeamShield = isHomeMatch ? rivalPhoto : myTeamPhoto;

  const rawTime = ev.startTime ?? ev.eveDateTime ?? null;
  let time = "";
  if (rawTime && String(rawTime).includes("T")) {
    const rawDate = new Date(String(rawTime));
    if (!isNaN(rawDate.getTime())) {
      const timePart = rawDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      if (timePart !== "00:00") time = timePart;
    }
  }

  const now = new Date();
  const evDate = ev.eveDateTime ? new Date(ev.eveDateTime) : null;
  const isFinished = evDate !== null && evDate < now;

  return {
    date: dateStr,
    time,
    localTeamName,
    localTeamShield,
    localGoals: ev.localGoals ?? null,
    visitorTeamName,
    visitorTeamShield,
    visitorGoals: ev.visitorGoals ?? null,
    isFinished,
    isHomeTeam: isHomeMatch,
    field: ev.location ?? "",
    codacta: ev.codActa ?? null,
    selectedKitNumber: ev.selectedKitNumber ?? null,
    eventId: ev.id,
    matchCategory: ev.matchCategory ?? null,
  };
}

export function resolveIsHomeTeam(match: Record<string, unknown>, teamId?: string | null): boolean {
  if (!teamId) return true;
  const tid = String(teamId).trim().toLowerCase();
  const localCode = String(match.localTeamCode ?? match.localTeamId ?? "").trim().toLowerCase();
  const visitorCode = String(match.visitorTeamCode ?? match.visitorTeamId ?? "").trim().toLowerCase();
  const localCodeLeg = String(match.codigo_equipo_local ?? match.codigo_local ?? "").trim().toLowerCase();
  const visitorCodeLeg = String(match.codigo_equipo_visitante ?? match.codigo_visitante ?? "").trim().toLowerCase();
  const localName = String(match.localTeamName ?? match.equipo_local ?? "").trim().toLowerCase();
  const visitorName = String(match.visitorTeamName ?? match.equipo_visitante ?? "").trim().toLowerCase();

  const matchesVisitor = [visitorCode, visitorCodeLeg, visitorName].some((v) => v !== "" && v === tid);
  if (matchesVisitor) return false;

  const matchesLocal = [localCode, localCodeLeg, localName].some((v) => v !== "" && v === tid);
  if (matchesLocal) return true;

  const rawValues = Object.values(match).map((v) => String(v ?? "").trim().toLowerCase());
  const inVisitorHalf = rawValues.some(
    (v) => v === tid && Object.keys(match).some((k) =>
      k.toLowerCase().includes("visitor") || k.toLowerCase().includes("visitante")
    )
  );
  if (inVisitorHalf) return false;

  return true;
}

export function normalizeRawMatch(
  item: { date: string | null; match: Record<string, unknown> },
  teamId?: string | null,
): NormalizedMatch {
  const m = item.match;
  const rawDate = (m.date ?? m.fecha ?? item.date ?? "") as string;
  const dateStr = normalizeDateStr(rawDate);
  const isHomeTeam = resolveIsHomeTeam(m, teamId);

  if (m.localTeamName != null || m.localTeamCode != null) {
    const lg = m.localGoals != null ? String(m.localGoals) : null;
    const vg = m.visitorGoals != null ? String(m.visitorGoals) : null;
    const hasScore =
      lg != null && lg !== "" && lg !== "-" &&
      vg != null && vg !== "" && vg !== "-";
    const codacta = m.matchRecordCode != null ? String(m.matchRecordCode) : null;
    return {
      date: dateStr,
      time: (m.time ?? "") as string,
      localTeamName: (m.localTeamName ?? "") as string,
      localTeamShield: (m.localTeamImageUrl ?? "") as string,
      localGoals: lg,
      visitorTeamName: (m.visitorTeamName ?? "") as string,
      visitorTeamShield: (m.visitorTeamImageUrl ?? "") as string,
      visitorGoals: vg,
      isFinished: hasScore,
      isHomeTeam,
      field: (m.field ?? "") as string,
      codacta,
      selectedKitNumber: null,
    };
  }

  const gC = m.goles_casa != null ? String(m.goles_casa) : null;
  const gV = m.goles_visitante != null ? String(m.goles_visitante) : null;
  const hasScore = gC != null && gC !== "" && gC !== "-";
  const codacta = m.codacta != null ? String(m.codacta) : null;
  return {
    date: dateStr,
    time: (m.hora ?? "") as string,
    localTeamName: (m.equipo_local ?? "") as string,
    localTeamShield: ((m.escudo_equipo_local_url ?? m.escudo_equipo_local) ?? "") as string,
    localGoals: gC,
    visitorTeamName: (m.equipo_visitante ?? "") as string,
    visitorTeamShield: ((m.escudo_equipo_visitante_url ?? m.escudo_equipo_visitante) ?? "") as string,
    visitorGoals: gV,
    isFinished: hasScore,
    isHomeTeam,
    field: (m.campo ?? "") as string,
    codacta,
    selectedKitNumber: null,
  };
}

export function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay();
  const offset = startDow === 0 ? 6 : startDow - 1;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const grid: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
  return grid;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getMatchResult(match: NormalizedMatch): MatchResult {
  if (!match.isFinished) return null;
  if (match.localGoals === null || match.visitorGoals === null) return "played";
  const lg = parseInt(match.localGoals, 10);
  const vg = parseInt(match.visitorGoals, 10);
  if (isNaN(lg) || isNaN(vg)) return "played";
  const myGoals = match.isHomeTeam ? lg : vg;
  const theirGoals = match.isHomeTeam ? vg : lg;
  if (myGoals > theirGoals) return "won";
  if (myGoals === theirGoals) return "draw";
  return "lost";
}
