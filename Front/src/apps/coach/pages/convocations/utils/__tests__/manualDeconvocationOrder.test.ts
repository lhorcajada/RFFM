import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput, type DeconvokeProposal } from "../deconvokeProposal";
import { applyManualOrder, manualOrderIdsOf } from "../manualDeconvocationOrder";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PlayerRating } from "../../../../types/playerRating";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };
const TECHNICAL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };

function player(id: string, activePositionId: number): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] };
}

// 2 POR, 3 LAT, 4 DFC, 5 MC, 4 banda, 3 DC = 21 convocables (3 de más sobre 18).
const PLAYERS: PlayerResponse[] = [
  player("gk1", 1), player("gk2", 1),
  player("lat1", 2), player("lat2", 3), player("lat3", 2),
  player("dfc1", 4), player("dfc2", 4), player("dfc3", 5), player("dfc4", 4),
  player("mc1", 6), player("mc2", 6), player("mc3", 7), player("mc4", 8), player("mc5", 6),
  player("b1", 13), player("b2", 14), player("b3", 13), player("b4", 14),
  player("dc1", 11), player("dc2", 11), player("dc3", 11),
];

const COLUMNS: MatchColumn[] = Array.from({ length: 4 }, (_, i) => ({
  eventId: `e${i}`,
  label: `J${4 - i}`,
  date: `2026-10-${String(20 - i).padStart(2, "0")}`,
  rival: null,
}));

function rating(level: number): PlayerRating {
  return { competitiveness: level, physical: level, tactical: level, technical: level } as PlayerRating;
}

function build(options: { recentlyDeconvoked?: string[]; players?: PlayerResponse[]; maxCalled?: number } = {}): DeconvokeProposal {
  const players = options.players ?? PLAYERS;
  const grid = new Map<string, Map<string, GridCell>>();
  COLUMNS.forEach((col, index) =>
    grid.set(
      col.eventId,
      new Map(players.map((p) => [p.id, index === 0 && options.recentlyDeconvoked?.includes(p.id) ? TECHNICAL : CALLED])),
    ),
  );
  const input: BuildProposalInput = {
    players,
    calledIds: players.map((p) => p.id),
    ratings: Object.fromEntries(players.map((p) => [p.id, rating(5)])),
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
    protectionWindows: { technical: 5, injuryRest: 1, otherCause: 0 },
  };
  return buildDeconvokeProposal(input);
}

const names = (proposal: DeconvokeProposal) => proposal.order.map((o) => o.playerId);

describe("applyManualOrder", () => {
  it("sin cambios de orden devuelve la misma selección que la propuesta", () => {
    const proposal = build();

    const result = applyManualOrder(proposal, manualOrderIdsOf(proposal), { players: PLAYERS });

    expect([...result.selectedIds].sort()).toEqual([...proposal.selectedIds].sort());
  });

  it("al subir a un jugador por encima de la línea de corte, sale él y se queda el que se desplaza", () => {
    const proposal = build();
    const ids = manualOrderIdsOf(proposal);
    const lastEligible = ids.filter((id) => !proposal.selectedIds.includes(id))[0];
    const displaced = proposal.selectedIds[proposal.selectedIds.length - 1];

    const result = applyManualOrder(proposal, [lastEligible, ...ids.filter((id) => id !== lastEligible)], { players: PLAYERS });

    expect(result.selectedIds).toContain(lastEligible);
    expect(result.selectedIds).toHaveLength(proposal.selectedIds.length);
    expect(result.selectedIds.length).toBe(proposal.targetCount);
    expect(result.selectedIds).not.toContain(displaced);
  });

  it("renumera el orden y marca los que salen y los que se quedan", () => {
    const proposal = build();
    const ids = manualOrderIdsOf(proposal);
    const reversed = [...ids].reverse();

    const result = applyManualOrder(proposal, reversed, { players: PLAYERS });

    expect(result.order.map((o) => o.rank)).toEqual(result.order.map((_, i) => i + 1));
    expect(result.order[0].playerId).toBe(reversed[0]);
    expect(result.order.filter((o) => o.outcome === "proposed")).toHaveLength(proposal.targetCount);
    expect(result.order.slice(0, proposal.targetCount).every((o) => o.outcome === "proposed")).toBe(true);
  });

  it("la decisión de quien entra explica que la tomó el entrenador y el que sale de la propuesta queda como no elegido", () => {
    const proposal = build();
    const ids = manualOrderIdsOf(proposal);
    const lastEligible = ids.filter((id) => !proposal.selectedIds.includes(id))[0];
    const displaced = proposal.selectedIds[proposal.selectedIds.length - 1];

    const result = applyManualOrder(proposal, [lastEligible, ...ids.filter((id) => id !== lastEligible)], { players: PLAYERS });

    const entering = result.players.find((p) => p.playerId === lastEligible)!;
    const leaving = result.players.find((p) => p.playerId === displaced)!;
    expect(entering.decision.group).toBe("proposed");
    expect(entering.decision.reason).toMatch(/orden manual/);
    expect(entering.isSelected).toBe(true);
    expect(leaving.decision.group).toBe("notChosen");
    expect(leaving.isSelected).toBe(false);
  });

  it("marca la propuesta como manual y deja los avisos vacíos si todo se respeta", () => {
    const proposal = build();

    const result = applyManualOrder(proposal, manualOrderIdsOf(proposal), { players: PLAYERS });

    expect(result.isManual).toBe(true);
    expect(result.manualWarnings).toEqual([]);
  });

  it("avisa, pero deja hacerlo, si se elige a un protegido", () => {
    const proposal = build({ recentlyDeconvoked: ["mc1"] });
    const ids = manualOrderIdsOf(proposal);
    expect(ids).toContain("mc1");

    const result = applyManualOrder(proposal, ["mc1", ...ids.filter((id) => id !== "mc1")], { players: PLAYERS });

    expect(result.selectedIds).toContain("mc1");
    expect(result.manualWarnings.some((w) => w.includes("mc1") && /protegido/i.test(w))).toBe(true);
  });

  it("los protegidos aparecen al final del orden manual por defecto", () => {
    const proposal = build({ recentlyDeconvoked: ["mc1"] });

    const ids = manualOrderIdsOf(proposal);

    expect(ids[ids.length - 1]).toBe("mc1");
    expect(names(proposal)).not.toContain("mc1");
  });

  it("recalcula los mínimos por posición con la selección manual", () => {
    const proposal = build({ players: PLAYERS.filter((p) => p.id !== "dc3"), maxCalled: 17 });
    const ids = manualOrderIdsOf(proposal);
    const forwardsFirst = ["dc1", "dc2", ...ids.filter((id) => id !== "dc1" && id !== "dc2")];

    const result = applyManualOrder(proposal, forwardsFirst, { players: PLAYERS.filter((p) => p.id !== "dc3") });

    expect(result.selectedIds).toEqual(expect.arrayContaining(["dc1", "dc2"]));
    expect(result.positionWarnings.length).toBeGreaterThan(0);
  });

  it("ignora los ids desconocidos y añade al final los que faltan en el orden", () => {
    const proposal = build();
    const ids = manualOrderIdsOf(proposal);

    const result = applyManualOrder(proposal, ["desconocido", ids[2]], { players: PLAYERS });

    expect(result.order[0].playerId).toBe(ids[2]);
    expect(result.order).toHaveLength(ids.length);
  });

  it("no cambia la propuesta original", () => {
    const proposal = build();
    const before = [...proposal.selectedIds];

    applyManualOrder(proposal, [...manualOrderIdsOf(proposal)].reverse(), { players: PLAYERS });

    expect(proposal.selectedIds).toEqual(before);
    expect(proposal.isManual).toBeUndefined();
  });
});
