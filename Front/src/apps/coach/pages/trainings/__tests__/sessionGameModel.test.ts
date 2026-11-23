import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GameModel } from "../../../types/gameModel";
import type { SessionTargetDetail } from "../../../types/training";

const getActiveSeasonMock = vi.fn();
vi.mock("../../../services/seasonService", () => ({
  default: { getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args) },
}));

const getByTeamIdAndSeasonMock = vi.fn();
vi.mock("../../../services/gameModelService", () => ({
  default: { getByTeamIdAndSeason: (...args: unknown[]) => getByTeamIdAndSeasonMock(...args) },
}));

import { buildModeloDeJuegoLine, loadActiveGameModel, resolveSessionObjectives } from "../sessionGameModel";

function target(subSubPrincipioId: string): SessionTargetDetail {
  return {
    subSubPrincipioId,
    rol: "Rol de la sesión",
    numero: "0.0.0",
    subprincipioId: "s-x",
    subprincipioTitulo: "Subprincipio",
    principioId: "p-1",
    principioTitulo: "Principio",
    gameMomentId: 1,
    gameMomentName: "Defensa organizada",
  };
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
      id: 1,
      gameMomentId: 1,
      gameMomentName: "Defensa organizada",
      numero: 1,
      titulo: "Principio",
      texto: "",
      notas: [],
      subprincipios: [
        {
          id: 2,
          apiId: "s-11",
          numero: "1.1",
          titulo: "Subprincipio",
          texto: "",
          notas: [],
          subSubPrincipios: [
            {
              id: 3,
              apiId: "ssp-20",
              key: "k",
              numero: "1.1.20",
              rol: "Delantero",
              texto: "",
              habilidades: [{ id: 4, nombre: "Pase", descripcion: "", entrenable: "" }],
              notas: [],
            },
          ],
          zonas: [
            {
              id: 5,
              key: "z",
              zoneKeys: [],
              texto: "",
              notas: [],
              subSubPrincipios: [
                { id: 6, apiId: "ssp-21", key: "k", numero: "1.1.21", rol: "Media punta", texto: "", habilidades: [], notas: [] },
              ],
            },
          ],
        },
        {
          id: 7,
          numero: "1.2",
          titulo: "Sin guardar",
          texto: "",
          notas: [],
          zonas: [],
          subSubPrincipios: [
            { id: 8, apiId: "ssp-sin-padre", key: "k", numero: "1.2.1", rol: "X", texto: "", habilidades: [], notas: [] },
          ],
        },
      ],
    },
  ],
} as unknown as GameModel;

describe("resolveSessionObjectives", () => {
  it("resuelve los objetivos de la sesión con su número, rol y habilidades del catálogo, también los de una zona", () => {
    const result = resolveSessionObjectives([target("ssp-21"), target("ssp-20")], MODEL);

    expect(result).toEqual([
      { subSubPrincipioId: "ssp-21", numero: "1.1.21", rol: "Media punta", subprincipioId: "s-11", habilidades: [] },
      { subSubPrincipioId: "ssp-20", numero: "1.1.20", rol: "Delantero", subprincipioId: "s-11", habilidades: ["Pase"] },
    ]);
  });

  it("ignora sin error un objetivo que el catálogo ya no resuelve", () => {
    const result = resolveSessionObjectives([target("ssp-borrado"), target("ssp-20")], MODEL);

    expect(result.map((objective) => objective.subSubPrincipioId)).toEqual(["ssp-20"]);
  });

  it("ignora un objetivo cuyo subprincipio no está guardado en el catálogo", () => {
    expect(resolveSessionObjectives([target("ssp-sin-padre")], MODEL)).toEqual([]);
  });

  it("no resuelve nada sin modelo de juego ni sin objetivos", () => {
    expect(resolveSessionObjectives([target("ssp-20")], null)).toEqual([]);
    expect(resolveSessionObjectives([], MODEL)).toEqual([]);
  });
});

describe("buildModeloDeJuegoLine", () => {
  it("une los objetivos en una sola línea compacta", () => {
    const line = buildModeloDeJuegoLine(resolveSessionObjectives([target("ssp-20"), target("ssp-21")], MODEL));

    expect(line).toBe("1.1.20 Delantero · 1.1.21 Media punta");
  });

  it("queda vacía cuando no hay objetivos", () => {
    expect(buildModeloDeJuegoLine([])).toBe("");
  });
});

describe("loadActiveGameModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveSeasonMock.mockResolvedValue({ id: "season-1", name: "2026-2027" });
  });

  it("carga el modelo del equipo para la temporada activa", async () => {
    getByTeamIdAndSeasonMock.mockResolvedValue(MODEL);

    await expect(loadActiveGameModel("team-1")).resolves.toBe(MODEL);
    expect(getByTeamIdAndSeasonMock).toHaveBeenCalledWith("team-1", "2026-2027");
  });

  it("devuelve null cuando no hay temporada activa", async () => {
    getActiveSeasonMock.mockResolvedValue(null);

    await expect(loadActiveGameModel("team-1")).resolves.toBeNull();
    expect(getByTeamIdAndSeasonMock).not.toHaveBeenCalled();
  });

  it("devuelve null cuando el modelo no se puede leer", async () => {
    getByTeamIdAndSeasonMock.mockRejectedValue(new Error("404"));

    await expect(loadActiveGameModel("team-1")).resolves.toBeNull();
  });
});
