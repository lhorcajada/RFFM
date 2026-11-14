import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput } from "../deconvokeProposal";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PositionFit } from "../../../../types/positionFit";
import type { FitPosition } from "../../../squad/rating/ratingTraits";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };
const MISSING: GridCell = { statusId: null, excuseTypeId: null, statusName: "", excuseName: null };
const TECHNICAL: GridCell = { statusId: 3, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };

function player(id: string, activePositionId: number): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] };
}

// 16 jugadores y 15 convocables: hay que desconvocar a uno. Los medios centro (mc1, mc2, mc5) tienen margen.
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

function build(
  players: PlayerResponse[],
  options: { cells?: Record<string, Record<number, GridCell>>; positionFit?: PositionFit[] } = {},
) {
  const grid = new Map<string, Map<string, GridCell>>();
  COLUMNS.forEach((col, index) => {
    const column = new Map<string, GridCell>();
    for (const p of players) column.set(p.id, options.cells?.[p.id]?.[index] ?? CALLED);
    grid.set(col.eventId, column);
  });
  const input: BuildProposalInput = {
    players,
    calledIds: players.map((p) => p.id),
    ratings: {},
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
    maxCalledPlayers: 15,
    positionFit: options.positionFit,
  };
  return buildDeconvokeProposal(input);
}

function fitPosition(
  position: FitPosition,
  candidates: Array<[string, number | null]>,
  extra: Partial<PositionFit> = {},
): PositionFit {
  return {
    position,
    confirmedWeekStart: null,
    isManual: false,
    weights: {},
    candidates: candidates.map(([id, fit], index) => ({ teamPlayerId: id, name: id, place: index + 1, fit, trend: "same" })),
    ...extra,
  };
}

const find = (proposal: ReturnType<typeof build>, id: string) => proposal.players.find((p) => p.playerId === id)!;

describe("buildDeconvokeProposal — encaje en el puesto", () => {
  it("desconvoca antes al jugador con peor encaje de su puesto", () => {
    const proposal = build(team(), {
      positionFit: [fitPosition("midfielder", [["mc1", 4.2], ["mc2", 3.8], ["mc5", 2.1]])],
    });

    expect(proposal.selectedIds).toEqual(["mc5"]);
  });

  it("sin encaje decide la equidad como antes", () => {
    const baseline = build(team());
    const withoutData = build(team(), { positionFit: [fitPosition("midfielder", [["mc1", null], ["mc2", null], ["mc5", null]])] });

    expect(withoutData.selectedIds).toEqual(baseline.selectedIds);
  });

  it("un orden confirmado se usa aunque no haya encaje calculado", () => {
    const proposal = build(team(), {
      positionFit: [
        fitPosition("midfielder", [["mc1", null], ["mc2", null], ["mc5", null]], { confirmedWeekStart: "2026-10-19T00:00:00", isManual: true }),
      ],
    });

    expect(proposal.selectedIds).toEqual(["mc5"]);
  });

  it("no propone a un protegido aunque tenga el peor encaje", () => {
    const proposal = build(team(), {
      cells: { mc5: { 2: TECHNICAL } },
      positionFit: [fitPosition("midfielder", [["mc1", 4.2], ["mc2", 3.8], ["mc5", 2.1]])],
    });

    expect(proposal.selectedIds).not.toContain("mc5");
    expect(find(proposal, "mc5").decision.group).toBe("protected");
    expect(proposal.selectedIds).toEqual(["mc2"]);
  });

  it("solo cuentan los candidatos convocados al calcular el lugar", () => {
    const proposal = build(team(), {
      positionFit: [fitPosition("midfielder", [["mc1", 4.2], ["ghost", 4.0], ["mc2", 3.8], ["mc5", 2.1]])],
    });

    expect(proposal.selectedIds).toEqual(["mc5"]);
    expect(find(proposal, "mc5").decision.reason).toContain("3.º de 3 en Mediocentro");
  });

  it("un puesto con un solo candidato es neutro", () => {
    const baseline = build(team());
    const proposal = build(team(), { positionFit: [fitPosition("forward", [["dc", 1.0]])] });

    expect(proposal.selectedIds).toEqual(baseline.selectedIds);
  });

  it("con el mismo lugar relativo en dos puestos desempata la equidad", () => {
    const proposal = build(team(), {
      cells: { dfc3: { 0: MISSING } },
      positionFit: [
        fitPosition("centerBack", [["dfc1", 4.0], ["dfc2", 3.0], ["dfc3", 2.0]]),
        fitPosition("midfielder", [["mc1", 4.0], ["mc2", 3.0], ["mc5", 2.0]]),
      ],
    });

    // dfc3 se perdió la última jornada (0 seguidas); mc5 lleva 6 seguidas: decide la equidad.
    expect(proposal.selectedIds).toEqual(["mc5"]);
  });

  it("la tarjeta indica el puesto, el lugar y el encaje del jugador propuesto", () => {
    const proposal = build(team(), {
      positionFit: [fitPosition("midfielder", [["mc1", 4.2], ["mc2", 3.8], ["mc5", 2.1]])],
    });

    const mc5 = find(proposal, "mc5");
    expect(mc5.decision.criterion).toBe("fit");
    expect(mc5.decision.reason).toContain("3.º de 3 en Mediocentro (2,1)");
    expect(mc5.detail).toContainEqual({
      rule: "Encaje en el puesto",
      value: "3.º de 3 en Mediocentro (2,1)",
      result: "decides",
    });
  });

  it("explica por qué se mantiene al jugador con mejor encaje", () => {
    const proposal = build(team(), {
      positionFit: [fitPosition("midfielder", [["mc1", 4.2], ["mc2", 3.8], ["mc5", 2.1]])],
    });

    expect(find(proposal, "mc1").decision.reason).toContain("peor encaje en su puesto");
  });

  it("sin orden de encaje para el puesto del jugador la fila de detalle no tiene efecto", () => {
    const proposal = build(team());

    expect(find(proposal, "mc1").detail).toContainEqual({
      rule: "Encaje en el puesto",
      value: "Sin orden de encaje para su puesto",
      result: "noEffect",
    });
  });
});
