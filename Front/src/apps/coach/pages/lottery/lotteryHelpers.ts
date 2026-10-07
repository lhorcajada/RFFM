import type { LotteryBook, LotteryCampaignRequest } from "../../services/lotteryService";

export type LotteryStatus = "none" | "pending" | "returned";

export type StatusCounts = Record<LotteryStatus, number>;

export type SearchablePlayer = {
  id: string;
  name: string;
  lastName?: string | null;
  alias: string;
  dorsal?: number | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function wordsStartWith(text: string | null | undefined, query: string): boolean {
  const normalized = normalize(text);
  if (normalized.startsWith(query)) return true;
  return normalized.split(/\s+/).some((word) => word.startsWith(query));
}

function byDorsal(a: SearchablePlayer, b: SearchablePlayer): number {
  const da = a.dorsal ?? Number.MAX_SAFE_INTEGER;
  const db = b.dorsal ?? Number.MAX_SAFE_INTEGER;
  if (da !== db) return da - db;
  return normalize(a.alias || a.name).localeCompare(normalize(b.alias || b.name));
}

/**
 * Busca por orden de prioridad: dorsal exacto, alias y, por último, nombre y apellidos. Los resultados
 * salen agrupados en ese orden y, dentro de cada grupo, por dorsal.
 */
export function searchPlayers<T extends SearchablePlayer>(players: T[], query: string): T[] {
  const sorted = [...players].sort(byDorsal);
  const q = normalize(query);
  if (!q) return sorted;

  const isNumber = /^\d+$/.test(q);
  const byExactDorsal = isNumber ? sorted.filter((p) => p.dorsal === Number(q)) : [];
  const byAlias = sorted.filter((p) => !byExactDorsal.includes(p) && wordsStartWith(p.alias, q));
  const byName = sorted.filter(
    (p) =>
      !byExactDorsal.includes(p) &&
      !byAlias.includes(p) &&
      wordsStartWith(`${p.name} ${p.lastName ?? ""}`, q),
  );
  return [...byExactDorsal, ...byAlias, ...byName];
}

export function playerLotteryStatus(books: LotteryBook[]): LotteryStatus {
  if (books.length === 0) return "none";
  return books.some((b) => b.amountReturned === null) ? "pending" : "returned";
}

export function booksByPlayer(books: LotteryBook[]): Map<string, LotteryBook[]> {
  const map = new Map<string, LotteryBook[]>();
  [...books]
    .sort((a, b) => a.bookNumber - b.bookNumber)
    .forEach((book) => {
      const list = map.get(book.teamPlayerId) ?? [];
      list.push(book);
      map.set(book.teamPlayerId, list);
    });
  return map;
}

export function countByStatus(players: SearchablePlayer[], books: LotteryBook[]): StatusCounts {
  const grouped = booksByPlayer(books);
  const counts: StatusCounts = { none: 0, pending: 0, returned: 0 };
  players.forEach((p) => {
    counts[playerLotteryStatus(grouped.get(p.id) ?? [])] += 1;
  });
  return counts;
}

export function initialStatusFilter(counts: StatusCounts): LotteryStatus {
  if (counts.none > 0) return "none";
  if (counts.pending > 0) return "pending";
  if (counts.returned > 0) return "returned";
  return "none";
}

export function suggestNextBook(books: LotteryBook[]): { bookNumber: number; firstTicketNumber: number } {
  if (books.length === 0) return { bookNumber: 1, firstTicketNumber: 1 };
  return {
    bookNumber: Math.max(...books.map((b) => b.bookNumber)) + 1,
    firstTicketNumber: Math.max(...books.map((b) => b.lastTicketNumber)) + 1,
  };
}

export function formatEuros(value: number | null | undefined): string {
  const amount = value ?? 0;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} €`;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "2026-12-09" → "09/12". */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function isWithin(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

/** Valores con los que se rellena una campaña nueva; todos se pueden cambiar. */
export function christmasCampaignDefaults(date: Date = new Date()): LotteryCampaignRequest {
  const year = date.getFullYear();
  return {
    name: `Lotería de Navidad ${year}`,
    drawDate: `${year}-12-22`,
    ticketPrice: 5,
    ticketsPerBook: 15,
    clubDeliveryFrom: `${year}-12-09`,
    clubDeliveryTo: `${year}-12-15`,
  };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}
