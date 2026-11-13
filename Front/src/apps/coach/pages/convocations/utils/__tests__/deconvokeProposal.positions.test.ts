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

// 23 convocados: 2 POR, 3 LAT, 4 DFC, 6 MC (2 ofensivos), 5 banda, 3 DC.
const BASE: Array<[string, PositionRole | null, PositionRole[]?]> = [
  ["gk1", "goalkeeper"], ["gk2", "goalkeeper"],
  ["lat1", "fullBack"], ["lat2", "fullBack"], ["lat3", "fullBack"],
  ["dfc1", "centreBack"], ["dfc2", "centreBack"], ["dfc3", "centreBack"], ["dfc4", "centreBack"],
  ["mc1", "centralMid"], ["mc2", "centralMid"], ["mc3", "centralMid"], ["mc4", "centralMid"],
  ["mco1", "centralMid"], ["mco2", "centralMid"],
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

  it("un lateral polivalente compensa a dos centrales desconvocados si su línea conserva el mínimo", () => {
    const entries = BASE.filter(([id]) => id !== "lat3");
    entries.push(["lat3", "fullBack", ["fullBack", "centreBack"]], ["lat4", "fullBack"]);
    const players = squad(entries);
    const order = ordered(["dfc1", "dfc2", ...entries.map(([id]) => id).filter((id) => id !== "dfc1" && id !== "dfc2")]);

    const result = selectDeconvocations(order, players, 2);

    expect(result.selectedIds).toEqual(["dfc1", "dfc2"]);
    expect(result.shortfalls).toEqual([]);
  });

  it("el polivalente no compensa si su propia línea quedaría por debajo del mínimo", () => {
    const entries = BASE.filter(([id]) => id !== "lat3");
    entries.push(["lat3", "fullBack", ["fullBack", "centreBack"]]);
    const players = squad(entries);
    const order = ordered(["dfc1", "dfc2", ...entries.map(([id]) => id).filter((id) => id !== "dfc1" && id !== "dfc2")]);

    const result = selectDeconvocations(order, players, 2);

    expect(result.selectedIds).toContain("dfc1");
    expect(result.selectedIds).not.toContain("dfc2");
    expect(result.protectedBy.get("dfc2")).toBe("centreBack");
  });

  it("con dos de banda no propone ninguno de banda", () => {
    const entries = BASE.filter(([id]) => !/^b[345]$/.test(id));
    const players = squad(entries);
    const order = ordered(["b1", "b2", "mc1", ...entries.map(([id]) => id).filter((id) => !/^b\d$/.test(id) && id !== "mc1")]);

    const result = selectDeconvocations(order, players, 1);

    expect(result.selectedIds).toEqual(["mc1"]);
    expect(result.protectedBy.get("b1")).toBe("wide");
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

  it("no propone a un lateral sano si ni con un central polivalente se llega al mínimo", () => {
    // 2 LD + 2 LI; un LD lesionado y un LI con faltas son obligatorios. Queda justo un LD y un LI.
    const entries = BASE.filter(([id]) => !id.startsWith("lat"));
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

  it("mantiene al menos dos porteros", () => {
    const players = squad(BASE);
    const order = ordered(["gk1", "gk2", ...BASE.map(([id]) => id).filter((id) => !id.startsWith("gk"))]);

    const result = selectDeconvocations(order, players, 2);

    expect(result.selectedIds).not.toContain("gk1");
    expect(result.selectedIds).not.toContain("gk2");
    expect(result.protectedBy.get("gk1")).toBe("goalkeeper");
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

// 2 POR, 3 LAT, 3 DFC, 3 MC, 1 MCO, 4 banda, 2 DC
function fullTeam(): PlayerResponse[] {
  return [
    player("gk", 1), player("gk2", 1),
    player("li", 2), player("ld", 3), player("lat3", 2),
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
    const proposal = buildDeconvokeProposal(input(team, 18));

    expect(proposal.selectedIds).toEqual(["mc1"]);
    const gk = proposal.players.find((p) => p.playerId === "gk")!;
    expect(gk.factors.find((f) => f.key === "goalkeeperAlwaysCalled")?.label).toBe(
      "Portero: siempre convocado salvo lesión, sanción o no disponibilidad",
    );
  });
});


describe("buildDeconvokeProposal con jugadores ya desconvocados", () => {
  function p(id: string, activePositionId: number): PlayerResponse {
    return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] } as PlayerResponse;
  }

  // 2 POR, 3 LAT, 3 DFC, 7 MC (uno ofensivo), 4 banda, 2 DC = 21
  function team(): PlayerResponse[] {
    return [
      p("gk", 1), p("gk2", 1), p("li", 2), p("ld", 3), p("lat3", 2),
      p("dfc1", 4), p("dfc2", 4), p("lib", 5),
      p("mc1", 6), p("mc2", 6), p("mc3", 6), p("mc4", 7), p("mc5", 7), p("mc6", 7),
      p("mco", 8),
      p("mi", 9), p("md", 10), p("ei", 13), p("ed", 14),
      p("dc", 11), p("sd", 12),
    ];
  }

  function build(alreadyOutIds: string[], maxCalledPlayers: number, extra: PlayerResponse[] = []) {
    const players = [...team(), ...extra];
    const input: BuildProposalInput = {
      players,
      calledIds: players.map((x) => x.id),
      ratings: {},
      streaks: new Map(),
      technicalTotals: new Map(),
      seasonEvents: [],
      seasonColumns: [],
      enrichedGrid: new Map(),
      seasonStats: [],
      lastInjuryEndMap: new Map(),
      currentDate: "2026-10-16",
      currentEventId: null,
      currentRival: null,
      weekTrainingStats: new Map(),
      weekTrainingCount: 0,
      maxCalledPlayers,
      alreadyOutIds: new Set(alreadyOutIds),
    };
    return buildDeconvokeProposal(input);
  }

  it("el objetivo se calcula sobre los disponibles", () => {
    const proposal = build(["mc1", "mc2", "mc3"], 16);

    expect(proposal.calledCount).toBe(18);
    expect(proposal.targetCount).toBe(2);
  });

  it("no vuelve a proponer a los que ya están desconvocados", () => {
    const proposal = build(["mc1", "mc2", "mc3"], 14);

    expect(proposal.players.map((x) => x.playerId)).not.toContain("mc1");
    expect(proposal.selectedIds.filter((id) => ["mc1", "mc2", "mc3"].includes(id))).toEqual([]);
  });

  it("los ya fuera no cuentan para los mínimos: los cuatro medios centro restantes quedan protegidos", () => {
    const proposal = build(["mc1", "mc2", "mc3"], 15);

    const mc4 = proposal.players.find((x) => x.playerId === "mc4")!;
    expect(proposal.selectedIds).not.toContain("mc4");
    expect(mc4.factors.find((f) => f.key === "positionProtection")).toMatchObject({
      label: "Protegido: quedan 4 de 4 medios centro disponibles",
      value: 4,
    });
  });

  it("avisa cuando los ya fuera dejan una posición por debajo del mínimo", () => {
    const proposal = build(["dfc1"], 30);

    expect(proposal.positionWarnings.map((w) => `${w.label}: quedan ${w.remaining} de ${w.required}`)).toEqual([
      "Centrales: quedan 2 de 3",
    ]);
  });

  it("sin ya fuera conserva el comportamiento anterior", () => {
    const proposal = build([], 19);

    expect(proposal.calledCount).toBe(21);
    expect(proposal.targetCount).toBe(2);
  });

  function buildSquad(players: PlayerResponse[], alreadyOutIds: string[], maxCalledPlayers: number) {
    return buildDeconvokeProposal({
      players,
      calledIds: players.map((x) => x.id),
      ratings: {},
      streaks: new Map(),
      technicalTotals: new Map(),
      seasonEvents: [],
      seasonColumns: [],
      enrichedGrid: new Map(),
      seasonStats: [],
      lastInjuryEndMap: new Map(),
      currentDate: "2026-10-16",
      currentEventId: null,
      currentRival: null,
      weekTrainingStats: new Map(),
      weekTrainingCount: 0,
      maxCalledPlayers,
      alreadyOutIds: new Set(alreadyOutIds),
    });
  }

  it("devuelve cada ya desconvocado en orden de plantilla, sea cual sea su motivo, con su nombre y rol", () => {
    const ana = { ...p("ana", 4), alias: "", name: "Iker", lastName: "Ruiz" };
    const proposal = build(["mc3", "gk", "ana"], 18, [ana]);

    expect(proposal.alreadyDeconvoked).toEqual([
      { playerId: "gk", displayName: "gk", position: null, positionRole: "goalkeeper" },
      { playerId: "mc3", displayName: "mc3", position: null, positionRole: "centralMid" },
      { playerId: "ana", displayName: "Iker Ruiz", position: null, positionRole: "centreBack" },
    ]);
  });

  it("no devuelve como ya desconvocados a los que siguen pendientes", () => {
    const proposal = build(["mc1"], 18);

    expect(proposal.alreadyDeconvoked.map((x) => x.playerId)).toEqual(["mc1"]);
  });

  it("sin ya fuera, la lista de ya desconvocados está vacía", () => {
    expect(build([], 17).alreadyDeconvoked).toEqual([]);
  });

  it("nunca vuelve a proponer a los ya fuera ni los cuenta como disponibles para el objetivo", () => {
    const extra = [p("dc3", 11), p("mc7", 6), p("mc8", 6), p("mc9", 6), p("dfc3", 4), p("lat2", 2)];
    const proposal = build(["mc1", "mc2", "mc3"], 18, extra);

    expect(proposal.players.map((x) => x.playerId)).not.toEqual(expect.arrayContaining(["mc1", "mc2", "mc3"]));
    expect(proposal.selectedIds.filter((id) => ["mc1", "mc2", "mc3"].includes(id))).toEqual([]);
    expect(proposal.calledCount).toBe(24);
    expect(proposal.targetCount).toBe(6);
  });

  it("los ya fuera siguen restando del mínimo de su posición", () => {
    const proposal = build(["dfc1", "dfc2"], 30, [p("dfc3", 4)]);

    expect(proposal.positionWarnings.map((w) => `${w.label}: quedan ${w.remaining} de ${w.required}`)).toEqual([
      "Centrales: quedan 2 de 3",
    ]);
    expect(proposal.calledCount).toBe(20);
  });

  it("los ya fuera no alteran los scores ni la selección de los demás", () => {
    const withOut = build(["mc1", "mc2", "mc3"], 14);
    const removedBeforehand = buildSquad(
      team().filter((x) => !["mc1", "mc2", "mc3"].includes(x.id)),
      [],
      14,
    );

    expect(withOut.selectedIds).toEqual(removedBeforehand.selectedIds);
    expect(withOut.players.map((x) => [x.playerId, x.score])).toEqual(
      removedBeforehand.players.map((x) => [x.playerId, x.score]),
    );
  });
});
