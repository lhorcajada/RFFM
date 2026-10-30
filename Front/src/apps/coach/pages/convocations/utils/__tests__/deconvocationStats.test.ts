import { describe, it, expect } from "vitest";
import { countDeconvokedPlayers, isCellNotCalled } from "../deconvocationStats";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";

const cell = (statusName: string): GridCell => ({ statusId: 5, excuseTypeId: null, statusName, excuseName: null });

const columns: MatchColumn[] = [
  { eventId: "e1", label: "J1", date: "2026-01-01", rival: null },
  { eventId: "e2", label: "J2", date: "2026-01-08", rival: null },
];

describe("isCellNotCalled", () => {
  it("considera desconvocado el estado Deconvoke", () => {
    expect(isCellNotCalled(cell("Deconvoke"))).toBe(true);
  });

  it("considera desconvocado el estado No disponible", () => {
    expect(isCellNotCalled(cell("No disponible"))).toBe(true);
  });

  it("no considera desconvocado a un jugador aceptado", () => {
    expect(isCellNotCalled(cell("Accepted"))).toBe(false);
  });
});

describe("countDeconvokedPlayers", () => {
  const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

  it("cuenta cada jugador una sola vez aunque lo hayan desconvocado en varios partidos", () => {
    const grid = new Map([
      ["e1", new Map([["p1", cell("Deconvoke")]])],
      ["e2", new Map([["p1", cell("Deconvoke")], ["p2", cell("No disponible")]])],
    ]);

    expect(countDeconvokedPlayers(players, columns, grid)).toBe(2);
  });

  it("no cuenta a quien nunca ha sido desconvocado", () => {
    const grid = new Map([["e1", new Map([["p1", cell("Accepted")], ["p3", cell("Accepted")]])]]);

    expect(countDeconvokedPlayers(players, columns, grid)).toBe(0);
  });

  it("ignora a los jugadores que no están en la plantilla", () => {
    const grid = new Map([["e1", new Map([["ghost", cell("Deconvoke")]])]]);

    expect(countDeconvokedPlayers(players, columns, grid)).toBe(0);
  });

  it("devuelve 0 sin partidos", () => {
    expect(countDeconvokedPlayers(players, [], new Map())).toBe(0);
  });
});
