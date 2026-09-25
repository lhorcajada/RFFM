import { describe, expect, it } from "vitest";
import { buildSubSubPrincipioHabilidadesMap } from "../dragPayload";
import type { GameModel, Habilidad } from "../../../../../types/gameModel";

function habilidad(id: number, nombre: string): Habilidad {
  return { id, apiId: `hab-${id}`, nombre, descripcion: "", entrenable: "", referenciaAKey: null };
}

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
              { id: 1, apiId: "ssp-1", numero: "1.1.1", rol: "Central", texto: "", habilidades: [habilidad(1, "Perfilamiento")], notas: [] },
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
                  { id: 2, apiId: "ssp-2", numero: "1.2.1", rol: "Lateral", texto: "", habilidades: [habilidad(2, "Carga")], notas: [] },
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
              { id: 3, numero: "1.3.1", rol: "Pivote", texto: "", habilidades: [habilidad(3, "Pase")], notas: [] },
            ],
          },
        ],
      },
    ],
    setPieceRules: [],
    openIssues: [],
  };
}

describe("buildSubSubPrincipioHabilidadesMap", () => {
  it("mapea las habilidades de sub-subprincipios directos (sin Zona)", () => {
    const map = buildSubSubPrincipioHabilidadesMap(buildGameModel());

    expect(map.get("ssp-1")?.map((h) => h.nombre)).toEqual(["Perfilamiento"]);
  });

  it("mapea las habilidades de sub-subprincipios anidados bajo una Zona", () => {
    const map = buildSubSubPrincipioHabilidadesMap(buildGameModel());

    expect(map.get("ssp-2")?.map((h) => h.nombre)).toEqual(["Carga"]);
  });

  it("omite sub-subprincipios sin apiId", () => {
    const map = buildSubSubPrincipioHabilidadesMap(buildGameModel());

    expect(map.size).toBe(2);
  });
});
