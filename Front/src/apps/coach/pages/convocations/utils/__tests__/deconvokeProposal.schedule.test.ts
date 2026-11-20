import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput } from "../deconvokeProposal";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PlayerRating } from "../../../../types/playerRating";
import type { RivalDifficulty } from "../deconvocationFunnel";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };

function player(id: string, activePositionId: number, possible: number[] = [activePositionId]): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: possible };
}

// 2 POR, 3 LAT, 4 DFC, 5 MC, 4 banda, 3 DC = 21 convocables (3 de más sobre 18).
function squad(): PlayerResponse[] {
  return [
    player("gk1", 1), player("gk2", 1),
    player("lat1", 2), player("lat2", 3), player("lat3", 2),
    player("dfc1", 4), player("dfc2", 4), player("dfc3", 5), player("dfc4", 4),
    player("mc1", 6), player("mc2", 6), player("mc3", 7), player("mc4", 8), player("mc5", 6),
    player("b1", 13), player("b2", 14), player("b3", 13), player("b4", 14),
    player("dc1", 11), player("dc2", 11), player("dc3", 11),
  ];
}

const COLUMNS: MatchColumn[] = Array.from({ length: 4 }, (_, i) => ({
  eventId: `e${i}`,
  label: `J${4 - i}`,
  date: `2026-10-${String(20 - i).padStart(2, "0")}`,
  rival: null,
}));

function rating(level: number): PlayerRating {
  return { competitiveness: level, physical: level, tactical: level, technical: level } as PlayerRating;
}

function build(
  players: PlayerResponse[],
  options: { levels?: Record<string, number>; difficulty?: RivalDifficulty; upcoming?: RivalDifficulty[]; maxCalled?: number } = {},
) {
  const grid = new Map<string, Map<string, GridCell>>();
  COLUMNS.forEach((col) => grid.set(col.eventId, new Map(players.map((p) => [p.id, CALLED]))));
  const ratings = Object.fromEntries(players.map((p) => [p.id, rating(options.levels?.[p.id] ?? 5)]));
  const input: BuildProposalInput = {
    players,
    calledIds: players.map((p) => p.id),
    ratings,
    streaks: new Map(),
    technicalTotals: new Map(),
    seasonEvents: [],
    seasonColumns: COLUMNS,
    enrichedGrid: grid,
    seasonStats: [],
    lastInjuryEndMap: new Map(),
    currentDate: "2026-10-21",
    currentEventId: null,
    currentRival: null,
    weekTrainingStats: new Map(),
    weekTrainingCount: 0,
    maxCalledPlayers: options.maxCalled ?? 18,
    rivalDifficulty: options.difficulty ?? "medium",
    upcomingDifficulties: options.upcoming,
  };
  return buildDeconvokeProposal(input);
}

// Los mejores de cada línea (nivel 9): se espera que sean los últimos en salir salvo descanso planificado.
const STARS = { dfc1: 9, mc1: 9, b1: 9, dc1: 9 };

describe("buildDeconvokeProposal — próximos partidos y reparto", () => {
  it("expone el calendario y los fuertes en la propuesta", () => {
    const proposal = build(squad(), { levels: STARS, upcoming: ["easy", "hard", "medium"] });

    expect(proposal.schedule.upcoming).toEqual(["easy", "hard", "medium"]);
    expect(proposal.schedule.keepStrong).toBe(true);
    expect(proposal.schedule.strongCount).toBeGreaterThan(0);
  });

  it("sin partidos difíciles próximos no activa el descanso de fuertes", () => {
    const proposal = build(squad(), { levels: STARS, upcoming: ["easy", "medium"] });

    expect(proposal.schedule.keepStrong).toBe(false);
  });

  it("ante un rival difícil no desconvoca a ningún fuerte si hay alternativa", () => {
    const proposal = build(squad(), { levels: STARS, difficulty: "hard", upcoming: ["hard"] });
    const strong = new Set(Object.keys(STARS));

    expect(proposal.selectedIds).toHaveLength(3);
    expect(proposal.selectedIds.some((id) => strong.has(id))).toBe(false);
  });

  it("con un partido difícil por delante no desconvoca a los importantes en el partido actual", () => {
    const proposal = build(squad(), { levels: STARS, difficulty: "medium", upcoming: ["medium", "hard"] });

    expect(proposal.selectedIds).toHaveLength(3);
    expect(proposal.selectedIds.some((id) => id in STARS)).toBe(false);
  });

  it("ante un rival difícil desconvoca a los de menor nivel aunque lleven menos jornadas seguidas", () => {
    const levels = { ...STARS, lat1: 2, mc2: 2, b2: 2, dc2: 2 };
    const players = squad();
    const grid = build(players, { levels, difficulty: "hard", upcoming: [] });

    expect(grid.selectedIds).toHaveLength(3);
    expect(grid.selectedIds.every((id) => levels[id as keyof typeof levels] <= 2 || !(id in STARS))).toBe(true);
    expect(grid.selectedIds.some((id) => id in STARS)).toBe(false);
  });

  it("no desconvoca a dos jugadores de la misma línea si hay alternativa", () => {
    const proposal = build(squad(), { levels: STARS, difficulty: "easy", upcoming: ["hard"] });
    const lines = proposal.selectedIds.map((id) => {
      if (id.startsWith("lat") || id.startsWith("dfc")) return "defence";
      if (id.startsWith("mc")) return "midfield";
      if (id.startsWith("b")) return "wide";
      return "forward";
    });

    expect(new Set(lines).size).toBe(lines.length);
  });

  it("no quita a un delantero si dejaría menos de dos jugadores que puedan jugar de delantero", () => {
    const players = squad().filter((p) => p.id !== "dc3");
    const proposal = build(players, { maxCalled: 17, levels: { dc1: 1, dc2: 1 } });

    expect(proposal.selectedIds.some((id) => id.startsWith("dc"))).toBe(false);
    const dc = proposal.players.find((p) => p.playerId === "dc1")!;
    expect(dc.decision.group).toBe("protected");
    expect(dc.decision.reason).toContain("delantero");
  });

  it("cuenta como cobertura de delantero a quien lo tiene entre sus posiciones posibles", () => {
    const players = [...squad().filter((p) => p.id !== "dc3"), player("b5", 13, [13, 11])];
    const proposal = build(players, { maxCalled: 18, levels: { dc1: 1, dc2: 9 } });

    expect(proposal.selectedIds).toContain("dc1");
  });

  it("explica en la tarjeta por qué un jugador se queda para repartir líneas", () => {
    const proposal = build(squad(), { levels: STARS, difficulty: "easy", upcoming: ["hard"] });
    const skipped = proposal.players.filter((p) => p.decision.group === "notChosen" && /línea|importantes/.test(p.decision.reason));

    expect(skipped.length).toBeGreaterThan(0);
  });
});
