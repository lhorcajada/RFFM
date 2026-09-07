import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSessionDrop } from "../useSessionDrop";
import type { TrainingSession, SessionTargetDetail } from "../../../../../types/training";

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getSessionById: vi.fn(),
    updateSession: vi.fn(),
  },
}));

function buildTarget(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-1",
    rol: "Central",
    numero: "1.1.1",
    subprincipioId: "sub-1",
    subprincipioTitulo: "Presión alta",
    zonaId: null,
    zonaLabel: null,
    principioId: "principle-1",
    principioTitulo: "Defensa organizada",
    gameMomentId: 1,
    gameMomentName: "Fase defensiva",
    ...overrides,
  };
}

function buildSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "sess-1",
    name: "Sesión 1",
    description: "",
    date: null,
    startTime: null,
    endTime: null,
    location: null,
    sportEventId: null,
    sportEventName: null,
    microcicloId: null,
    microcicloWeekLabel: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
    ...overrides,
  };
}

const sessionDetailFixture = {
  id: "sess-1",
  name: "Sesión 1",
  description: "",
  date: null,
  startTime: null,
  endTime: null,
  location: null,
  sportEventId: null,
  sportEventName: null,
  microcicloId: null,
  microcicloWeekLabel: null,
  isAssociatedToPlan: false,
  objetivoGeneral: null,
  mapaCampoTexto: null,
  urlImage: null,
  blocks: [],
  targets: [],
};

describe("useSessionDrop.addTargets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza optimistamente el nuevo target antes de que resuelva la petición", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const sessions = [buildSession()];
    let currentSessions = sessions;
    const setSessions = vi.fn((updater: (prev: TrainingSession[]) => TrainingSession[]) => {
      currentSessions = updater(currentSessions);
    });
    const refetchCoverage = vi.fn();

    const { result } = renderHook(() => useSessionDrop(currentSessions, setSessions, refetchCoverage));

    act(() => {
      result.current.addTargets("sess-1", [buildTarget()]);
    });

    expect(currentSessions[0].targets.map((t) => t.subSubPrincipioId)).toEqual(["ssp-1"]);
  });

  it("deduplica dentro de la sesión al añadir targets que ya estaban presentes", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(sessionDetailFixture);
    (trainingService.updateSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let currentSessions = [buildSession({ targets: [buildTarget()] })];
    const setSessions = vi.fn((updater: (prev: TrainingSession[]) => TrainingSession[]) => {
      currentSessions = updater(currentSessions);
    });
    const refetchCoverage = vi.fn();

    const { result } = renderHook(() => useSessionDrop(currentSessions, setSessions, refetchCoverage));

    await act(async () => {
      await result.current.addTargets("sess-1", [buildTarget()]);
    });

    expect(currentSessions[0].targets).toHaveLength(1);
  });

  it("hace PUT wholesale con la lista completa de ids y refresca la cobertura al terminar con éxito", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(sessionDetailFixture);
    (trainingService.updateSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let currentSessions = [buildSession()];
    const setSessions = vi.fn((updater: (prev: TrainingSession[]) => TrainingSession[]) => {
      currentSessions = updater(currentSessions);
    });
    const refetchCoverage = vi.fn();

    const { result } = renderHook(() => useSessionDrop(currentSessions, setSessions, refetchCoverage));

    await act(async () => {
      await result.current.addTargets("sess-1", [buildTarget()]);
    });

    expect(trainingService.updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({ targetSubSubPrincipioIds: ["ssp-1"] })
    );
    await waitFor(() => expect(refetchCoverage).toHaveBeenCalled());
  });

  it("revierte el cambio optimista y emite rffm.show_snackbar si la petición falla", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(sessionDetailFixture);
    (trainingService.updateSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    let currentSessions = [buildSession()];
    const setSessions = vi.fn((updater: (prev: TrainingSession[]) => TrainingSession[]) => {
      currentSessions = updater(currentSessions);
    });
    const refetchCoverage = vi.fn();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() => useSessionDrop(currentSessions, setSessions, refetchCoverage));

    await act(async () => {
      await result.current.addTargets("sess-1", [buildTarget()]);
    });

    expect(currentSessions[0].targets).toEqual([]);
    const snackbarEvent = dispatchSpy.mock.calls
      .map((c) => c[0] as CustomEvent)
      .find((e) => e.type === "rffm.show_snackbar");
    expect(snackbarEvent).toBeDefined();
    expect((snackbarEvent as CustomEvent).detail.severity).toBe("error");
  });
});

describe("useSessionDrop.removeTarget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("elimina el target indicado de forma optimista y hace PUT con la lista restante", async () => {
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (trainingService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(sessionDetailFixture);
    (trainingService.updateSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let currentSessions = [
      buildSession({ targets: [buildTarget(), buildTarget({ subSubPrincipioId: "ssp-2" })] }),
    ];
    const setSessions = vi.fn((updater: (prev: TrainingSession[]) => TrainingSession[]) => {
      currentSessions = updater(currentSessions);
    });
    const refetchCoverage = vi.fn();

    const { result } = renderHook(() => useSessionDrop(currentSessions, setSessions, refetchCoverage));

    await act(async () => {
      await result.current.removeTarget("sess-1", "ssp-1");
    });

    expect(currentSessions[0].targets.map((t) => t.subSubPrincipioId)).toEqual(["ssp-2"]);
    expect(trainingService.updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({ targetSubSubPrincipioIds: ["ssp-2"] })
    );
  });
});
