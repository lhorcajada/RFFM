import type { LotteryBook, LotteryBookStatus, LotteryCampaignRequest } from "../../services/lotteryService";

export const BOOK_STATUS_ORDER: LotteryBookStatus[] = [
  "Unassigned",
  "Assigned",
  "DeliveredToPlayer",
  "ReturnedToCoach",
  "DeliveredToClub",
];

export const BOOK_STATUS_LABELS: Record<LotteryBookStatus, string> = {
  Unassigned: "Sin asignar",
  Assigned: "Asignado",
  DeliveredToPlayer: "Entregado al jugador",
  ReturnedToCoach: "Devuelto al entrenador",
  DeliveredToClub: "Entregado al club",
};

/** Filtro de jugadores: sin taco, o el estado menos avanzado de sus tacos. */
export type PlayerLotteryFilter = "none" | Exclude<LotteryBookStatus, "Unassigned">;

export const PLAYER_FILTER_ORDER: PlayerLotteryFilter[] = [
  "none",
  "Assigned",
  "DeliveredToPlayer",
  "ReturnedToCoach",
  "DeliveredToClub",
];

export type FilterCounts = Record<PlayerLotteryFilter, number>;

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

function statusIndex(status: LotteryBookStatus): number {
  return BOOK_STATUS_ORDER.indexOf(status);
}

export function playerLotteryFilter(books: LotteryBook[]): PlayerLotteryFilter {
  if (books.length === 0) return "none";
  const leastAdvanced = books.reduce((least, b) => (statusIndex(b.status) < statusIndex(least.status) ? b : least));
  return leastAdvanced.status === "Unassigned" ? "none" : leastAdvanced.status;
}

export function booksByPlayer(books: LotteryBook[]): Map<string, LotteryBook[]> {
  const map = new Map<string, LotteryBook[]>();
  [...books]
    .sort((a, b) => a.bookNumber - b.bookNumber)
    .forEach((book) => {
      if (book.teamPlayerId === null) return;
      const list = map.get(book.teamPlayerId) ?? [];
      list.push(book);
      map.set(book.teamPlayerId, list);
    });
  return map;
}

export function countByFilter(players: SearchablePlayer[], books: LotteryBook[]): FilterCounts {
  const grouped = booksByPlayer(books);
  const counts: FilterCounts = { none: 0, Assigned: 0, DeliveredToPlayer: 0, ReturnedToCoach: 0, DeliveredToClub: 0 };
  players.forEach((p) => {
    counts[playerLotteryFilter(grouped.get(p.id) ?? [])] += 1;
  });
  return counts;
}

export function initialFilter(counts: FilterCounts): PlayerLotteryFilter {
  return PLAYER_FILTER_ORDER.find((filter) => counts[filter] > 0) ?? "none";
}

export function bookTicketCount(book: LotteryBook): number {
  return book.lastTicketNumber - book.firstTicketNumber + 1;
}

/** Siguiente número de taco, primera papeleta tras el último taco y última papeleta según el tamaño de la campaña. */
export function suggestNextBook(
  books: LotteryBook[],
  ticketsPerBook: number,
): { bookNumber: number; firstTicketNumber: number; lastTicketNumber: number } {
  const bookNumber = books.length === 0 ? 1 : Math.max(...books.map((b) => b.bookNumber)) + 1;
  const firstTicketNumber = books.length === 0 ? 1 : Math.max(...books.map((b) => b.lastTicketNumber)) + 1;
  return { bookNumber, firstTicketNumber, lastTicketNumber: firstTicketNumber + ticketsPerBook - 1 };
}

/** Qué dato borra deshacer el paso actual del taco y a qué estado vuelve; `null` si no hay nada que deshacer. */
export function undoEffect(status: LotteryBookStatus): { removed: string; previous: LotteryBookStatus } | null {
  const removed: Partial<Record<LotteryBookStatus, string>> = {
    Assigned: "el jugador",
    DeliveredToPlayer: "la fecha de entrega",
    ReturnedToCoach: "la fecha y el importe de la devolución",
    DeliveredToClub: "la fecha de entrega al club",
  };
  const text = removed[status];
  if (!text) return null;
  return { removed: text, previous: BOOK_STATUS_ORDER[statusIndex(status) - 1] };
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
