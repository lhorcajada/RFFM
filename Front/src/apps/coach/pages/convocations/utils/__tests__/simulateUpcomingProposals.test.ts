import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput } from "../deconvokeProposal";
import { simulateUpcomingProposals } from "../simulateUpcomingProposals";
import type { UpcomingMatch } from "../rivalDifficulty";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };

function player(id: string, activePositionId: number, extra: Partial<PlayerResponse> = {}): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId], ...extra };
}

// 2 POR, 3 LAT, 4 DFC, 5 MC, 4 banda, 3 DC = 21 convocables: se desconvocan 3 por jornada (18 máximo).
function squad(extra: Record<string, Partial<PlayerResponse>> = {}): PlayerResponse[] {
  const base: Array<[string, number]> = [
    ["gk1", 1], ["gk2", 1],
    ["lat1", 2], ["lat2", 3], ["lat3", 2],
    ["dfc1", 4], ["dfc2", 4], ["dfc3", 5], ["dfc4", 4],
    ["mc1", 6], ["mc2", 6], ["mc3", 7], ["mc4", 8], ["mc5", 6],
    ["b1", 13], ["b2", 14], ["b3", 13], ["b4", 14],
    ["dc1", 11], ["dc2", 11], ["dc3", 11],
  ];
  return base.map(([id, pos]) => player(id, pos, extra[id]));
}

const COLUMNS: MatchColumn[] = Array.from({ length: 4 }, (_, i) => ({
  eventId: `e${i}`,
  label: `J${4 - i}`,
  date: `2026-10-${String(20 - i).padStart(2, "0")}`,
  rival: null,
  isLeague: true,
}));

const MATCHES: UpcomingMatch[] = [
  { eventId: "upcoming-6", round: 6, label: "J6", date: "2026-10-28", rival: "Getafe", difficulty: "medium", winProbability: 0.5 },
  { eventId: "upcoming-7", round: 7, label: "J7", date: "2026-11-04", rival: "Alcorcón", difficulty: "hard", winProbability: 0.2 },
  { eventId: "upcoming-8", round: 8, label: "J8", date: "2026-11-11", rival: "Rayo", difficulty: "easy", winProbability: 0.8 },
];

function baseInput(players: PlayerResponse[], alreadyOutIds?: Set<string>): BuildProposalInput {
  const grid = new Map<string, Map<string, GridCell>>();
  COLUMNS.forEach((col) => grid.set(col.eventId, new Map(players.map((p) => [p.id, CALLED]))));
  return {
    players,
    calledIds: players.map((p) => p.id),
    alreadyOutIds,
    ratings: {},
    streaks: new Map(players.map((p) => [p.id, COLUMNS.length])),
    technicalTotals: new Map(),
    seasonEvents: [],
    seasonColumns: COLUMNS,
    enrichedGrid: grid,
    seasonStats: [],
    lastInjuryEndMap: new Map(),
    currentDate: "2026-10-21",
    currentEventId: "current",
    currentRival: "Vallecas",
    weekTrainingStats: new Map(),
    weekTrainingCount: 0,
    maxCalledPlayers: 18,
    rivalDifficulty: "medium",
    upcomingDifficulties: MATCHES.map((m) => m.difficulty),
  };
}

function run(players = squad(), options: { alreadyOut?: string[]; injuryReturn?: Map<string, string | null>; matches?: UpcomingMatch[] } = {}) {
  const input = baseInput(players, options.alreadyOut ? new Set(options.alreadyOut) : undefined);
  const baseProposal = buildDeconvokeProposal(input);
  return { baseProposal, result: simulateUpcomingProposals({ base: input, baseProposal, matches: options.matches ?? MATCHES, injuryReturn: options.injuryReturn }) };
}

describe("simulateUpcomingProposals", () => {
  it("devuelve una propuesta por partido, en orden, con su partido", () => {
    const { result } = run();

    expect(result.map((r) => r.match.eventId)).toEqual(["upcoming-6", "upcoming-7", "upcoming-8"]);
    expect(result.every((r) => r.proposal.players.length > 0)).toBe(true);
  });

  it("cada propuesta usa la dificultad de su partido y los partidos que le siguen", () => {
    const { result } = run();

    expect(result.map((r) => r.proposal.rivalDifficulty)).toEqual(["medium", "hard", "easy"]);
    expect(result[0].proposal.schedule.upcoming).toEqual(["hard", "easy"]);
    expect(result[2].proposal.schedule.upcoming).toEqual([]);
  });

  it("encadena: el desconvocado en la propuesta actual queda protegido en la siguiente", () => {
    const { baseProposal, result } = run();
    const rested = baseProposal.selectedIds[0];
    const next = result[0].proposal.players.find((p) => p.playerId === rested)!;

    expect(next.decision.group).toBe("protected");
    expect(next.decision.reason).toMatch(/decisión técnica.*hace 1 jornada/);
    expect(result[0].proposal.selectedIds).not.toContain(rested);
  });

  it("encadena: no repite desconvocados mientras haya elegibles distintos", () => {
    const { baseProposal, result } = run();
    const all = [...baseProposal.selectedIds, ...result[0].proposal.selectedIds];

    expect(new Set(all).size).toBe(all.length);
  });

  it("encadena: los convocados acumulan una jornada seguida más", () => {
    const { baseProposal, result } = run();
    const stays = baseProposal.order.find((entry) => entry.outcome === "stays")!;
    const seguidas = (chips: string[]) => Number(chips[0].split(" ")[0]);
    const before = seguidas(stays.chips);
    const after = result[0].proposal.order.find((entry) => entry.playerId === stays.playerId);

    expect(after).toBeDefined();
    expect(seguidas(after!.chips)).toBe(before + 1);
  });

  it("un lesionado sigue fuera hasta su fecha de regreso y vuelve a estar disponible después", () => {
    const players = squad({ mc5: { isInjured: true, injuryStartDate: "2026-10-10" } });
    const { result } = run(players, { alreadyOut: ["mc5"], injuryReturn: new Map([["mc5", "2026-11-03"]]) });

    const outIn = (i: number) => result[i].proposal.alreadyDeconvoked.some((p) => p.playerId === "mc5");
    const evaluatedIn = (i: number) => result[i].proposal.players.some((p) => p.playerId === "mc5");

    expect(outIn(0)).toBe(true);
    expect(evaluatedIn(0)).toBe(false);
    expect(outIn(1)).toBe(false);
    expect(evaluatedIn(1)).toBe(true);
  });

  it("un lesionado sin fecha estimada de regreso está fuera en todas las propuestas", () => {
    const players = squad({ mc5: { isInjured: true } });
    const { result } = run(players, { alreadyOut: ["mc5"] });

    expect(result.every((r) => r.proposal.alreadyDeconvoked.some((p) => p.playerId === "mc5"))).toBe(true);
    expect(result.some((r) => r.proposal.selectedIds.includes("mc5"))).toBe(false);
  });

  it("da por hecho que todos entrenan: la asistencia no diferencia a nadie", () => {
    const players = squad();
    const input = baseInput(players);
    input.weekTrainingCount = 2;
    input.weekTrainingStats = new Map([
      ["mc1", { totalTrainings: 2, attendedTrainings: 0, weightedAttendedTrainings: 0, attendedTrainingsSeason: 0, weightedAttendedTrainingsSeason: 0, totalTrainingsSeason: 10, knownUnavailableTrainings: 0 }],
    ]);
    const baseProposal = buildDeconvokeProposal(input);
    const result = simulateUpcomingProposals({ base: input, baseProposal, matches: MATCHES });
    const chips = result[0].proposal.order.map((entry) => entry.chips[4]);

    expect(new Set(chips)).toEqual(new Set(["Asistencia 100%"]));
  });

  it("sin partidos siguientes no devuelve nada", () => {
    expect(run(squad(), { matches: [] }).result).toEqual([]);
  });

  it("no modifica los datos de entrada", () => {
    const players = squad();
    const input = baseInput(players);
    const columnsBefore = input.seasonColumns.length;
    const gridBefore = input.enrichedGrid.size;
    const baseProposal = buildDeconvokeProposal(input);
    simulateUpcomingProposals({ base: input, baseProposal, matches: MATCHES });

    expect(input.seasonColumns).toHaveLength(columnsBefore);
    expect(input.enrichedGrid.size).toBe(gridBefore);
  });

  it("reserva a los más débiles para el partido más difícil: no salen antes y salen en él", () => {
    const players = squad();
    const input = baseInput(players);
    const levels: Record<string, number> = { dfc2: 2, mc2: 2.5, b2: 3, mc1: 9, dfc1: 9, b1: 9, dc1: 9 };
    input.ratings = Object.fromEntries(
      players.map((p) => [p.id, { competitiveness: levels[p.id] ?? 5, physical: levels[p.id] ?? 5, tactical: levels[p.id] ?? 5, technical: levels[p.id] ?? 5 } as never]),
    );
    input.rivalDifficulty = "medium";
    input.rivalWinProbability = 0.5;
    const matches: UpcomingMatch[] = [
      { eventId: "u1", round: 6, label: "J6", date: "2026-10-28", rival: "A", difficulty: "medium", winProbability: 0.5 },
      { eventId: "u2", round: 7, label: "J7", date: "2026-11-04", rival: "Carrascal", difficulty: "hard", winProbability: 0.1 },
    ];
    input.upcomingDifficulties = matches.map((m) => m.difficulty);
    input.upcomingWinProbabilities = matches.map((m) => m.winProbability);
    const baseProposal = buildDeconvokeProposal(input);

    const result = simulateUpcomingProposals({ base: input, baseProposal, matches });
    const weak = ["dfc2", "mc2", "b2"];

    expect(baseProposal.selectedIds.some((id) => weak.includes(id))).toBe(false);
    expect(result[0].proposal.selectedIds.some((id) => weak.includes(id))).toBe(false);
    expect([...result[1].proposal.selectedIds].sort()).toEqual([...weak].sort());
  });
});
