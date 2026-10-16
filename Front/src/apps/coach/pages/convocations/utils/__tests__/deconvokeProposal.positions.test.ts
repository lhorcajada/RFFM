import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, selectDeconvocations, type BuildProposalInput } from "../deconvokeProposal";
import type { PositionPlayer, PositionRole } from "../positionRequirements";
import type { PlayerResponse } from "../../../../services/teamplayerService";

type Candidate = { playerId: string; forced: boolean };

function squad(entries: Array<[string, PositionRole | null, PositionRole[]?]>): Map<string, PositionPlayer> {
  return new Map(entries.map(([id, role, possibleRoles = []]) => [id, { id, role, possibleRoles }]));
}

function ordered(ids: string[], forced: string[] = []): Candidate[] {
  return ids.map((playerId) => ({ playerId, forced: forced.includes(playerId) }));
}

// 22 convocados: 2 POR, 2 LAT, 4 DFC, 4 MC, 2 MCO, 5 banda, 3 DC.
const BASE: Array<[string, PositionRole | null, PositionRole[]?]> = [
  ["gk1", "goalkeeper"], ["gk2", "goalkeeper"],
  ["lat1", "fullBack"], ["lat2", "fullBack"],
  ["dfc1", "centreBack"], ["dfc2", "centreBack"], ["dfc3", "centreBack"], ["dfc4", "centreBack"],
  ["mc1", "centralMid"], ["mc2", "centralMid"], ["mc3", "centralMid"], ["mc4", "centralMid"],
  ["mco1", "attackingMid"], ["mco2", "attackingMid"],
  ["b1", "wide"], ["b2", "wide"], ["b3", "wide"], ["b4", "wide"], ["b5", "wide"],
  ["dc1", "forward"], ["dc2", "forward"], ["dc3", "forward"],
];

describe("selectDeconvocations", () => {
  it("con cuatro defensas entre las puntuaciones más bajas solo propone el central que sobra", () => {
    const players = squad(BASE);
    const order = ordered([
      "dfc1", "dfc2", "lat1", "dfc3", "mc1", "b1", "dc1", "mco1",
      ...BASE.map(([id]) => id).filter((id) => !["dfc1", "dfc2", "lat1", "dfc3", "mc1", "b1", "dc1", "mco1"].includes(id)),
    ]);

    const result = selectDeconvocations(order, players, 4);

    expect(result.selectedIds).toEqual(["dfc1", "mc1", "b1", "dc1"]);
    expect(result.protectedBy.get("dfc2")).toBe("centreBack");
    expect(result.protectedBy.get("lat1")).toBe("fullBack");
    expect(result.shortfalls).toEqual([]);
  });

  it("dentro de una línea con margen propone al de menor puntuación", () => {
    const players = squad(BASE);
    const order = ordered(["mc3", "mc1", ...BASE.map(([id]) => id).filter((id) => id !== "mc3" && id !== "mc1")]);

    expect(selectDeconvocations(order, players, 1).selectedIds).toEqual(["mc3"]);
  });

  it("con un solo delantero protege al mediapunta que puede jugar de delantero", () => {
    const entries = BASE.filter(([id]) => id !== "dc2" && id !== "dc3" && id !== "mco1" && id !== "mco2");
    entries.push(["mcoDc", "attackingMid", ["attackingMid", "forward"]], ["mco3", "attackingMid"]);
    const players = squad(entries);
    const order = ordered(["mcoDc", "mco3", ...entries.map(([id]) => id).filter((id) => id !== "mcoDc" && id !== "mco3")]);

    const result = selectDeconvocations(order, players, 1);

    expect(result.selectedIds).not.toContain("mcoDc");
    expect(result.protectedBy.get("mcoDc")).toBe("forwardCover");
  });

  it("con cuatro de banda y nadie más que pueda jugar en banda no propone ninguno de banda", () => {
    const entries = BASE.filter(([id]) => id !== "b5");
    const players = squad(entries);
    const order = ordered(["b1", "b2", "b3", "b4", "mc1", ...entries.map(([id]) => id).filter((id) => !/^b\d$/.test(id) && id !== "mc1")]);

    const result = selectDeconvocations(order, players, 1);

    expect(result.selectedIds).toEqual(["mc1"]);
    expect(result.protectedBy.get("b1")).toBe("wideCover");
  });

  it("los obligatorios se proponen aunque rompan un mínimo y se avisa", () => {
    const entries = BASE.filter(([id]) => id !== "dfc4");
    const players = squad(entries);
    const order = ordered(["dfc1", ...entries.map(([id]) => id).filter((id) => id !== "dfc1")], ["dfc1"]);

    const result = selectDeconvocations(order, players, 1);

    expect(result.selectedIds).toEqual(["dfc1"]);
    expect(result.shortfalls).toEqual([
      { requirement: "centreBack", label: "Centrales", required: 3, remaining: 2 },
    ]);
  });

  it("si los mínimos no permiten llegar al objetivo, propone los de menor puntuación y avisa", () => {
    const entries: Array<[string, PositionRole | null, PositionRole[]?]> = [
      ["gk1", "goalkeeper"],
      ["lat1", "fullBack"], ["lat2", "fullBack"],
      ["dfc1", "centreBack"], ["dfc2", "centreBack"], ["dfc3", "centreBack"],
    ];
    const players = squad(entries);
    const order = ordered(["dfc1", "lat1", "gk1", "lat2", "dfc2", "dfc3"]);

    const result = selectDeconvocations(order, players, 2);

    expect(result.selectedIds).toEqual(["dfc1", "lat1"]);
    expect(result.shortfalls.map((s) => s.requirement)).toEqual(
      expect.arrayContaining(["fullBack", "centreBack"]),
    );
    expect(result.protectedBy.has("dfc1")).toBe(false);
  });

  it("no propone a un lateral sano aunque un central polivalente pudiera cubrirlo", () => {
    // 2 LD + 2 LI; un LD lesionado y un LI con faltas son obligatorios. Queda justo un LD y un LI.
    const entries = BASE.filter(([id]) => id !== "lat1" && id !== "lat2");
    entries.push(
      ["ld1", "fullBack"], ["ld2", "fullBack"], ["li1", "fullBack"], ["li2", "fullBack"],
      ["dfcLd", "centreBack", ["centreBack", "fullBack"]],
    );
    const players = squad(entries);
    const rest = entries.map(([id]) => id).filter((id) => !["ld1", "li1", "ld2", "b1"].includes(id));
    const order = ordered(["ld1", "li1", "ld2", "b1", ...rest], ["ld1", "li1"]);

    const result = selectDeconvocations(order, players, 3);

    expect(result.selectedIds).toEqual(["ld1", "li1", "b1"]);
    expect(result.protectedBy.get("ld2")).toBe("fullBack");
  });

  it("el central polivalente cubre de lateral cuando faltan laterales por obligatorios", () => {
    const entries = [...BASE];
    entries.push(["dfcLd", "centreBack", ["centreBack", "fullBack"]]);
    const players = squad(entries);
    const order = ordered(["lat1", ...entries.map(([id]) => id).filter((id) => id !== "lat1")], ["lat1"]);

    const result = selectDeconvocations(order, players, 1);

    expect(result.selectedIds).toEqual(["lat1"]);
    expect(result.shortfalls).toEqual([]);
  });

  it("mantiene al menos un portero", () => {
    const players = squad(BASE);
    const order = ordered(["gk1", "gk2", ...BASE.map(([id]) => id).filter((id) => !id.startsWith("gk"))]);

    const result = selectDeconvocations(order, players, 2);

    expect(result.selectedIds).toContain("gk1");
    expect(result.selectedIds).not.toContain("gk2");
    expect(result.protectedBy.get("gk2")).toBe("goalkeeper");
  });
});

function player(id: string, activePositionId: number | null, extra: Partial<PlayerResponse> = {}): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: activePositionId ? [activePositionId] : [], ...extra };
}

function input(players: PlayerResponse[], maxCalledPlayers: number): BuildProposalInput {
  return {
    players,
    calledIds: players.map((p) => p.id),
    ratings: {},
    streaks: new Map(),
    technicalTotals: new Map(),
    seasonEvents: [],
    seasonColumns: [],
    enrichedGrid: new Map(),
    seasonStats: [],
    lastInjuryEndMap: new Map(),
    currentDate: "2026-10-14",
    currentEventId: null,
    currentRival: null,
    weekTrainingStats: new Map(),
    weekTrainingCount: 0,
    maxCalledPlayers,
  };
}

// 1 POR, 2 LAT, 3 DFC, 3 MC, 1 MCO, 4 banda, 2 DC
function fullTeam(): PlayerResponse[] {
  return [
    player("gk", 1),
    player("li", 2), player("ld", 3),
    player("dfc1", 4), player("dfc2", 4), player("lib", 5),
    player("mc1", 6), player("mc2", 6), player("mcd", 7),
    player("mco", 8),
    player("mi", 9), player("md", 10), player("ei", 13), player("ed", 14),
    player("dc", 11), player("sd", 12),
  ];
}

describe("buildDeconvokeProposal con posiciones", () => {
  it("indica el rol de cada jugador", () => {
    const team = [...fullTeam(), player("sin", null)];
    const proposal = buildDeconvokeProposal(input(team, 30));

    const roleOf = (id: string) => proposal.players.find((p) => p.playerId === id)?.positionRole;
    expect(roleOf("lib")).toBe("centreBack");
    expect(roleOf("ed")).toBe("wide");
    expect(roleOf("sin")).toBeNull();
  });

  it("propone al central lesionado aunque solo haya 3 y avisa", () => {
    const team = fullTeam().map((p) => (p.id === "dfc1" ? { ...p, isInjured: true } : p));
    const proposal = buildDeconvokeProposal(input(team, 30));

    expect(proposal.selectedIds).toEqual(["dfc1"]);
    expect(proposal.positionWarnings.map((w) => w.label)).toEqual(["Centrales"]);
  });

  it("sin mínimos rotos no hay avisos", () => {
    const proposal = buildDeconvokeProposal(input(fullTeam(), 30));
    expect(proposal.positionWarnings).toEqual([]);
  });

  // Sin datos, todos tienen la misma puntuación y se recorren en el orden de convocatoria:
  // el portero va primero, pero el único que puede salir sin romper un mínimo es el medio centro sobrante.
  it("mantiene al portero con su motivo y propone al medio centro sobrante", () => {
    const team = [...fullTeam(), player("mc3", 6)];
    const proposal = buildDeconvokeProposal(input(team, 16));

    expect(proposal.selectedIds).toEqual(["mc1"]);
    const gk = proposal.players.find((p) => p.playerId === "gk")!;
    expect(gk.factors.find((f) => f.key === "goalkeeperAlwaysCalled")?.label).toBe(
      "Portero: siempre convocado salvo lesión o sanción",
    );
  });
});
