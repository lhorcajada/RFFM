import { describe, expect, it } from "vitest";
import { selectDeconvocations } from "../deconvokeProposal";
import type { PositionPlayer, PositionRole } from "../positionRequirements";

type Entry = [string, PositionRole | null, PositionRole[]?];

const squad = (entries: Entry[]): Map<string, PositionPlayer> =>
  new Map(entries.map(([id, role, possibleRoles = []]) => [id, { id, role, possibleRoles }]));
const ordered = (ids: string[], forced: string[] = []) => ids.map((playerId) => ({ playerId, forced: forced.includes(playerId) }));

// 2 POR, 4 LAT, 5 DFC, 6 MC, 5 banda, 4 DC: margen de sobra en cada línea.
const BASE: Entry[] = [
  ["gk1", "goalkeeper"], ["gk2", "goalkeeper"],
  ["lat1", "fullBack"], ["lat2", "fullBack"], ["lat3", "fullBack"], ["lat4", "fullBack"],
  ["dfc1", "centreBack"], ["dfc2", "centreBack"], ["dfc3", "centreBack"], ["dfc4", "centreBack"], ["dfc5", "centreBack"],
  ["mc1", "centralMid"], ["mc2", "centralMid"], ["mc3", "centralMid"], ["mc4", "centralMid"], ["mc5", "centralMid"], ["mc6", "centralMid"],
  ["b1", "wide"], ["b2", "wide"], ["b3", "wide"], ["b4", "wide"], ["b5", "wide"],
  ["dc1", "forward"], ["dc2", "forward"], ["dc3", "forward"], ["dc4", "forward"],
];
const ids = BASE.map(([id]) => id);
const rest = (first: string[]) => [...first, ...ids.filter((id) => !first.includes(id))];

describe("selectDeconvocations — reparto entre líneas", () => {
  const spread = { spreadLines: true };

  it("no quita a un central y a un lateral a la vez si hay alternativa en otra línea", () => {
    const result = selectDeconvocations(ordered(rest(["dfc1", "lat1", "mc1"])), squad(BASE), 2, undefined, spread);

    expect(result.selectedIds).toEqual(["dfc1", "mc1"]);
  });

  it("no quita a dos medios centro (ni a un medio centro y un mediapunta) si hay alternativa", () => {
    const result = selectDeconvocations(ordered(rest(["mc1", "mc2", "b1"])), squad(BASE), 2, undefined, spread);

    expect(result.selectedIds).toEqual(["mc1", "b1"]);
  });

  it("no quita a dos extremos ni a dos delanteros si hay alternativa", () => {
    const wide = selectDeconvocations(ordered(rest(["b1", "b2", "mc1"])), squad(BASE), 2, undefined, spread);
    const forwards = selectDeconvocations(ordered(rest(["dc1", "dc2", "mc1"])), squad(BASE), 2, undefined, spread);

    expect(wide.selectedIds).toEqual(["b1", "mc1"]);
    expect(forwards.selectedIds).toEqual(["dc1", "mc1"]);
  });

  it("repite línea cuando hay más desconvocatorias que líneas", () => {
    const result = selectDeconvocations(ordered(rest(["dfc1", "dfc2", "mc1", "mc2", "b1", "b2"])), squad(BASE), 6, undefined, spread);

    expect(result.selectedIds).toHaveLength(6);
  });

  it("los desconvocados obligatorios ocupan su línea", () => {
    const result = selectDeconvocations(ordered(rest(["lat1", "mc1"]), ["dfc1"]), squad(BASE), 2, undefined, spread);

    expect(result.selectedIds).toContain("dfc1");
    expect(result.selectedIds).toContain("mc1");
    expect(result.selectedIds).not.toContain("lat1");
  });

  it("sin la opción activada conserva el orden recibido", () => {
    const result = selectDeconvocations(ordered(rest(["mc1", "mc2", "b1"])), squad(BASE), 2);

    expect(result.selectedIds).toEqual(["mc1", "mc2"]);
  });
});

describe("selectDeconvocations — jugadores fuertes", () => {
  const strongIds = new Set(["dfc1", "mc1", "b1", "dc1"]);

  it("limita cuántos fuertes se desconvocan y compensa con los demás", () => {
    const options = { spreadLines: true, strongIds, maxStrong: 1 };
    const result = selectDeconvocations(ordered(rest(["dfc1", "mc1", "b1", "dc1", "lat1", "mc2"])), squad(BASE), 3, undefined, options);

    expect(result.selectedIds.filter((id) => strongIds.has(id))).toHaveLength(1);
    expect(result.selectedIds).toHaveLength(3);
  });

  it("con maxStrong 0 no desconvoca a ningún fuerte si hay alternativas", () => {
    const options = { strongIds, maxStrong: 0 };
    const result = selectDeconvocations(ordered(rest(["dfc1", "mc1", "lat1"])), squad(BASE), 2, undefined, options);

    expect(result.selectedIds).toEqual(["lat1", "dfc2"].filter((id) => result.selectedIds.includes(id)));
    expect(result.selectedIds.some((id) => strongIds.has(id))).toBe(false);
  });

  it("si solo quedan fuertes para llegar al objetivo, los desconvoca", () => {
    const only: Entry[] = BASE.filter(([id]) => !id.startsWith("b") || id === "b1" || id === "b2");
    const all = new Set(only.map(([id]) => id).filter((id) => id !== "gk1" && id !== "gk2"));
    const options = { strongIds: all, maxStrong: 0 };
    const result = selectDeconvocations(ordered(only.map(([id]) => id)), squad(only), 2, undefined, options);

    expect(result.selectedIds).toHaveLength(2);
  });
});

describe("selectDeconvocations — cobertura de posición", () => {
  const withForwards = (forwards: Entry[]): Entry[] => [...BASE.filter(([, role]) => role !== "forward"), ...forwards];

  it("no quita a un delantero si quedarían menos de dos jugadores que puedan jugar de delantero", () => {
    const entries = withForwards([["dc1", "forward"], ["dc2", "forward"]]);
    const options = { positionCover: 2 };
    const result = selectDeconvocations(ordered(["dc1", ...entries.map(([id]) => id).filter((id) => id !== "dc1")]), squad(entries), 1, undefined, options);

    expect(result.selectedIds).not.toContain("dc1");
  });

  it("cuentan los jugadores con delantero entre sus posiciones posibles", () => {
    const entries = withForwards([["dc1", "forward"], ["dc2", "forward"], ["b9", "wide", ["wide", "forward"]]]);
    const options = { positionCover: 2 };
    const result = selectDeconvocations(ordered(["dc1", ...entries.map(([id]) => id).filter((id) => id !== "dc1")]), squad(entries), 1, undefined, options);

    expect(result.selectedIds).toEqual(["dc1"]);
  });

  it("con tres delanteros permite quitar a uno", () => {
    const entries = withForwards([["dc1", "forward"], ["dc2", "forward"], ["dc3", "forward"]]);
    const options = { positionCover: 2 };
    const result = selectDeconvocations(ordered(["dc1", ...entries.map(([id]) => id).filter((id) => id !== "dc1")]), squad(entries), 1, undefined, options);

    expect(result.selectedIds).toEqual(["dc1"]);
  });

  it("registra la protección con los jugadores que quedarían", () => {
    const entries = withForwards([["dc1", "forward"], ["dc2", "forward"]]);
    const options = { positionCover: 2 };
    const result = selectDeconvocations(ordered(["dc1", ...entries.map(([id]) => id).filter((id) => id !== "dc1")]), squad(entries), 1, undefined, options);

    expect(result.coverRemaining.get("dc1")).toBe(1);
  });
});

describe("selectDeconvocations — la cobertura vale para todas las líneas", () => {
  const LOW_MINIMUMS = { goalkeeper: 2, fullBack: 1, centreBack: 1, centralMid: 1, wide: 1, forward: 1 };

  it("no quita a un central si quedaría menos de dos que puedan jugar de central", () => {
    const entries = BASE.filter(([, role]) => role !== "centreBack");
    entries.push(["dfc1", "centreBack"], ["dfc2", "centreBack"]);
    const order = ordered(["dfc1", ...entries.map(([id]) => id).filter((id) => id !== "dfc1")]);

    const result = selectDeconvocations(order, squad(entries), 1, LOW_MINIMUMS, { positionCover: 2 });

    expect(result.selectedIds).not.toContain("dfc1");
    expect(result.coverRemaining.get("dfc1")).toBe(1);
  });

  it("cuenta a un lateral que puede jugar de central como cobertura del central", () => {
    const entries = BASE.filter(([, role]) => role !== "centreBack");
    entries.push(["dfc1", "centreBack"], ["dfc2", "centreBack"], ["lat9", "fullBack", ["fullBack", "centreBack"]]);
    const order = ordered(["dfc1", ...entries.map(([id]) => id).filter((id) => id !== "dfc1")]);

    const result = selectDeconvocations(order, squad(entries), 1, LOW_MINIMUMS, { positionCover: 2 });

    expect(result.selectedIds).toEqual(["dfc1"]);
  });

  it("no quita a un banda si quedaría menos de dos que puedan jugar de banda", () => {
    const entries = BASE.filter(([, role]) => role !== "wide");
    entries.push(["b1", "wide"], ["b2", "wide"]);
    const order = ordered(["b1", ...entries.map(([id]) => id).filter((id) => id !== "b1")]);

    const result = selectDeconvocations(order, squad(entries), 1, LOW_MINIMUMS, { positionCover: 2 });

    expect(result.selectedIds).not.toContain("b1");
  });
});

describe("selectDeconvocations — jugadores reservados para un partido más difícil", () => {
  const reservedIds = new Set(["lat1", "mc2"]);

  it("no desconvoca a los reservados si hay otros elegibles", () => {
    const result = selectDeconvocations(ordered(rest(["lat1", "mc2", "b1", "dc1", "mc1"])), squad(BASE), 2, undefined, { reservedIds });

    expect(result.selectedIds).toEqual(["b1", "dc1"]);
    expect(result.balanceSkipped.get("lat1")).toBe("reserved");
    expect(result.balanceSkipped.get("mc2")).toBe("reserved");
  });

  it("si no queda otra forma de llegar al objetivo, desconvoca a un reservado", () => {
    const only = BASE.filter(([id]) => ["gk1", "gk2", "lat1", "lat2", "lat3", "lat4"].includes(id));
    const result = selectDeconvocations(ordered(only.map(([id]) => id)), squad(only), 1, undefined, { reservedIds: new Set(["lat1", "lat2", "lat3", "lat4"]) });

    expect(result.selectedIds).toHaveLength(1);
  });

  it("entre los reservados prefiere al que va antes en el orden cuando hay que usar uno", () => {
    const only = BASE.filter(([id]) => ["gk1", "gk2", "lat1", "lat2", "lat3", "lat4"].includes(id));
    const result = selectDeconvocations(ordered(["lat2", "lat1", "lat3", "lat4", "gk1", "gk2"]), squad(only), 1, undefined, { reservedIds: new Set(["lat1", "lat2", "lat3", "lat4"]) });

    expect(result.selectedIds).toEqual(["lat2"]);
  });
});
