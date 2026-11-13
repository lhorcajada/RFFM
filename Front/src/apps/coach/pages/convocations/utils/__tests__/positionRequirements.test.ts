import { describe, expect, it } from "vitest";
import {
  evaluateRequirements,
  formatShortfall,
  protectionReason,
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

// 2 POR, 3 LAT, 3 DFC, 4 MC, 2 banda, 1 DC → todos los mínimos cumplidos.
function fullSquad(): PositionPlayer[] {
  return [
    ...times(2, "goalkeeper"),
    ...times(3, "fullBack"),
    ...times(3, "centreBack"),
    ...times(4, "centralMid"),
    ...times(2, "wide"),
    ...times(1, "forward"),
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
    [8, "centralMid"],
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
    ["Mediocampista ofensivo", "centralMid"],
    ["Medio Centro Defensivo", "centralMid"],
    ["Segundo Delantero", "forward"],
    ["Carrilero", "fullBack"],
    ["Mediapunta", "centralMid"],
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
    expect(player.possibleRoles).toEqual(["centralMid", "forward"]);
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

  it("con un solo portero avisa de que quedan 1 de 2", () => {
    expect(shortfallTexts(without(fullSquad(), "goalkeeper"))).toEqual(["Porteros: quedan 1 de 2"]);
  });

  it("con 2 laterales avisa de que quedan 2 de 3", () => {
    expect(shortfallTexts(without(fullSquad(), "fullBack"))).toEqual(["Laterales: quedan 2 de 3"]);
  });

  it("un central con lateral entre sus posiciones cubre al lateral que falta si sobran centrales", () => {
    const squad = [
      ...without(fullSquad(), "fullBack"),
      pp("centreBack", ["centreBack", "fullBack"]),
      pp("centreBack"),
    ];
    const result = evaluateRequirements(squad);
    expect(result.shortfalls).toEqual([]);
    expect([...result.coverAssignments.values()]).toEqual(["fullBack"]);
  });

  it("un central no cubre de lateral si dejaría a los centrales por debajo del mínimo", () => {
    const squad = [
      ...without(without(fullSquad(), "fullBack"), "centreBack"),
      pp("centreBack", ["centreBack", "fullBack"]),
    ];
    expect(shortfallTexts(squad)).toEqual(["Laterales: quedan 2 de 3"]);
  });

  it("con un solo extremo avisa de que quedan 1 de 2", () => {
    expect(shortfallTexts(without(fullSquad(), "wide"))).toEqual(["Bandas: quedan 1 de 2"]);
  });

  it("un medio centro con extremo entre sus posiciones cubre la banda si sobran medios centro", () => {
    const squad = [
      ...without(fullSquad(), "wide"),
      pp("centralMid", ["centralMid", "wide"]),
      pp("centralMid"),
    ];
    expect(shortfallTexts(squad)).toEqual([]);
  });

  it("sin delanteros avisa de que quedan 0 de 1", () => {
    expect(shortfallTexts(without(fullSquad(), "forward"))).toEqual(["Delanteros: quedan 0 de 1"]);
  });

  it("no hay cobertura extra de banda ni de delantero", () => {
    const keys = evaluateRequirements(fullSquad()).shortfalls.map((s) => s.requirement);
    expect(keys).toEqual([]);
    expect(evaluateRequirements(fullSquad()).available.has("wideCover" as never)).toBe(false);
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

describe("medios centro", () => {
  it("el mediocampista ofensivo cuenta como medio centro", () => {
    const squad = [
      ...without(fullSquad(), "centralMid", 2),
      toPositionPlayer({ id: "o1", position: "Mediocampista ofensivo", activePositionId: 8 }),
      toPositionPlayer({ id: "o2", position: "Mediocampista ofensivo", activePositionId: 8 }),
    ];

    expect(shortfallTexts(squad)).toEqual([]);
    expect(evaluateRequirements(squad).available.get("centralMid")).toBe(4);
  });

  it("el mediocampista derecho cuenta como banda y no como medio centro", () => {
    const squad = [
      ...without(fullSquad(), "centralMid"),
      toPositionPlayer({ id: "m1", position: "Mediocampista Derecho", activePositionId: 10 }),
    ];

    expect(shortfallTexts(squad)).toEqual(["Medios centro: quedan 3 de 4"]);
  });
});

describe("protectionReason", () => {
  it("indica cuántos disponibles quedan de los que exige el mínimo", () => {
    expect(protectionReason("centralMid", 4)).toBe("Protegido: quedan 4 de 4 medios centro disponibles");
  });

  it("usa el mínimo de cada posición", () => {
    expect(protectionReason("fullBack", 3)).toBe("Protegido: quedan 3 de 3 laterales disponibles");
  });
});

describe("evaluateRequirements available", () => {
  it("expone los disponibles por exigencia", () => {
    const result = evaluateRequirements(fullSquad());

    expect(result.available.get("centralMid")).toBe(4);
    expect(result.available.get("wide")).toBe(2);
  });
});
