import { describe, it, expect } from "vitest";
import { habilidadesBySubprincipio } from "../sessionHabilidades";
import type { GameModel } from "../../../../types/gameModel";
import type { SessionTargetDetail } from "../../../../types/training";

function target(subSubPrincipioId: string, subprincipioId: string): SessionTargetDetail {
  return {
    subSubPrincipioId,
    rol: "Rol",
    numero: "1.1.1",
    subprincipioId,
    subprincipioTitulo: "Subprincipio",
    principioId: "p-1",
    principioTitulo: "Principio",
    gameMomentId: 1,
    gameMomentName: "Defensa organizada",
  };
}

function habilidad(nombre: string) {
  return { id: -1, apiId: `h-${nombre}`, nombre, descripcion: "", entrenable: "", referenciaAKey: null };
}

function subSub(apiId: string, habilidades: string[]) {
  return { id: -1, apiId, key: apiId, numero: "1.1.1", rol: "Rol", texto: "", habilidades: habilidades.map(habilidad), notas: [] };
}

const MODEL = {
  id: "gm-1",
  teamId: "team-1",
  name: "Modelo",
  season: "2026-2027",
  setPieceRules: [],
  openIssues: [],
  principles: [
    {
      id: -1,
      apiId: "p-1",
      key: "p",
      gameMomentId: 1,
      gameMomentName: "Defensa organizada",
      numero: 1,
      titulo: "Principio",
      texto: "",
      notas: [],
      subprincipios: [
        {
          id: -1,
          apiId: "s-11",
          key: "s11",
          numero: "1.1",
          titulo: "Subprincipio 1.1",
          texto: "",
          notas: [],
          subSubPrincipios: [subSub("ssp-direct", ["Pase", "Percepción"])],
          zonas: [
            {
              id: -1,
              apiId: "z-1",
              key: "z",
              zoneKeys: [],
              label: null,
              zonaTexto: null,
              texto: "",
              notas: [],
              subSubPrincipios: [subSub("ssp-zone", ["Pase", "Desmarque"])],
            },
          ],
        },
        {
          id: -1,
          apiId: "s-12",
          key: "s12",
          numero: "1.2",
          titulo: "Subprincipio 1.2",
          texto: "",
          notas: [],
          subSubPrincipios: [subSub("ssp-other", ["Protección de balón"]), subSub("ssp-empty", [])],
          zonas: [],
        },
      ],
    },
  ],
} as unknown as GameModel;

describe("habilidadesBySubprincipio", () => {
  it("une sin repetir las habilidades del catálogo para los objetivos de la sesión, agrupadas por subprincipio", () => {
    const result = habilidadesBySubprincipio(
      [target("ssp-direct", "s-11"), target("ssp-zone", "s-11"), target("ssp-other", "s-12")],
      MODEL,
    );

    expect(result.get("s-11")).toEqual(["Pase", "Percepción", "Desmarque"]);
    expect(result.get("s-12")).toEqual(["Protección de balón"]);
  });

  it("deja fuera un subprincipio cuyos objetivos no definen habilidades", () => {
    const result = habilidadesBySubprincipio([target("ssp-empty", "s-12")], MODEL);

    expect(result.size).toBe(0);
  });

  it("ignora sin error un objetivo que el catálogo ya no resuelve", () => {
    const result = habilidadesBySubprincipio([target("ssp-borrado", "s-11"), target("ssp-direct", "s-11")], MODEL);

    expect(result.get("s-11")).toEqual(["Pase", "Percepción"]);
  });

  it("una sesión sin objetivos no tiene habilidades", () => {
    expect(habilidadesBySubprincipio([], MODEL).size).toBe(0);
  });

  it("sin modelo de juego no hay habilidades", () => {
    expect(habilidadesBySubprincipio([target("ssp-direct", "s-11")], null).size).toBe(0);
  });
});
