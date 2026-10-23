import { getPendingAmount, isSanctionNotServed, isSanctionPending } from "../../../services/sanctionStatus";
import type { SanctionRecord } from "../../../services/teamplayerSanctionService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { SportEventResponse } from "../../../services/sportEventService";

export type PendingSanctionsMessageInput = {
  teamName: string | null | undefined;
  date: Date;
  rows: { player: PlayerResponse; sanction: SanctionRecord }[];
  events: SportEventResponse[];
};

export function eventDateValue(ev: SportEventResponse | undefined | null): string | null {
  if (!ev) return null;
  return ev.eveDateTime ?? ev.startTime ?? ev.start ?? null;
}

export function playerDisplayName(player: PlayerResponse): string {
  return ((player.name ?? "") + " " + (player.lastName ?? "")).trim() || player.alias;
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function describeEvent(ev: SportEventResponse | undefined): string {
  if (!ev) return "";
  const rival = ev.rivalName ?? ev.rival;
  const label = rival ? `vs ${rival}` : (ev.name ?? ev.title ?? "");
  const dateStr = eventDateValue(ev);
  const date = dateStr
    ? new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
    : "";
  return [label, date && `(${date})`].filter(Boolean).join(" ");
}

function describeSanction(sanction: SanctionRecord, eventsById: Map<string, SportEventResponse>): string {
  const parts = [sanction.sanctionType];
  if (isSanctionNotServed(sanction) &&sanction.sportivePunishmentType) {
    const punishment =
      sanction.sportivePunishmentType === "Deconvocation"
        ? "desconvocado"
        : `máx. ${sanction.minutesLimit ?? "?"}'`;
    const event = sanction.targetEventId ? describeEvent(eventsById.get(sanction.targetEventId)) : "";
    parts.push([punishment, event].filter(Boolean).join(" "));
  }
  const pending = getPendingAmount(sanction);
  if (pending != null && pending > 0) parts.push(`${formatEuros(pending)} pendientes`);
  return `• ${parts.join(" – ")}`;
}

/** Builds the WhatsApp-ready list of pending sanctions for the parents' group,
 * grouped by player (alphabetically) with the overall pending amount at the end. */
export function buildPendingSanctionsMessage({ teamName, date, rows, events }: PendingSanctionsMessageInput): string {
  const header = [
    `*Sanciones pendientes${teamName ? ` – ${teamName}` : ""}*`,
    `_${date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}_`,
  ];

  const pendingRows = rows.filter(({ sanction }) => isSanctionPending(sanction));
  if (pendingRows.length === 0) return [...header, "", "No hay sanciones pendientes."].join("\n");

  const eventsById = new Map(events.map((e) => [e.id, e]));
  const byPlayer = new Map<string, { name: string; sanctions: SanctionRecord[] }>();
  for (const { player, sanction } of pendingRows) {
    const group = byPlayer.get(player.id) ?? { name: playerDisplayName(player), sanctions: [] };
    group.sanctions.push(sanction);
    byPlayer.set(player.id, group);
  }

  const groups = [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const lines = [...header];
  for (const group of groups) {
    const sorted = [...group.sanctions].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    lines.push("", `*${group.name}*`, ...sorted.map((s) => describeSanction(s, eventsById)));
  }

  const totalPending = pendingRows.reduce((sum, { sanction }) => sum + Math.max(getPendingAmount(sanction) ?? 0, 0), 0);
  if (totalPending > 0) lines.push("", `*Total pendiente: ${formatEuros(totalPending)}*`);

  return lines.join("\n");
}
