import { describe, expect, it } from "vitest";
import {
  evaluateRequirements,
  formatShortfall,
  roleFromDemarcationId,
  roleFromPositionName,
  toPositionPlayer,
  type PositionPlayer,
  type PositionRole,
} from "../positionRequirements";

let seq = 0;
function pp(role: PositionRole | null, possibleRoles: PositionRole[] = []): PositionPlayer {
  seq += 1;
  return { id: `p${seq}`, role, possibleRoles };
}

function times(n: number, role: PositionRole, possibleRoles: PositionRole[] = []): PositionPlayer[] {
  return Array.from({ length: n }, () => pp(role, possibleRoles));
}

// 1 POR, 2 LAT, 3 DFC, 3 MC, 1 MCO, 4 banda, 2 DC → todos los mínimos cumplidos.
function fullSquad(): PositionPlayer[] {
  return [
    ...times(1, "goalkeeper"),
    ...times(2, "fullBack"),
    ...times(3, "centreBack"),
    ...times(3, "centralMid"),
    ...times(1, "attackingMid"),
    ...times(4, "wide"),
    ...times(2, "forward"),
  ];
}

function without(players: PositionPlayer[], role: PositionRole, count = 1): PositionPlayer[] {
  let removed = 0;
  return players.filter((p) => {
    if (removed < count && p.role === role) {
      removed++;
      return false;
    }
    return true;
  });
}

function shortfallTexts(players: PositionPlayer[]): string[] {
  return evaluateRequirements(players).shortfalls.map(formatShortfall);
}

describe("roleFromDemarcationId", () => {
  it.each([
    [1, "goalkeeper"],
    [2, "fullBack"],
    [3, "fullBack"],
    [4, "centreBack"],
    [5, "centreBack"],
    [6, "centralMid"],
    [7, "centralMid"],
    [8, "attackingMid"],
    [9, "wide"],
    [10, "wide"],
    [11, "forward"],
    [12, "forward"],
    [13, "wide"],
    [14, "wide"],
  ])("la demarcación %i es del rol %s", (id, role) => {
    expect(roleFromDemarcationId(id)).toBe(role);
  });

  it.each([0, null, undefined, 99])("devuelve null para %s", (id) => {
    expect(roleFromDemarcationId(id)).toBeNull();
  });
});

describe("roleFromPositionName", () => {
  it.each([
    ["Líbero", "centreBack"],
    ["extremo derecho", "wide"],
    ["Mediocampista Izquierdo", "wide"],
    ["Mediocampista ofensivo", "attackingMid"],
    ["Medio Centro Defensivo", "centralMid"],
    ["Segundo Delantero", "forward"],
    ["Carrilero", "fullBack"],
    ["Mediapunta", "attackingMid"],
    ["Pivote", "centralMid"],
  ])("«%s» es del rol %s", (name, role) => {
    expect(roleFromPositionName(name)).toBe(role);
  });

  it("devuelve null sin nombre reconocible", () => {
    expect(roleFromPositionName("")).toBeNull();
    expect(roleFromPositionName(null)).toBeNull();
  });
});

describe("toPositionPlayer", () => {
  it("usa la demarcación activa y las posibles por id", () => {
    const player = toPositionPlayer({
      id: "a",
      name: "A",
      alias: "A",
      position: "Medio Centro",
      activePositionId: 6,
      possibleDemarcationIds: [6, 8, 11],
    });
    expect(player.role).toBe("centralMid");
    expect(player.possibleRoles).toEqual(["centralMid", "attackingMid", "forward"]);
  });

  it("si no hay id usa el nombre de la posición", () => {
    const player = toPositionPlayer({ id: "a", name: "A", alias: "A", position: "Extremo Izquierdo" });
    expect(player.role).toBe("wide");
    expect(player.possibleRoles).toEqual([]);
  });
});

describe("evaluateRequirements", () => {
  it("una plantilla completa no tiene avisos", () => {
    const result = evaluateRequirements(fullSquad());
    expect(result.shortfalls).toEqual([]);
    expect(result.deficit).toBe(0);
  });

  it("con 2 centrales avisa de que quedan 2 de 3", () => {
    expect(shortfallTexts(without(fullSquad(), "centreBack"))).toEqual(["Centrales: quedan 2 de 3"]);
  });

  it("sin portero avisa de porteros", () => {
    expect(shortfallTexts(without(fullSquad(), "goalkeeper"))).toEqual(["Porteros: quedan 0 de 1"]);
  });

  it("un central con lateral entre sus posiciones cubre al lateral que falta si sobran centrales", () => {
    const squad = [...without(fullSquad(), "fullBack"), pp("centreBack", ["centreBack", "fullBack"])];
    const result = evaluateRequirements(squad);
    expect(result.shortfalls).toEqual([]);
    expect([...result.coverAssignments.values()]).toEqual(["fullBack"]);
  });

  it("un central no cubre de lateral si dejaría a los centrales por debajo del mínimo", () => {
    const squad = [
      ...without(without(fullSquad(), "fullBack"), "centreBack"),
      pp("centreBack", ["centreBack", "fullBack"]),
    ];
    expect(shortfallTexts(squad)).toEqual(["Laterales: quedan 1 de 2"]);
  });

  it("con solo 3 de banda y nadie más que pueda jugar en banda avisa de la cobertura", () => {
    expect(shortfallTexts(without(fullSquad(), "wide"))).toEqual(["Cobertura de banda: quedan 3 de 4"]);
  });

  it("un medio centro con extremo entre sus posiciones completa la cobertura de banda", () => {
    const squad = [...without(fullSquad(), "wide"), pp("centralMid", ["centralMid", "wide"])];
    expect(shortfallTexts(squad)).toEqual([]);
  });

  it("con un solo delantero y nadie más que pueda jugar de delantero avisa de la cobertura", () => {
    expect(shortfallTexts(without(fullSquad(), "forward"))).toEqual(["Cobertura de delantero: quedan 1 de 2"]);
  });

  it("un mediapunta que puede jugar de delantero completa la cobertura de delantero", () => {
    const squad = [
      ...without(without(fullSquad(), "forward"), "attackingMid"),
      pp("attackingMid", ["attackingMid", "forward"]),
    ];
    expect(shortfallTexts(squad)).toEqual([]);
  });

  it("sin delanteros avisa del mínimo y de la cobertura", () => {
    expect(shortfallTexts(without(fullSquad(), "forward", 2))).toEqual([
      "Delanteros: quedan 0 de 1",
      "Cobertura de delantero: quedan 0 de 2",
    ]);
  });

  it("los jugadores sin posición no cuentan para ningún mínimo", () => {
    const squad = [...without(fullSquad(), "centreBack"), pp(null)];
    expect(shortfallTexts(squad)).toEqual(["Centrales: quedan 2 de 3"]);
  });

  it("el déficit suma lo que falta en cada requisito", () => {
    const squad = without(without(fullSquad(), "centreBack", 2), "goalkeeper");
    expect(evaluateRequirements(squad).deficit).toBe(3);
  });
});
