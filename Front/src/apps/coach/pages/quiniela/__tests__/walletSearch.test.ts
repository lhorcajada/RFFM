import { describe, expect, it } from "vitest";
import type { QuinielaWalletSummary } from "../../../services/quinielaService";
import { filterWallets, normalizeSearchText } from "../walletSearch";

const jose = { id: "tp-jose", name: "José Pérez" };
const lucia = { id: "tp-lucia", name: "Lucía Pérez" };
const otro = { id: "tp-otro", name: "Otro Niño" };

const rows: QuinielaWalletSummary[] = [
  { userId: "u-jose", userName: "José Pérez", role: "Player", balance: 0, associatedPlayers: [jose] },
  { userId: "u-marta", userName: "Marta", role: "FamilyPlayer", balance: 12.5, associatedPlayers: [jose, lucia] },
  { userId: "u-pedro", userName: "Pedro", role: "FamilyPlayer", balance: 0, associatedPlayers: [jose] },
  { userId: "u-rosa", userName: "Rosa", role: "FamilyPlayer", balance: 0, associatedPlayers: [otro] },
];

const namesOf = (list: QuinielaWalletSummary[]) => list.map((row) => row.userName);

describe("normalizeSearchText", () => {
  it("ignora mayúsculas y espacios sobrantes", () => {
    expect(normalizeSearchText("  jOSE   perez ")).toBe("jose perez");
  });

  it("ignora los acentos", () => {
    expect(normalizeSearchText("José Pérez")).toBe("jose perez");
  });

  it("devuelve cadena vacía si el texto solo tiene espacios", () => {
    expect(normalizeSearchText("   ")).toBe("");
  });
});

describe("filterWallets", () => {
  it("encuentra las filas por el nombre de un jugador asociado, sin distinguir mayúsculas, acentos ni espacios", () => {
    const result = filterWallets(rows, "  jOSE   perez ");

    expect(namesOf(result)).toEqual(["José Pérez", "Marta", "Pedro"]);
    expect(namesOf(result)).not.toContain("Rosa");
  });

  it("encuentra al familiar por el nombre de un jugador que no tiene usuario en el equipo", () => {
    const result = filterWallets(rows, "lucia");

    expect(namesOf(result)).toEqual(["Marta"]);
    expect(result[0].associatedPlayers.map((p) => p.name)).toEqual(["José Pérez", "Lucía Pérez"]);
  });

  it("encuentra al familiar por su nombre y mantiene todos sus jugadores asociados", () => {
    const result = filterWallets(rows, "marta");

    expect(namesOf(result)).toEqual(["Marta"]);
    expect(result[0].associatedPlayers).toHaveLength(2);
  });

  it("devuelve cada fila una sola vez y en el orden original aunque coincida de varias formas", () => {
    const result = filterWallets(rows, "jose");

    expect(namesOf(result)).toEqual(["José Pérez", "Marta", "Pedro"]);
  });

  it("devuelve todas las filas en orden si el texto está vacío", () => {
    expect(namesOf(filterWallets(rows, ""))).toEqual(["José Pérez", "Marta", "Pedro", "Rosa"]);
  });

  it("devuelve todas las filas en orden si el texto solo tiene espacios", () => {
    expect(namesOf(filterWallets(rows, "   "))).toEqual(["José Pérez", "Marta", "Pedro", "Rosa"]);
  });

  it("devuelve una lista vacía si ninguna fila coincide", () => {
    expect(filterWallets(rows, "zzz")).toEqual([]);
  });

  it("no modifica la lista ni las filas recibidas", () => {
    const before = structuredClone(rows);
    const input = [...rows];

    filterWallets(rows, "marta");

    expect(rows).toEqual(before);
    expect(rows).toHaveLength(input.length);
    expect(rows.every((row, index) => row === input[index])).toBe(true);
  });
});
