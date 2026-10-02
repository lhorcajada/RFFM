import { describe, it, expect } from "vitest";
import { habilidadesBySubprincipio } from "../sessionHabilidades";
import { exercise, relation } from "../../__tests__/exerciseFixtures";

describe("habilidadesBySubprincipio", () => {
  it("une sin repetir las habilidades imprescindibles de los ejercicios de cada subprincipio", () => {
    const result = habilidadesBySubprincipio([
      exercise({ id: "ex-1", modelRelations: [relation({ habilidadesImprescindibles: ["Pase", "Percepción"] })] }),
      exercise({
        id: "ex-2",
        modelRelations: [
          relation({ id: "rel-2", habilidadesImprescindibles: ["Pase", "Desmarque"] }),
          relation({ id: "rel-3", subprincipioId: "s-41", habilidadesImprescindibles: ["Protección de balón"] }),
        ],
      }),
    ]);

    expect(result.get("s-23")).toEqual(["Pase", "Percepción", "Desmarque"]);
    expect(result.get("s-41")).toEqual(["Protección de balón"]);
    expect(result.get("s-99")).toBeUndefined();
  });
});
