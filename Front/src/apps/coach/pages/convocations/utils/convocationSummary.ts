import type { PlayerResponse } from "../../../services/teamplayerService";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { ClubKit } from "../../../services/kitService";
import type { TeamNote } from "../../../services/teamNoteService";
import type { MatchState } from "../components/convocationMatchDetail.types";
import { colorName } from "./kitColors";

/** Shared data model for the "convocatoria" (called-up players report), used by both the
 *  PDF/WhatsApp export (ConvocatoriaPrint) and the on-screen "Ver convocatoria" dialog —
 *  single source of truth so the two never drift apart. */

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatDateES(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAYS_ES[d.getDay()]}, ${day} de ${MONTHS_ES[d.getMonth()]} de ${year}`;
}

export function arrivalTime(time: string): string {
  if (!time || !time.includes(":")) return "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10) - 1;
  const m = parseInt(mStr, 10);
  if (h < 0) h = 23;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Sorts called-up players by dorsal (shirt number) ascending; players without a dorsal go last. */
export function sortByDorsalAsc(players: PlayerResponse[]): PlayerResponse[] {
  return [...players].sort((a, b) => {
    if (a.dorsal == null && b.dorsal == null) return 0;
    if (a.dorsal == null) return 1;
    if (b.dorsal == null) return -1;
    return a.dorsal - b.dorsal;
  });
}

/** Builds a Google Maps search link as a fallback when no explicit map URL is known. */
export function buildMapsSearchUrl(fieldName: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(fieldName)}`;
}

const EXCUSE_LABELS_ES: Record<string, string> = {
  Injury: "Lesión",
  Study: "Estudios",
  Ill: "Enfermedad",
  "Family Problem": "Problema familiar",
  "Family Event": "Evento familiar",
  "Birthday Event": "Cumpleaños",
};

export function localizeExcuse(name: string): string {
  return EXCUSE_LABELS_ES[name] ?? name;
}

export function getExcuseLabel(
  excuseId: number | null | undefined,
  excuseTypes: ExcuseType[],
): string {
  if (excuseId == null) return "Decisión técnica";
  const et = excuseTypes.find((e) => e.id === excuseId);
  return et ? localizeExcuse(et.name) : "Causa desconocida";
}

export function playerDisplayName(p: PlayerResponse): string {
  // Alias (apodo) takes priority
  if (p.alias?.trim()) return p.alias.trim();
  return ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
}

export type ConvocationSummaryInput = {
  match: MatchState | null;
  calledIds: string[];
  notCalledIds: string[];
  players: PlayerResponse[];
  excuseMap: Record<string, number | null>;
  kits: ClubKit[];
  selectedKitNumber: number | null;
};

export type ConvocationSummary = {
  /** Called-up players sorted by dorsal (shirt number) ascending; no-dorsal players last. */
  calledPlayers: PlayerResponse[];
  notCalledPlayers: PlayerResponse[];
  uniqueNotCalledIds: string[];
  selectedKit: ClubKit | undefined;
  otherKit: ClubKit | undefined;
  arrival: string;
  dateES: string;
  totalCalled: number;
  totalNotCalled: number;
  totalPlayers: number;
  technicalNotCalledCount: number;
  nonTechnicalNotCalledCount: number;
};

export function buildConvocationSummary({
  match,
  calledIds,
  notCalledIds,
  players,
  excuseMap,
  kits,
  selectedKitNumber,
}: ConvocationSummaryInput): ConvocationSummary {
  const calledPlayersRaw = calledIds
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as PlayerResponse[];
  const calledPlayers = sortByDorsalAsc(calledPlayersRaw);

  // Deduplicate notCalledIds — the hook can push the same id more than once
  const uniqueNotCalledIds = [...new Set(notCalledIds)];
  const notCalledPlayers = uniqueNotCalledIds
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as PlayerResponse[];

  const selectedKit = kits.find((k) => k.kitNumber === selectedKitNumber);
  const otherKit = kits.find((k) => k.kitNumber !== selectedKitNumber);

  const arrival = match ? arrivalTime(match.time) : "";
  const dateES = match ? formatDateES(match.date) : "";
  const totalCalled = calledIds.length;
  const totalNotCalled = uniqueNotCalledIds.length;
  const totalPlayers = players.length;
  const technicalNotCalledCount = uniqueNotCalledIds.filter((id) => excuseMap[id] == null).length;
  const nonTechnicalNotCalledCount = totalNotCalled - technicalNotCalledCount;

  return {
    calledPlayers,
    notCalledPlayers,
    uniqueNotCalledIds,
    selectedKit,
    otherKit,
    arrival,
    dateES,
    totalCalled,
    totalNotCalled,
    totalPlayers,
    technicalNotCalledCount,
    nonTechnicalNotCalledCount,
  };
}

/** Builds the WhatsApp-ready text from a summary — shared by the copy-to-clipboard action
 *  in the action bar and the one inside the "Ver convocatoria" dialog. */
export function buildWhatsAppText(
  match: MatchState | null,
  summary: ConvocationSummary,
  excuseMap: Record<string, number | null>,
  excuseTypes: ExcuseType[],
  notes: TeamNote[],
): string {
  const lines: string[] = [];
  lines.push("⚽ *CONVOCATORIA* ⚽");
  lines.push("");

  if (match) {
    lines.push(`🆚 *${match.localTeamName} vs ${match.visitorTeamName}*`);
    if (summary.dateES) lines.push(`📅 ${summary.dateES}`);
    if (match.time) lines.push(`⏰ Hora del partido: *${match.time}*`);
    if (summary.arrival) lines.push(`🕐 Hora de llegada: *${summary.arrival}*`);
    if (match.field) {
      lines.push(`📍 Campo: ${match.field}`);
      const mapsUrl = match.locationMapUrl || buildMapsSearchUrl(match.field);
      lines.push(`🗺️ ${mapsUrl}`);
    }
  }

  if (summary.selectedKit) {
    const kitName = summary.selectedKit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación";
    const kitDescription = (kit: ClubKit) =>
      `Camiseta ${colorName(kit.shirtColor)} / Pantalón ${colorName(kit.shortsColor)}`;

    lines.push("");
    lines.push(`👕 *Se juega con: ${kitName}*: ${kitDescription(summary.selectedKit)}`);
    if (summary.otherKit) {
      const otherKitName = summary.otherKit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación";
      lines.push(`🔁 Traed también la ${otherKitName}: ${kitDescription(summary.otherKit)}`);
    }
  }

  if (notes.length > 0) {
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("📌 *NOTAS*");
    for (const note of notes) {
      lines.push(`• ${note.text}`);
    }
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`✅ *CONVOCADOS (${summary.totalCalled})*`);
  lines.push("");
  for (const p of summary.calledPlayers) {
    const name = playerDisplayName(p);
    const dorsal = p.dorsal != null ? ` (Nº ${p.dorsal})` : "";
    lines.push(`• ${name}${dorsal}`);
  }

  if (summary.notCalledPlayers.length > 0) {
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`❌ *DESCONVOCADOS (${summary.uniqueNotCalledIds.length})*`);
    for (const p of summary.notCalledPlayers) {
      const label = getExcuseLabel(excuseMap[p.id], excuseTypes);
      lines.push(`• ${playerDisplayName(p)} — ${label}`);
    }
  }

  return lines.join("\n");
}
