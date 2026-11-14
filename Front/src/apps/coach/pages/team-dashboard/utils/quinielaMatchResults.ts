import type { QuinielaMatch, QuinielaSign, QuinielaTicket } from "../../../services/quinielaService";
import { parseUtc, signOfGoals } from "../../quiniela/quinielaHelpers";

export type MatchStatus = "final" | "live" | "upcoming";
export type PickOutcome = "hit" | "miss" | "pending" | "none";

export type TicketPickView = {
  ticketNumber: number;
  sign: QuinielaSign | null;
  outcome: PickOutcome;
  /** Solo los boletos pagados participan en la quiniela. */
  participates: boolean;
};

export type QuinielaMatchRow = {
  recordCode: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string | null;
  isPleno: boolean;
  status: MatchStatus;
  score: string | null;
  picks: TicketPickView[];
};

export type TicketSummary = { number: number; hits: number; played: number; total: number };

function statusOf(match: QuinielaMatch, now: Date): MatchStatus {
  if (match.isFinal && match.homeGoals !== null && match.awayGoals !== null) return "final";
  if (match.kickoffUtc && parseUtc(match.kickoffUtc).getTime() <= now.getTime()) return "live";
  return "upcoming";
}

export function buildQuinielaMatchRows(
  matches: QuinielaMatch[],
  tickets: QuinielaTicket[],
  now: Date,
): QuinielaMatchRow[] {
  return matches
    .filter((m) => m.isValid)
    .map((m) => {
      const status = statusOf(m, now);
      const result = status === "final" ? signOfGoals(m.homeGoals as number, m.awayGoals as number) : null;
      return {
        recordCode: m.recordCode,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffUtc: m.kickoffUtc,
        isPleno: m.isPleno,
        status,
        score: status === "final" ? `${m.homeGoals}-${m.awayGoals}` : null,
        picks: tickets.map((t): TicketPickView => {
          const sign = t.picks.find((p) => p.recordCode === m.recordCode)?.sign ?? null;
          const participates = t.paymentStatus === "Paid";
          let outcome: PickOutcome = "none";
          if (sign && participates) {
            outcome = result === null ? "pending" : sign === result ? "hit" : "miss";
          }
          return { ticketNumber: t.number, sign, outcome, participates };
        }),
      };
    });
}

export function summarizeTickets(rows: QuinielaMatchRow[], tickets: QuinielaTicket[]): TicketSummary[] {
  return tickets
    .filter((t) => t.paymentStatus === "Paid")
    .map((t) => {
      const picks = rows.map((r) => r.picks.find((p) => p.ticketNumber === t.number));
      return {
        number: t.number,
        hits: picks.filter((p) => p?.outcome === "hit").length,
        played: picks.filter((p) => p?.outcome === "hit" || p?.outcome === "miss").length,
        total: rows.length,
      };
    });
}
