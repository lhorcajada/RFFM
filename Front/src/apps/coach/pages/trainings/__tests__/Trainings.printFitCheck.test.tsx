import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Trainings from "../Trainings";
import { UserProvider } from "../../../../../shared/context/UserContext";
import type { Exercise, TrainingSession, TrainingSessionDetail } from "../../../types/training";

const mockGetExercises = vi.fn();
const mockGetSessions = vi.fn();
const mockGetSessionById = vi.fn();
const mockGetExerciseById = vi.fn();

vi.mock("../../../services/trainingService", () => ({
  default: {
    getExercises: (...args: unknown[]) => mockGetExercises(...args),
    getExerciseById: (...args: unknown[]) => mockGetExerciseById(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
  },
  hasErrorCode: () => false,
}));

vi.mock("../../../services/seasonPlanService", () => ({
  default: { getByTeamIdAndSeason: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/gameModelService", () => ({
  default: { getZones: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/seasonService", () => ({
  default: {
    getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", name: "2026-2027" }),
    getSeasons: vi.fn().mockResolvedValue([{ id: "season-1", name: "2026-2027" }]),
  },
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
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
  getPlayersByTeam: vi.fn().mockResolvedValue([]),
}));

const LONG_SEQUENCE = "Secuencia que no cabe";

function makeExercise(overrides: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    tipo: "Analitico",
    objetivo: "Objetivo",
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
    ...overrides,
  };
}

const fitting = makeExercise({ id: "ex-ok", name: "Ejercicio que cabe", puntos: ["Pase"] });
const overflowing = makeExercise({ id: "ex-long", name: "Ejercicio largo", puntos: [LONG_SEQUENCE] });

function makeSessionDetail(): TrainingSessionDetail {
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
    targets: [],
    blocks: [
      {
        id: "b1",
        order: 1,
        nombre: "Principal",
        exercises: [
          { id: "be1", exerciseId: "ex-ok", position: 1 },
          { id: "be2", exerciseId: "ex-long", position: 2 },
        ],
      },
    ],
  };
}

function makeSession(): TrainingSession {
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
    exerciseCount: 2,
    targets: [],
  };
}

/** jsdom does no layout, so the panel's measured height is stubbed: any panel holding the long
 * sequence is taller than the 600 px available. */
function stubPanelLayout() {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => 600);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("ficha-panel") && (this.textContent ?? "").includes(LONG_SEQUENCE) ? 700 : 0;
  });
}

function fakePrintWindow() {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: "complete",
      images: [],
      fonts: { ready: Promise.resolve() },
    },
    focus: vi.fn(),
    print: vi.fn(),
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    },
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/trainings?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/trainings" element={<Trainings />} />
          <Route path="/coach/trainings/new-exercise" element={<div>Editor de ejercicio</div>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

const DIALOG_TITLE = "Hay fichas que no caben en una hoja";

describe("Trainings — comprobación de ajuste antes de imprimir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubPanelLayout();
    mockGetExercises.mockResolvedValue([fitting, overflowing]);
    mockGetSessions.mockResolvedValue([makeSession()]);
    mockGetSessionById.mockResolvedValue(makeSessionDetail());
    mockGetExerciseById.mockImplementation(async (id: string) => (id === "ex-ok" ? fitting : overflowing));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openSessionsTab() {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Sesiones" }));
    await screen.findByText("Sesión 1");
    return user;
  }

  it("lista las fichas que no caben, con su bloque de sesión, y no abre la ventana de impresión hasta elegir", async () => {
    const fakeWindow = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));

    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    expect(within(dialog).getByText("Ejercicio largo · Principal")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Ejercicio que cabe/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Editar ejercicio" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Imprimir igualmente" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("no imprime nada al cancelar", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakePrintWindow() as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: DIALOG_TITLE })).not.toBeInTheDocument());
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("imprime la sesión al elegir «Imprimir igualmente»", async () => {
    const fakeWindow = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));
    await user.click(await screen.findByRole("button", { name: "Imprimir igualmente" }));

    await waitFor(() => expect(fakeWindow.print).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.document.write.mock.calls[0][0] as string).toContain("Ejercicio largo");
  });

  it("abre el editor del primer ejercicio de la lista al elegir «Editar ejercicio», sin imprimir", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakePrintWindow() as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));
    await user.click(await screen.findByRole("button", { name: "Editar ejercicio" }));

    expect(await screen.findByText("Editor de ejercicio")).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("imprime sin preguntar cuando todas las fichas caben", async () => {
    mockGetSessionById.mockResolvedValue({
      ...makeSessionDetail(),
      blocks: [{ id: "b1", order: 1, nombre: "Principal", exercises: [{ id: "be1", exerciseId: "ex-ok", position: 1 }] }],
    });
    const fakeWindow = fakePrintWindow();
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Imprimir PDF" }));

    await waitFor(() => expect(fakeWindow.print).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: DIALOG_TITLE })).not.toBeInTheDocument();
  });

  it("visualizar la sesión no pasa por la comprobación de ajuste", async () => {
    const fakeWindow = fakePrintWindow();
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = await openSessionsTab();

    await user.click(screen.getByRole("button", { name: "Visualizar" }));

    await waitFor(() => expect(fakeWindow.document.write).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: DIALOG_TITLE })).not.toBeInTheDocument();
    expect(fakeWindow.print).not.toHaveBeenCalled();
  });

  it("el ejercicio suelto pasa por la misma comprobación antes de abrir la ventana", async () => {
    const fakeWindow = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Ejercicios" }));
    await screen.findByText("Ejercicio largo");

    const printButtons = screen.getAllByRole("button", { name: "Imprimir PDF" });
    await user.click(printButtons[1]);

    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    expect(within(dialog).getByText("Ejercicio largo")).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Imprimir igualmente" }));
    await waitFor(() => expect(fakeWindow.print).toHaveBeenCalled());
  });

  it("el ejercicio suelto que cabe se imprime sin preguntar", async () => {
    const fakeWindow = fakePrintWindow();
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Ejercicios" }));
    await screen.findByText("Ejercicio que cabe");

    await user.click(screen.getAllByRole("button", { name: "Imprimir PDF" })[0]);

    await waitFor(() => expect(fakeWindow.print).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: DIALOG_TITLE })).not.toBeInTheDocument();
  });
});
