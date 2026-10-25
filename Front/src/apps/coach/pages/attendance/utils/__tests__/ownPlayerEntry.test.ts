import { describe, it, expect } from "vitest";
import { findOwnPlayerEntry, matchesAssociatedPlayer, type OwnPlayerLists } from "../ownPlayerEntry";
import type { ConvocationItem, PlayerSimple } from "../../../../services/convocationService";

const player = (id: string, playerId: string): PlayerSimple => ({ id, playerId, alias: id }) as PlayerSimple;
const conv = (id: string, p: PlayerSimple): ConvocationItem => ({ id, player: p, status: 1 }) as ConvocationItem;

const emptyLists = (): OwnPlayerLists => ({
  waiting: [],
  availabilityPending: [],
  available: [],
  pending: [],
  accepted: [],
  injured: [],
  injuredWithConv: [],
  declined: [],
});

describe("matchesAssociatedPlayer", () => {
  it("reconoce al jugador por playerId o por id de jugador de equipo", () => {
    expect(matchesAssociatedPlayer({ id: "tp1", playerId: "p1" }, "p1")).toBe(true);
    expect(matchesAssociatedPlayer({ id: "tp1", playerId: "p1" }, "tp1")).toBe(true);
    expect(matchesAssociatedPlayer({ id: "tp1", playerId: "p1" }, "p2")).toBe(false);
  });

  it("no reconoce a nadie sin jugador asociado", () => {
    expect(matchesAssociatedPlayer({ id: "tp1", playerId: "p1" }, null)).toBe(false);
  });
});

describe("findOwnPlayerEntry", () => {
  const me = player("tp1", "p1");
  const other = player("tp2", "p2");

  it.each(["waiting", "availabilityPending", "available", "injured"] as const)("encuentra al jugador propio en la lista «%s»", (kind) => {
    const lists = emptyLists();
    lists[kind] = [other, me];

    expect(findOwnPlayerEntry(lists, "p1")).toEqual({ kind, player: me });
  });

  it.each(["pending", "accepted", "injuredWithConv", "declined"] as const)(
    "encuentra la convocatoria propia en la lista «%s»",
    (kind) => {
      const lists = emptyLists();
      const mine = conv("c1", me);
      lists[kind] = [conv("c2", other), mine];

      expect(findOwnPlayerEntry(lists, "p1")).toEqual({ kind, conv: mine });
    }
  );

  it("devuelve null si el jugador asociado no está en ninguna lista", () => {
    const lists = emptyLists();
    lists.accepted = [conv("c2", other)];

    expect(findOwnPlayerEntry(lists, "p1")).toBeNull();
  });

  it("devuelve null sin jugador asociado", () => {
    const lists = emptyLists();
    lists.accepted = [conv("c1", me)];

    expect(findOwnPlayerEntry(lists, null)).toBeNull();
  });
});
