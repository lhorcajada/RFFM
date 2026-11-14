import { describe, expect, it } from "vitest";
import type { QuinielaMatch, QuinielaTicket } from "../../../../services/quinielaService";
import { buildQuinielaMatchRows, summarizeTickets } from "../quinielaMatchResults";

const NOW = new Date("2026-11-14T12:00:00Z");

const match = (over: Partial<QuinielaMatch>): QuinielaMatch => ({
  recordCode: "m1",
  homeTeam: "Local A",
  awayTeam: "Visitante A",
  kickoffUtc: "2026-11-14T09:00:00Z",
  isValid: true,
  isPleno: false,
  homeGoals: null,
  awayGoals: null,
  isFinal: false,
  ...over,
});

const ticket = (over: Partial<QuinielaTicket> = {}): QuinielaTicket => ({
  id: "t1",
  number: 1,
  picks: [],
  plenoHome: 0,
  plenoAway: 0,
  paymentStatus: "Paid",
  paymentDeadlineUtc: null,
  hits: null,
  category: null,
  prize: null,
  ...over,
});

describe("buildQuinielaMatchRows", () => {
  it("deja fuera los partidos aplazados", () => {
    const rows = buildQuinielaMatchRows([match({}), match({ recordCode: "m2", isValid: false })], [], NOW);

    expect(rows.map((r) => r.recordCode)).toEqual(["m1"]);
  });

  it("marca el estado según el partido haya terminado, esté en juego o no haya empezado", () => {
    const rows = buildQuinielaMatchRows(
      [
        match({ recordCode: "fin", isFinal: true, homeGoals: 2, awayGoals: 1 }),
        match({ recordCode: "juego", kickoffUtc: "2026-11-14T11:00:00Z" }),
        match({ recordCode: "luego", kickoffUtc: "2026-11-14T17:00:00Z" }),
      ],
      [],
      NOW,
    );

    expect(rows.map((r) => r.status)).toEqual(["final", "live", "upcoming"]);
    expect(rows[0].score).toBe("2-1");
    expect(rows[1].score).toBeNull();
  });

  it("indica acierto o fallo del boleto pagado solo cuando el partido ha terminado", () => {
    const finished = match({ recordCode: "fin", isFinal: true, homeGoals: 2, awayGoals: 1 });
    const draw = match({ recordCode: "emp", isFinal: true, homeGoals: 0, awayGoals: 0 });
    const upcoming = match({ recordCode: "luego", kickoffUtc: "2026-11-14T17:00:00Z" });
    const t = ticket({
      picks: [
        { recordCode: "fin", sign: "1" },
        { recordCode: "emp", sign: "1" },
        { recordCode: "luego", sign: "2" },
      ],
    });

    const rows = buildQuinielaMatchRows([finished, draw, upcoming], [t], NOW);

    expect(rows.map((r) => r.picks[0].outcome)).toEqual(["hit", "miss", "pending"]);
    expect(rows[2].picks[0].sign).toBe("2");
  });

  it("si el boleto no tiene pronóstico para el partido, lo indica sin acierto ni fallo", () => {
    const rows = buildQuinielaMatchRows([match({ isFinal: true, homeGoals: 1, awayGoals: 0 })], [ticket()], NOW);

    expect(rows[0].picks[0]).toMatchObject({ sign: null, outcome: "none" });
  });

  it("un boleto sin pagar muestra su pronóstico pero no cuenta aciertos", () => {
    const t = ticket({ paymentStatus: "Pending", picks: [{ recordCode: "m1", sign: "1" }] });

    const rows = buildQuinielaMatchRows([match({ isFinal: true, homeGoals: 1, awayGoals: 0 })], [t], NOW);

    expect(rows[0].picks[0]).toMatchObject({ sign: "1", outcome: "none", participates: false });
  });
});

describe("summarizeTickets", () => {
  it("cuenta aciertos sobre los partidos ya terminados de cada boleto pagado", () => {
    const matches = [
      match({ recordCode: "a", isFinal: true, homeGoals: 1, awayGoals: 0 }),
      match({ recordCode: "b", isFinal: true, homeGoals: 0, awayGoals: 2 }),
      match({ recordCode: "c", kickoffUtc: "2026-11-14T17:00:00Z" }),
    ];
    const t = ticket({
      picks: [
        { recordCode: "a", sign: "1" },
        { recordCode: "b", sign: "X" },
        { recordCode: "c", sign: "1" },
      ],
    });

    const summary = summarizeTickets(buildQuinielaMatchRows(matches, [t], NOW), [t]);

    expect(summary).toEqual([{ number: 1, hits: 1, played: 2, total: 3 }]);
  });

  it("no incluye los boletos que no participan", () => {
    const t = ticket({ paymentStatus: "Expired" });

    expect(summarizeTickets(buildQuinielaMatchRows([match({})], [t], NOW), [t])).toEqual([]);
  });
});
