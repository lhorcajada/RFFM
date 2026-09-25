import { describe, expect, it } from "vitest";
import {
  buildSubSubPrincipioHabilidadesMap,
  buildSubSubPrincipioTextoMap,
  flattenSubprincipioTargets,
} from "../dragPayload";
import type { GameModel } from "../../../../../types/gameModel";

function buildMixedModel(): GameModel {
  return {
    id: "model-1",
    teamId: "team-1",
    name: "Modelo",
    season: "2026-2027",
    principles: [
      {
        id: 1,
        apiId: "principle-1",
        gameMomentId: 1,
        gameMomentName: "Fase defensiva",
        numero: 1,
        titulo: "Defensa organizada",
        texto: "",
        notas: [],
        subprincipios: [
          {
            id: 1,
            apiId: "sub-1",
            numero: "1.1",
            titulo: "Presión alta",
            texto: "",
            notas: [],
            zonas: [
              {
                id: 1,
                apiId: "zona-1",
                zoneKeys: ["iniciacion"],
                texto: "",
                notas: [],
                subSubPrincipios: [
                  { id: 1, apiId: "ssp-zona", numero: "1.1.1", rol: "Delantero", texto: "En zona", habilidades: [], notas: [] },
                ],
              },
            ],
            subSubPrincipios: [
              {
                id: 2,
                apiId: "ssp-general",
                numero: "1.1.2",
                rol: "Central",
                texto: "General",
                habilidades: [{ id: 1, apiId: "hab-1", nombre: "Pase", descripcion: "", entrenable: "", referenciaAKey: null }],
                notas: [],
              },
            ],
          },
        ],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

describe("dragPayload — subprincipio con zonas y sub-subprincipios generales", () => {
  it("al arrastrar el subprincipio incluye los de sus zonas y los generales", () => {
    const model = buildMixedModel();
    const principle = model.principles[0];

    const targets = flattenSubprincipioTargets(principle.subprincipios[0], { principle });

    expect(targets.map((t) => t.subSubPrincipioId).sort()).toEqual(["ssp-general", "ssp-zona"]);
  });

  it("el mapa de textos incluye los generales", () => {
    expect(buildSubSubPrincipioTextoMap(buildMixedModel()).get("ssp-general")).toBe("General");
  });

  it("el mapa de habilidades incluye los generales", () => {
    expect(buildSubSubPrincipioHabilidadesMap(buildMixedModel()).get("ssp-general")?.map((h) => h.nombre)).toEqual(["Pase"]);
  });
});
