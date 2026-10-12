import { describe, it, expect } from "vitest";
import { getCardStatus, getExpelledIds, relocateAfterExpulsion } from "../expulsions";
import type { CardEvent } from "../../components/simulation/liveMatch.types";
import type { FormationSlotDef } from "../../../../types/formation";

let nextId = 0;

function ownCard(teamPlayerId: string, cardType: "yellow" | "red"): CardEvent {
  nextId += 1;
  return {
    id: `c${nextId}`,
    minute: 10,
    half: 1,
    cardType,
    teamPlayerId,
    playerName: teamPlayerId,
    isRivalPlayer: false,
    rivalDorsal: null,
  };
}

function rivalCard(cardType: "yellow" | "red"): CardEvent {
  nextId += 1;
  return {
    id: `c${nextId}`,
    minute: 10,
    half: 1,
    cardType,
    teamPlayerId: null,
    playerName: null,
    isRivalPlayer: true,
    rivalDorsal: 4,
  };
}

function slotDefs(count: number): FormationSlotDef[] {
  return Array.from({ length: count }, (_, i) => ({ slotIndex: i, label: i === 0 ? "PT" : "J", x: 10 + i, y: 50 }));
}

describe("getCardStatus", () => {
  it("devuelve none para un jugador sin tarjetas", () => {
    expect(getCardStatus([ownCard("p2", "yellow")], "p1")).toBe("none");
  });

  it("devuelve yellow con una sola amarilla", () => {
    expect(getCardStatus([ownCard("p1", "yellow")], "p1")).toBe("yellow");
  });

  it("devuelve red con una roja directa", () => {
    expect(getCardStatus([ownCard("p1", "red")], "p1")).toBe("red");
  });

  it("devuelve doubleYellow con dos amarillas", () => {
    expect(getCardStatus([ownCard("p1", "yellow"), ownCard("p1", "yellow")], "p1")).toBe("doubleYellow");
  });

  it("devuelve red con una amarilla seguida de roja directa", () => {
    expect(getCardStatus([ownCard("p1", "yellow"), ownCard("p1", "red")], "p1")).toBe("red");
  });
});

describe("getExpelledIds", () => {
  it("incluye a los jugadores con roja directa o doble amarilla y no a los que tienen una amarilla", () => {
    const cards = [
      ownCard("p1", "red"),
      ownCard("p2", "yellow"),
      ownCard("p2", "yellow"),
      ownCard("p3", "yellow"),
    ];

    expect([...getExpelledIds(cards)].sort()).toEqual(["p1", "p2"]);
  });

  it("ignora las tarjetas del rival", () => {
    expect(getExpelledIds([rivalCard("red")]).size).toBe(0);
  });
});

describe("relocateAfterExpulsion", () => {
  const slots = { 0: "gk", 1: "a", 2: "b", 3: "c" };

  it("mantiene al portero y recoloca al resto sin huecos al expulsar a un jugador de campo", () => {
    const result = relocateAfterExpulsion(slots, "b", slotDefs(3));

    expect(result).toEqual({ 0: "gk", 1: "a", 2: "c" });
  });

  it("pone en la portería al jugador elegido cuando el expulsado es el portero", () => {
    const result = relocateAfterExpulsion(slots, "gk", slotDefs(3), () => 1);

    expect(result).toEqual({ 0: "b", 1: "a", 2: "c" });
  });

  it("deja vacías las casillas sobrantes si ya había menos jugadores que casillas", () => {
    const result = relocateAfterExpulsion({ 0: "gk", 1: "a", 2: null, 3: "c" }, "c", slotDefs(3));

    expect(result).toEqual({ 0: "gk", 1: "a", 2: null });
  });
});
