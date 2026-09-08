import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { TrainingSession, TrainingSessionDetail } from "../../../types/training";

const mockGetSessions = vi.fn();
const mockGetSessionById = vi.fn();
const mockGetExerciseById = vi.fn();
const mockGetPlayersByTeam = vi.fn().mockResolvedValue([]);

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: vi.fn().mockResolvedValue([]),
    getExerciseById: (...args: unknown[]) => mockGetExerciseById(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
  },
  hasErrorCode: () => false,
}));

vi.mock("../../../services/seasonPlanService", () => ({
  default: {
    getByTeamIdAndSeason: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../services/gameModelService", () => ({
  default: { getZones: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", name: "2026-2027" }) },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
}));

vi.mock("../../../hooks/useTeamAndClub", () => ({
  default: () => ({
    team: { id: "team-1", club: { id: "club-1" } },
    teamTitleNode: "Equipo Test",
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => () => {},
}));

vi.mock("../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args) },
  getPlayersByTeam: (...args: unknown[]) => mockGetPlayersByTeam(...args),
}));

function makeSession(overrides: Partial<TrainingSession> & { id: string; name: string }): TrainingSession {
  return {
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

function makeSessionDetail(overrides: Partial<TrainingSessionDetail> & { id: string; name: string }): TrainingSessionDetail {
  return {
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
    blocks: [],
    targets: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Trainings />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Trainings — orden de sesiones por fecha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ordena las sesiones por fecha ascendente y agrupa las sin programar al final", async () => {
    mockGetSessions.mockResolvedValue([
      makeSession({ id: "sess-late", name: "Sesión tardía", date: "2026-12-01" }),
      makeSession({ id: "sess-unscheduled", name: "Sesión sin programar", date: null }),
      makeSession({ id: "sess-early", name: "Sesión temprana", date: "2026-09-15" }),
    ]);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    const names = await screen.findAllByText(/Sesión (tardía|sin programar|temprana)/);

    expect(names.map((n) => n.textContent)).toEqual([
      "Sesión temprana",
      "Sesión tardía",
      "Sesión sin programar",
    ]);
  });
});

describe("Trainings — visualizar e imprimir sesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessions.mockResolvedValue([makeSession({ id: "sess-1", name: "Sesión 1" })]);
    mockGetSessionById.mockResolvedValue(makeSessionDetail({ id: "sess-1", name: "Sesión 1" }));
    mockGetExerciseById.mockResolvedValue(null);
    mockGetPlayersByTeam.mockResolvedValue([]);
  });

  it("abre una ventana con la sesión al pulsar Visualizar, sin llamar a print()", async () => {
    const printSpy = vi.fn();
    const fakeWindow = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: printSpy,
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    await user.click(screen.getByRole("button", { name: "Visualizar" }));

    await waitFor(() => {
      expect(mockGetSessionById).toHaveBeenCalledWith("sess-1");
    });
    await waitFor(() => {
      expect(fakeWindow.document.write).toHaveBeenCalled();
    });
    expect(printSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("abre una ventana y llama a print() al pulsar Imprimir PDF", async () => {
    const printSpy = vi.fn();
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        readyState: "complete",
        images: [],
        fonts: { ready: Promise.resolve() },
      },
      focus: vi.fn(),
      print: printSpy,
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));

    await waitFor(() => {
      expect(mockGetSessionById).toHaveBeenCalledWith("sess-1");
    });
    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it("obtiene el detalle completo de cada ejercicio de la sesión y lo incluye en el documento", async () => {
    mockGetSessionById.mockResolvedValue(
      makeSessionDetail({
        id: "sess-1",
        name: "Sesión 1",
        blocks: [
          {
            id: "b1",
            order: 1,
            nombre: "Activación",
            comoConectaConAnterior: "",
            exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
          },
        ],
      }),
    );
    mockGetExerciseById.mockResolvedValue({
      id: "ex1",
      name: "Rondo 4v2",
      tipo: "Analitico",
      objetivo: "Mantener la posesión bajo presión",
      modelRelations: [],
      nivelesColumnas: [],
      niveles: [],
      logistica: "4 conos, 2 balones",
      descripcion: "",
      isAssociatedToGameModel: false,
    });

    const fakeWindow = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    await user.click(screen.getByRole("button", { name: "Visualizar" }));

    await waitFor(() => {
      expect(mockGetExerciseById).toHaveBeenCalledWith("ex1");
    });
    await waitFor(() => {
      expect(fakeWindow.document.write).toHaveBeenCalled();
    });

    const writtenHtml = fakeWindow.document.write.mock.calls[0][0] as string;
    expect(writtenHtml).toContain("Mantener la posesión bajo presión");

    openSpy.mockRestore();
  });

  it("pinta el dibujo real de la pizarra táctica de un ejercicio sin imagen, resolviendo el roster del equipo", async () => {
    mockGetSessionById.mockResolvedValue(
      makeSessionDetail({
        id: "sess-1",
        name: "Sesión 1",
        blocks: [
          {
            id: "b1",
            order: 1,
            nombre: "Activación",
            comoConectaConAnterior: "",
            exercises: [{ id: "be1", exerciseId: "ex1", position: 1, exerciseName: "Rondo 4v2" }],
          },
        ],
      }),
    );
    mockGetExerciseById.mockResolvedValue({
      id: "ex1",
      name: "Rondo 4v2",
      tipo: "Analitico",
      objetivo: "Mantener la posesión bajo presión",
      modelRelations: [],
      nivelesColumnas: [],
      niveles: [],
      logistica: "4 conos, 2 balones",
      descripcion: "",
      isAssociatedToGameModel: false,
      boardStateJson: JSON.stringify({ placedChapas: { "player-1": { x: 10, y: 10 } } }),
    });
    mockGetPlayersByTeam.mockResolvedValue([
      { id: "player-1", name: "Ana", alias: "Ani", dorsal: 9 },
    ]);

    const fakeWindow = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");

    await user.click(screen.getByRole("button", { name: "Visualizar" }));

    await waitFor(() => {
      expect(mockGetPlayersByTeam).toHaveBeenCalledWith("team-1");
    });
    await waitFor(() => {
      expect(fakeWindow.document.write).toHaveBeenCalled();
    });

    const writtenHtml = fakeWindow.document.write.mock.calls[0][0] as string;
    expect(writtenHtml).toContain("Vista previa de la pizarra");
    expect(writtenHtml).toContain("Ani");
    expect(writtenHtml).not.toContain("<img");

    openSpy.mockRestore();
  });
});
