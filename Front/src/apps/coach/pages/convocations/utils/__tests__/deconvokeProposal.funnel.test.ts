import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput } from "../deconvokeProposal";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PlayerRating } from "../../../../types/playerRating";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };
const MISSING: GridCell = { statusId: null, excuseTypeId: null, statusName: "", excuseName: null };
const TECHNICAL: GridCell = { statusId: 3, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const FAMILY: GridCell = { statusId: 3, excuseTypeId: 4, statusName: "Deconvoke", excuseName: "Problema familiar" };
const INJURY: GridCell = { statusId: 3, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };

function player(id: string, activePositionId: number): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] };
}

// 2 POR, 3 LAT, 3 DFC, 5 MC, 2 banda, 1 DC = 16 jugadores: solo los medios centro tienen margen.
function team(): PlayerResponse[] {
  return [
    player("gk1", 1), player("gk2", 1),
    player("lat1", 2), player("lat2", 3), player("lat3", 2),
    player("dfc1", 4), player("dfc2", 4), player("dfc3", 5),
    player("mc1", 6), player("mc2", 6), player("mc3", 7), player("mc4", 8), player("mc5", 6),
    player("ei", 13), player("ed", 14),
    player("dc", 11),
  ];
}

const COLUMNS: MatchColumn[] = Array.from({ length: 6 }, (_, i) => ({
  eventId: `e${i}`,
  label: `J${6 - i}`,
  date: `2026-10-${String(20 - i).padStart(2, "0")}`,
  rival: null,
}));

/** Cells by player and matchday index (0 = previous matchday); everything else is called. */
function build(
  players: PlayerResponse[],
  options: {
    cells?: Record<string, Record<number, GridCell>>;
    maxCalledPlayers?: number;
    alreadyOutIds?: string[];
    ratings?: Record<string, PlayerRating>;
    difficulty?: BuildProposalInput["rivalDifficulty"];
    windows?: BuildProposalInput["protectionWindows"];
    extra?: Partial<BuildProposalInput>;
  } = {},
) {
  const grid = new Map<string, Map<string, GridCell>>();
  COLUMNS.forEach((col, index) => {
    const column = new Map<string, GridCell>();
    for (const p of players) column.set(p.id, options.cells?.[p.id]?.[index] ?? CALLED);
    grid.set(col.eventId, column);
  });
  return buildDeconvokeProposal({
    players,
    calledIds: players.map((p) => p.id),
    ratings: options.ratings ?? {},
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
    maxCalledPlayers: options.maxCalledPlayers ?? 15,
    alreadyOutIds: options.alreadyOutIds ? new Set(options.alreadyOutIds) : undefined,
    rivalDifficulty: options.difficulty,
    protectionWindows: options.windows,
    ...options.extra,
  });
}

function rating(level: number): PlayerRating {
  return {
    id: "r",
    teamPlayerId: "x",
    isGoalkeeper: false,
    physical: level,
    technical: level,
    tactical: level,
    competitiveness: level,
  } as PlayerRating;
}

const find = (proposal: ReturnType<typeof build>, id: string) => proposal.players.find((p) => p.playerId === id)!;

describe("buildDeconvokeProposal — protección", () => {
  it("protege a quien fue desconvocado por decisión técnica hace 3 jornadas", () => {
    const proposal = build(team(), { cells: { mc1: { 2: TECHNICAL } } });

    expect(proposal.selectedIds).not.toContain("mc1");
    expect(find(proposal, "mc1").decision).toMatchObject({
      group: "protected",
      reason: "Protegido: desconvocado hace 3 jornadas",
    });
  });

  it("deja de proteger cuando la desconvocatoria técnica queda fuera de la ventana", () => {
    const proposal = build(team(), { cells: { mc1: { 5: TECHNICAL } }, windows: { technical: 4, injuryRest: 1, otherCause: 4 } });

    expect(find(proposal, "mc1").decision.group).not.toBe("protected");
  });

  it("protege a quien fue desconvocado la jornada anterior por un problema familiar y lo dice", () => {
    const proposal = build(team(), { cells: { mc1: { 0: FAMILY } } });

    expect(proposal.selectedIds).not.toContain("mc1");
    expect(find(proposal, "mc1").decision.reason).toBe("Protegido: desconvocado hace 1 jornada por problema familiar");
  });

  it("con una técnica antigua y una por problema familiar reciente muestra la reciente", () => {
    const proposal = build(team(), { cells: { mc1: { 0: FAMILY, 4: TECHNICAL } } });

    expect(find(proposal, "mc1").decision.reason).toBe("Protegido: desconvocado hace 1 jornada por problema familiar");
  });

  it("una desconvocatoria por otro motivo de hace 5 jornadas ya no protege", () => {
    const proposal = build(team(), { cells: { mc1: { 4: FAMILY } } });

    expect(find(proposal, "mc1").decision.group).not.toBe("protected");
  });

  it("la técnica protege hasta 8 jornadas", () => {
    const proposal = build(team(), { cells: { mc1: { 5: TECHNICAL } } });

    expect(find(proposal, "mc1").decision.reason).toBe("Protegido: desconvocado hace 6 jornadas");
  });

  it("protege a quien no vino la jornada anterior por una lesión leve", () => {
    const proposal = build(team(), { cells: { mc1: { 0: INJURY } } });

    expect(proposal.selectedIds).not.toContain("mc1");
    expect(find(proposal, "mc1").decision.reason).toBe("Protegido: no vino la jornada anterior por lesión");
  });

  it("una lesión de hace dos jornadas ya no protege con ventana de una", () => {
    const proposal = build(team(), { cells: { mc1: { 1: INJURY } } });

    expect(find(proposal, "mc1").decision.group).not.toBe("protected");
  });

  it("protege a quien no llega a su cuota de convocatorias", () => {
    const proposal = build(team(), {
      cells: { mc1: { 0: MISSING, 1: MISSING, 2: MISSING, 3: MISSING } },
    });

    expect(find(proposal, "mc1").decision.reason).toContain("para llegar al mínimo exigido");
    expect(proposal.selectedIds).not.toContain("mc1");
  });
});

describe("buildDeconvokeProposal — orden de justicia", () => {
  it("no propone a quien descansó hace poco aunque vaya primero en la plantilla", () => {
    const proposal = build(team(), { cells: { mc1: { 3: MISSING } } });

    expect(proposal.selectedIds).toEqual(["mc2"]);
    expect(find(proposal, "mc2").decision.group).toBe("proposed");
  });

  it("explica el criterio que decidió y frente a quién", () => {
    const protectedOthers = { mc3: { 2: TECHNICAL }, mc4: { 2: TECHNICAL }, mc5: { 2: TECHNICAL } };
    const proposal = build(team(), { cells: { mc1: { 3: MISSING }, ...protectedOthers } });

    const decision = find(proposal, "mc2").decision;
    expect(decision.reason).toBe("Elegido: lleva 6 jornadas seguidas convocado sin descansar");
    expect(decision.compare).toContain("mc1 lleva 3");
    expect(decision.criterion).toBe("consecutive");
  });

  it("muestra a los elegibles no elegidos con el motivo de la preferencia", () => {
    const proposal = build(team(), { cells: { mc1: { 3: MISSING } } });

    expect(find(proposal, "mc1").decision).toMatchObject({
      group: "notChosen",
      reason: "Se desconvoca a mc2 en su lugar: lleva más jornadas seguidas convocado (6 frente a 3)",
    });
  });
});

describe("buildDeconvokeProposal — dificultad del rival", () => {
  const ratings = { mc1: rating(9), mc2: rating(3), mc3: rating(9), mc4: rating(9), mc5: rating(9) };

  it("ante un rival difícil sale primero el de menor nivel", () => {
    const proposal = build(team(), { ratings, difficulty: "hard" });

    expect(proposal.selectedIds).toEqual(["mc2"]);
    expect(find(proposal, "mc2").decision.criterion).toBe("rating");
  });

  it("ante un rival medio el nivel sigue desempatando al final: sale el de menor nivel, no el primero de la plantilla", () => {
    const proposal = build(team(), { ratings, difficulty: "medium" });

    expect(proposal.selectedIds).toEqual(["mc2"]);
    expect(find(proposal, "mc2").decision.reason).toBe("Elegido: tiene menor nivel (3): es el último desempate");
  });

  it("sin pronóstico trata al rival como medio", () => {
    const proposal = build(team(), { ratings });

    expect(proposal.selectedIds).toEqual(["mc2"]);
    expect(proposal.rivalDifficulty).toBe("medium");
  });

  it("no propone al jugador de mayor nivel aunque vaya primero en la plantilla", () => {
    const proposal = build(team(), { ratings: { mc1: rating(9), mc2: rating(8), mc3: rating(6), mc4: rating(8), mc5: rating(8) } });

    expect(proposal.selectedIds).toEqual(["mc3"]);
  });
});

describe("buildDeconvokeProposal — posiciones y ya desconvocados", () => {
  // 2 POR, 4 LAT, 3 DFC, 5 MC, 2 banda, 1 DC, Marcos ya desconvocado: quedan 3 laterales.
  function withMarcos(): PlayerResponse[] {
    return [...team(), player("lat4", 3)];
  }

  it("no propone laterales cuando uno ya está desconvocado y quedan justo 3", () => {
    const proposal = build(withMarcos(), { alreadyOutIds: ["lat4"], maxCalledPlayers: 15 });

    expect(proposal.selectedIds.some((id) => id.startsWith("lat"))).toBe(false);
    expect(proposal.alreadyDeconvoked.map((p) => p.playerId)).toEqual(["lat4"]);
  });

  it("los ya desconvocados cuentan para el objetivo", () => {
    const proposal = build(withMarcos(), { alreadyOutIds: ["lat4"], maxCalledPlayers: 14 });

    expect(proposal.calledCount).toBe(16);
    expect(proposal.targetCount).toBe(2);
    expect(proposal.selectedIds).toHaveLength(2);
  });

  it("los jugadores protegidos por la posición explican el mínimo", () => {
    const proposal = build(withMarcos(), { alreadyOutIds: ["lat4"], maxCalledPlayers: 15 });

    const lateral = proposal.players.filter((p) => p.playerId.startsWith("lat"))[0];
    expect(lateral.decision.group).toBe("protected");
    expect(lateral.decision.reason).toBe("Protegido: quedan 3 de 3 laterales disponibles");
  });
});

describe("buildDeconvokeProposal — comparación con todos los elegibles", () => {
  it("compara al propuesto con cada elegible no elegido, con sus valores", () => {
    const protectedOthers = { mc3: { 2: TECHNICAL }, mc4: { 2: TECHNICAL }, mc2: { 2: TECHNICAL } };
    const proposal = build(team(), { cells: { mc1: { 3: MISSING }, ...protectedOthers } });

    const comparison = find(proposal, "mc5").comparison;
    expect(find(proposal, "mc5").decision.group).toBe("proposed");
    expect(comparison.map((row) => row.name)).toContain("mc1");
    expect(comparison.length).toBeGreaterThan(1);
    expect(comparison.find((row) => row.name === "mc1")).toMatchObject({
      verdict: "Decide: jornadas seguidas (6 frente a 3)",
      outcome: "decides",
    });
  });

  it("marca a los que se quedan por el mínimo de su posición", () => {
    const proposal = build(team());

    const comparison = find(proposal, proposal.selectedIds[0]).comparison;
    const lateral = comparison.find((row) => row.name === "lat1");
    expect(lateral).toMatchObject({ outcome: "position" });
    expect(lateral?.verdict).toContain("mínimo de su posición");
  });

  it("los que no son propuestos no llevan comparación", () => {
    const proposal = build(team());

    expect(find(proposal, "gk1").comparison).toEqual([]);
  });

  it("la razón explica contra cuántos elegibles se ha comparado", () => {
    const proposal = build(team());

    expect(find(proposal, proposal.selectedIds[0]).decision.compare).toMatch(/^Frente a los otros \d+ elegibles/);
  });
});

describe("buildDeconvokeProposal — solo cuentan los partidos de liga", () => {
  /** Columns newest first: e0 league, e1 friendly, e2 league, e3 tournament, e4 league, e5 league. */
  const mixed: MatchColumn[] = COLUMNS.map((col, i) => ({ ...col, isLeague: ![1, 3].includes(i) }));

  function buildMixed(cells: Record<string, Record<number, GridCell>>) {
    const players = team();
    const grid = new Map<string, Map<string, GridCell>>();
    mixed.forEach((col, index) => {
      const column = new Map<string, GridCell>();
      for (const p of players) column.set(p.id, cells[p.id]?.[index] ?? CALLED);
      grid.set(col.eventId, column);
    });
    return buildDeconvokeProposal({
      players,
      calledIds: players.map((p) => p.id),
      ratings: {},
      streaks: new Map(),
      technicalTotals: new Map(),
      seasonEvents: [],
      seasonColumns: mixed,
      enrichedGrid: grid,
      seasonStats: [],
      lastInjuryEndMap: new Map(),
      currentDate: "2026-10-21",
      currentEventId: null,
      currentRival: null,
      weekTrainingStats: new Map(),
      weekTrainingCount: 0,
      maxCalledPlayers: 15,
    });
  }

  it("una desconvocatoria técnica en un amistoso no protege", () => {
    const proposal = buildMixed({ mc1: { 1: TECHNICAL } });

    expect(find(proposal, "mc1").decision.group).not.toBe("protected");
  });

  it("las jornadas se cuentan solo con partidos de liga: el amistoso no rompe la racha", () => {
    const proposal = buildMixed({ mc1: { 1: MISSING, 3: MISSING } });

    const detail = find(proposal, "mc1").detail.find((row) => row.rule === "Jornadas seguidas convocado");
    expect(detail?.value).toBe("4");
  });

  it("la ventana de protección cuenta jornadas de liga, no amistosos", () => {
    // Technical deconvocation in league column e2: it is 2 league matchdays ago (e0, e2), not 3 columns.
    const proposal = buildMixed({ mc1: { 2: TECHNICAL } });

    expect(find(proposal, "mc1").decision.reason).toBe("Protegido: desconvocado hace 2 jornadas");
  });

  it("el mínimo de convocatorias no cuenta los partidos que no son de liga", () => {
    const proposal = buildMixed({ mc1: { 1: MISSING, 3: MISSING } });

    expect(find(proposal, "mc1").calledCount).toBe(4);
  });
});
