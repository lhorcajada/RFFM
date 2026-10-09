import { describe, it, expect } from "vitest";
import { positionGroupOf, groupByPosition } from "../positionGroups";

describe("positionGroupOf", () => {
  it.each([
    ["Portero", "goalkeepers"],
    ["Lateral Izquierdo", "defenders"],
    ["Lateral Derecho", "defenders"],
    ["Defensa Central", "defenders"],
    ["Líbero", "defenders"],
    ["Carrilero Derecho", "defenders"],
    ["Medio Centro", "midfielders"],
    ["Medio Centro Defensivo", "midfielders"],
    ["Mediocampista ofensivo", "midfielders"],
    ["Mediocampista Izquierdo", "midfielders"],
    ["Mediocampista Derecho", "midfielders"],
    ["Extremo Izquierdo", "wingers"],
    ["Extremo Derecho", "wingers"],
    ["Delantero Centro", "forwards"],
    ["Segundo Delantero", "forwards"],
  ])("clasifica «%s» como %s", (position, expected) => {
    expect(positionGroupOf(position)).toBe(expected);
  });

  it("clasifica una posición vacía o desconocida como sin posición", () => {
    expect(positionGroupOf(undefined)).toBe("unknown");
    expect(positionGroupOf("")).toBe("unknown");
    expect(positionGroupOf("Utillero")).toBe("unknown");
  });
});

describe("groupByPosition", () => {
  it("ordena los grupos de portería a delantera y omite los vacíos", () => {
    const players = [
      { name: "Nueve", position: "Delantero Centro" },
      { name: "Uno", position: "Portero" },
      { name: "Dos", position: "Lateral Derecho" },
      { name: "Once", position: "Extremo Izquierdo" },
    ];

    const groups = groupByPosition(players, (p) => p.position);

    expect(groups.map((g) => g.label)).toEqual(["Porteros", "Defensas", "Extremos", "Delanteros"]);
    expect(groups[0].items.map((p) => p.name)).toEqual(["Uno"]);
  });

  it("agrupa a los jugadores sin posición al final", () => {
    const groups = groupByPosition(
      [{ position: undefined }, { position: "Medio Centro" }],
      (p) => p.position
    );

    expect(groups.map((g) => g.label)).toEqual(["Medios", "Sin posición"]);
  });
});
