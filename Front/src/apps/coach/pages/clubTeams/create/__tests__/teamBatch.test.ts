import { describe, expect, it } from "vitest";
import {
  LETTERS,
  buildTeamName,
  getExistingLetters,
  lettersRange,
} from "../teamBatch";
import type { TeamResponse } from "../../../../services/teamService";

function team(name: string, categoryId: number): TeamResponse {
  return { id: name, name, category: { id: categoryId, name: "Cadete" } } as TeamResponse;
}

describe("teamBatch", () => {
  it("expone las 26 letras de la A a la Z", () => {
    expect(LETTERS).toHaveLength(26);
    expect(LETTERS[0]).toBe("A");
    expect(LETTERS[25]).toBe("Z");
  });

  it("construye el nombre como «Categoría Letra»", () => {
    expect(buildTeamName("Cadete", "C")).toBe("Cadete C");
  });

  it("detecta las letras existentes de la categoría sin distinguir mayúsculas", () => {
    const teams = [team("Cadete A", 1), team("cadete b", 1), team("Cadete C", 2), team("Cadete Rojo", 1)];
    expect(getExistingLetters(teams, 1, "Cadete")).toEqual(["A", "B"]);
  });

  it("devuelve un rango excluyendo las letras existentes", () => {
    expect(lettersRange(4, ["A", "B"])).toEqual(["C", "D"]);
    expect(lettersRange(26, [])).toHaveLength(26);
  });
});
