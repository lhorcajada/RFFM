import { describe, it, expect } from "vitest";
import { playerDisplayName, playerDorsal, playerDetailHref } from "../playerDisplay";
import type { PlayerSimple } from "../../../../services/convocationService";

const player = (fields: Record<string, unknown>) => fields as PlayerSimple;

describe("playerDisplay", () => {
  it("usa el alias y, si no hay, nombre y apellidos o «Jugador»", () => {
    expect(playerDisplayName(player({ alias: "Hugo", name: "Hugo", lastName: "Martín" }))).toBe("Hugo");
    expect(playerDisplayName(player({ name: "Hugo", lastName: "Martín" }))).toBe("Hugo Martín");
    expect(playerDisplayName(player({}))).toBe("Jugador");
  });

  it("convierte el dorsal a número e ignora valores vacíos o no numéricos", () => {
    expect(playerDorsal(player({ dorsal: 9 }))).toBe(9);
    expect(playerDorsal(player({ dorsal: "10" }))).toBe(10);
    expect(playerDorsal(player({ dorsal: "" }))).toBeNull();
    expect(playerDorsal(player({ dorsal: "x" }))).toBeNull();
    expect(playerDorsal(player({}))).toBeNull();
  });

  it("enlaza al detalle solo si hay id de jugador de equipo", () => {
    expect(playerDetailHref(player({ id: "tp1" }))).toBe("/coach/player/tp1");
    expect(playerDetailHref(player({}))).toBeNull();
  });
});
