import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, SessionTargetDetail, TrainingSessionDetail } from "../../../types/training";
import type { GameModel } from "../../../types/gameModel";

const getSessionByIdMock = vi.fn();
const getExerciseByIdMock = vi.fn();
vi.mock("../../../services/trainingService", () => ({
  default: {
    getSessionById: (...args: unknown[]) => getSessionByIdMock(...args),
    getExerciseById: (...args: unknown[]) => getExerciseByIdMock(...args),
  },
}));

vi.mock("../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

const loadActiveGameModelMock = vi.fn();
vi.mock("../sessionGameModel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sessionGameModel")>()),
  loadActiveGameModel: (...args: unknown[]) => loadActiveGameModelMock(...args),
}));

import { openSessionWindow } from "../sessionWindow";

function target(subSubPrincipioId: string): SessionTargetDetail {
  return {
    subSubPrincipioId,
    rol: "Rol",
    numero: "0.0.0",
    subprincipioId: "s-11",
    subprincipioTitulo: "Subprincipio",
    principioId: "p-1",
    principioTitulo: "Principio",
    gameMomentId: 1,
    gameMomentName: "Defensa organizada",
  };
}

const MODEL = {
  principles: [
    {
      subprincipios: [
        {
          apiId: "s-11",
          zonas: [],
          subSubPrincipios: [
            { apiId: "ssp-20", numero: "1.1.20", rol: "Delantero", habilidades: [] },
            { apiId: "ssp-21", numero: "1.1.21", rol: "Media punta", habilidades: [] },
          ],
        },
      ],
    },
  ],
} as unknown as GameModel;

function session(targets: SessionTargetDetail[]): TrainingSessionDetail {
  return {
    id: "ses-1",
    name: "Sesión de presión",
    description: "",
    date: null,
    startTime: null,
    isAssociatedToPlan: false,
    targets,
    blocks: [
      { id: "b-1", order: 1, nombre: "Principal", exercises: [{ id: "be-1", exerciseId: "ex-1", position: 1 }] },
    ],
  };
}

const EXERCISE: Exercise = {
  id: "ex-1",
  name: "Rondo 4v2",
  tipo: "Situacional",
  objetivo: "",
  nivelesColumnas: [],
  niveles: [],
  logistica: "",
  descripcion: "",
};

describe("openSessionWindow — línea del modelo de juego", () => {
  let written: string;

  beforeEach(() => {
    vi.clearAllMocks();
    written = "";
    getExerciseByIdMock.mockResolvedValue(EXERCISE);
    loadActiveGameModelMock.mockResolvedValue(MODEL);
    const fakeWindow = {
      document: { open: vi.fn(), write: (html: string) => (written += html), close: vi.fn() },
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("imprime en la hoja los objetivos de la sesión resueltos con el catálogo del equipo", async () => {
    getSessionByIdMock.mockResolvedValue(session([target("ssp-20"), target("ssp-21")]));

    await openSessionWindow("ses-1", "team-1");

    expect(loadActiveGameModelMock).toHaveBeenCalledWith("team-1");
    expect(written).toContain("<strong>Modelo de juego:</strong> 1.1.20 Delantero · 1.1.21 Media punta");
  });

  it("omite un objetivo que el catálogo ya no resuelve y sigue imprimiendo los demás", async () => {
    getSessionByIdMock.mockResolvedValue(session([target("ssp-borrado"), target("ssp-20")]));

    await openSessionWindow("ses-1", "team-1");

    expect(written).toContain("<strong>Modelo de juego:</strong> 1.1.20 Delantero</div>");
  });

  it("una sesión sin objetivos no imprime línea del modelo de juego ni carga el catálogo", async () => {
    getSessionByIdMock.mockResolvedValue(session([]));

    await openSessionWindow("ses-1", "team-1");

    expect(loadActiveGameModelMock).not.toHaveBeenCalled();
    expect(written).not.toContain('<div class="ficha-modelo">');
  });

  it("sin catálogo del equipo no imprime línea y la sesión se imprime igual", async () => {
    loadActiveGameModelMock.mockResolvedValue(null);
    getSessionByIdMock.mockResolvedValue(session([target("ssp-20")]));

    await openSessionWindow("ses-1", "team-1");

    expect(written).toContain("Rondo 4v2");
    expect(written).not.toContain('<div class="ficha-modelo">');
  });
});
