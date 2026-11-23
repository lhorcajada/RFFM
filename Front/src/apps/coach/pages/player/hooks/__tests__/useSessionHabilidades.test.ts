import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { GameModel } from "../../../../types/gameModel";
import type { SessionTargetDetail, TrainingSessionDetail } from "../../../../types/training";

const loadActiveGameModelMock = vi.fn();
vi.mock("../../../trainings/sessionGameModel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../trainings/sessionGameModel")>()),
  loadActiveGameModel: (...args: unknown[]) => loadActiveGameModelMock(...args),
}));

import { useSessionHabilidades } from "../useSessionHabilidades";

const TARGET: SessionTargetDetail = {
  subSubPrincipioId: "ssp-20",
  rol: "Delantero",
  numero: "1.1.20",
  subprincipioId: "s-11",
  subprincipioTitulo: "Subprincipio",
  principioId: "p-1",
  principioTitulo: "Principio",
  gameMomentId: 1,
  gameMomentName: "Defensa organizada",
};

const MODEL = {
  principles: [
    {
      subprincipios: [
        {
          apiId: "s-11",
          zonas: [],
          subSubPrincipios: [{ apiId: "ssp-20", numero: "1.1.20", rol: "Delantero", habilidades: [{ nombre: "Pase" }] }],
        },
      ],
    },
  ],
} as unknown as GameModel;

function detail(targets: SessionTargetDetail[]): TrainingSessionDetail {
  return { id: "ses-1", name: "Sesión", description: "", date: null, startTime: null, isAssociatedToPlan: false, targets, blocks: [] };
}

describe("useSessionHabilidades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadActiveGameModelMock.mockResolvedValue(MODEL);
  });

  it("devuelve las habilidades de los objetivos de la sesión por subprincipio", async () => {
    const sessionDetail = detail([TARGET]);
    const { result } = renderHook(() => useSessionHabilidades("team-1", sessionDetail));

    await waitFor(() => expect(result.current.get("s-11")).toEqual(["Pase"]));
    expect(loadActiveGameModelMock).toHaveBeenCalledWith("team-1");
  });

  it("una sesión sin objetivos no carga el modelo ni tiene habilidades", () => {
    const sessionDetail = detail([]);
    const { result } = renderHook(() => useSessionHabilidades("team-1", sessionDetail));

    expect(result.current.size).toBe(0);
    expect(loadActiveGameModelMock).not.toHaveBeenCalled();
  });

  it("sin detalle de la sesión no hay habilidades", () => {
    const { result } = renderHook(() => useSessionHabilidades("team-1", null));

    expect(result.current.size).toBe(0);
    expect(loadActiveGameModelMock).not.toHaveBeenCalled();
  });

  it("sin modelo de juego no hay habilidades", async () => {
    loadActiveGameModelMock.mockResolvedValue(null);
    const sessionDetail = detail([TARGET]);
    const { result } = renderHook(() => useSessionHabilidades("team-1", sessionDetail));

    await waitFor(() => expect(loadActiveGameModelMock).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
