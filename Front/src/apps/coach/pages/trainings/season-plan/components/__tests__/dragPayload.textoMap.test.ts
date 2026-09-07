import { describe, expect, it } from "vitest";
import { buildSubSubPrincipioTextoMap } from "../dragPayload";
import type { GameModel } from "../../../../../types/gameModel";

function buildGameModel(): GameModel {
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
            zonas: [],
            subSubPrincipios: [
              { id: 1, apiId: "ssp-1", numero: "1.1.1", rol: "Central", texto: "Cierra el pasillo interior.", habilidades: [], notas: [] },
            ],
          },
          {
            id: 2,
            apiId: "sub-2",
            numero: "1.2",
            titulo: "Repliegue",
            texto: "",
            notas: [],
            subSubPrincipios: [],
            zonas: [
              {
                id: 1,
                apiId: "zona-1",
                zoneKeys: ["iniciacion"],
                texto: "",
                notas: [],
                subSubPrincipios: [
                  { id: 2, apiId: "ssp-2", numero: "1.2.1", rol: "Lateral", texto: "Cierra la banda.", habilidades: [], notas: [] },
                ],
              },
            ],
          },
          {
            id: 3,
            apiId: "sub-3",
            numero: "1.3",
            titulo: "Sin apiId",
            texto: "",
            notas: [],
            zonas: [],
            subSubPrincipios: [
              { id: 3, numero: "1.3.1", rol: "Pivote", texto: "No debería aparecer.", habilidades: [], notas: [] },
            ],
          },
        ],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

describe("buildSubSubPrincipioTextoMap", () => {
  it("mapea el texto de sub-subprincipios directos (sin Zona)", () => {
    const map = buildSubSubPrincipioTextoMap(buildGameModel());

    expect(map.get("ssp-1")).toBe("Cierra el pasillo interior.");
  });

  it("mapea el texto de sub-subprincipios anidados bajo una Zona", () => {
    const map = buildSubSubPrincipioTextoMap(buildGameModel());

    expect(map.get("ssp-2")).toBe("Cierra la banda.");
  });

  it("omite sub-subprincipios sin apiId (no referenciables como target)", () => {
    const map = buildSubSubPrincipioTextoMap(buildGameModel());

    expect(map.size).toBe(2);
  });
});
