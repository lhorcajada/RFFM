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

const MIDFIELD_FIT = [fitPosition("midfielder", [["mc1", 4.2], ["mc2", 3.8], ["mc5", 2.1]])];

describe("buildDeconvokeProposal — orden de desconvocatoria", () => {
  it("numera a los elegibles de 1 a N sin repetir a nadie", () => {
    const { order } = build(team(), { positionFit: MIDFIELD_FIT });

    expect(order.map((entry) => entry.rank)).toEqual(order.map((_, index) => index + 1));
    expect(new Set(order.map((entry) => entry.playerId)).size).toBe(order.length);
  });

  it("no incluye a los porteros bloqueados ni a los protegidos", () => {
    const { order } = build(team(), { cells: { mc5: { 2: TECHNICAL } }, positionFit: MIDFIELD_FIT });
    const ids = order.map((entry) => entry.playerId);

    expect(ids).not.toContain("gk1");
    expect(ids).not.toContain("mc5");
  });

  it("el propuesto va el primero y los demás se quedan tras la línea de corte", () => {
    const proposal = build(team(), { positionFit: MIDFIELD_FIT });

    expect(proposal.order[0]).toMatchObject({ playerId: "mc5", outcome: "proposed" });
    expect(proposal.order.slice(1).every((entry) => entry.outcome !== "proposed")).toBe(true);
  });

  it("cada jugador explica por qué va antes que el siguiente de la lista", () => {
    const { order } = build(team(), { positionFit: MIDFIELD_FIT });

    order.slice(0, -1).forEach((entry, index) => {
      expect(entry.versusNext?.nextName).toBe(order[index + 1].name);
      expect(entry.versusNext?.text).toMatch(/^Va antes que .+: .+/);
    });
  });

  it("el último de la lista no se compara con nadie", () => {
    const { order } = build(team(), { positionFit: MIDFIELD_FIT });

    expect(order[order.length - 1].versusNext).toBeNull();
  });

  it("cuando decide el encaje cita las notas de rasgos", () => {
    const { order } = build(team(), { positionFit: MIDFIELD_FIT });
    const fitDecided = order.find((entry) => entry.versusNext?.criterion === "fit");

    expect(fitDecided?.versusNext?.text).toContain("encaje por rasgos");
    expect(fitDecided?.versusNext?.text).toMatch(/\d,\d como /);
  });

  it("los criterios de cada jugador son visibles, incluida la nota de encaje", () => {
    const { order } = build(team(), { positionFit: MIDFIELD_FIT });
    const mc5 = order.find((entry) => entry.playerId === "mc5")!;

    expect(mc5.chips).toContain("Encaje 2,1");
    expect(mc5.chips.some((chip) => /seguidas/.test(chip))).toBe(true);
  });

  it("un empate total lo dice y remite a la plantilla", () => {
    const { order } = build(team());
    const tie = order.find((entry) => entry.versusNext?.criterion === null);

    if (tie) expect(tie.versusNext?.text).toMatch(/^Va antes que .+: empatan en todos los criterios/);
  });

  it("la razón del propuesto cita su puesto en el orden", () => {
    const proposal = build(team(), { positionFit: MIDFIELD_FIT });

    expect(find(proposal, "mc5").decision.compare).toMatch(/^1\.º del orden de desconvocatoria/);
  });
});
