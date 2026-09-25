import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ContentBoardPage from "../ContentBoardPage";
import trainingService from "../../../../services/trainingService";
import { UserProvider } from "../../../../../../shared/context/UserContext";
import type { GameModel } from "../../../../types/gameModel";
import type { TrainingSession } from "../../../../types/training";

const mockUseContentBoardData = vi.fn();
const mockAddTargets = vi.fn();
const mockRemoveTarget = vi.fn();

vi.mock("../hooks/useContentBoardData", () => ({
  useContentBoardData: (...args: unknown[]) => mockUseContentBoardData(...args),
}));

vi.mock("../hooks/useSessionDrop", () => ({
  useSessionDrop: () => ({ addTargets: mockAddTargets, removeTarget: mockRemoveTarget }),
}));

vi.mock("../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", name: "2026-2027" }) },
  COACH_ACTIVE_SEASON_CHANGED_EVENT: "rffm.coach_active_season_changed",
}));

vi.mock("../../../../services/trainingService", () => ({
  default: {
    createSession: vi.fn().mockResolvedValue({ id: "sess-new" }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderPage(initialEntries = ["/coach/trainings/content-board?clubId=club-1&teamId=team-1"]) {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <ContentBoardPage />
      </MemoryRouter>
    </UserProvider>
  );
}

const gameModelFixture: GameModel = {
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
      subprincipios: [],
      notas: [],
    },
  ],
  setPieceRules: [],
  openIssues: [],
};

const sessionsFixture: TrainingSession[] = [
  {
    id: "sess-1",
    name: "Sesión sin programar",
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
  },
];

describe("ContentBoardPage — estados de carga", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra un indicador de carga mientras loading es true", () => {
    mockUseContentBoardData.mockReturnValue({
      gameModel: null,
      coverage: null,
      sessions: [],
      setSessions: vi.fn(),
      loading: true,
      error: null,
      refetchSessions: vi.fn(),
      refetchCoverage: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra la pista de 'Modelo ADN' cuando el equipo no tiene GameModel todavía", () => {
    mockUseContentBoardData.mockReturnValue({
      gameModel: null,
      coverage: null,
      sessions: [],
      setSessions: vi.fn(),
      loading: false,
      error: null,
      refetchSessions: vi.fn(),
      refetchCoverage: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/modelo adn/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /modelo adn/i })).toHaveAttribute("href", "/coach/game-model");
  });
});

describe("ContentBoardPage — ambos paneles con datos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza el panel ADN y el panel de sesiones cuando hay datos", () => {
    mockUseContentBoardData.mockReturnValue({
      gameModel: gameModelFixture,
      coverage: { subSubPrincipios: [], zonas: [], subprincipios: [], principios: [] },
      sessions: sessionsFixture,
      setSessions: vi.fn(),
      loading: false,
      error: null,
      refetchSessions: vi.fn(),
      refetchCoverage: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/defensa organizada/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sesión sin programar")).toBeInTheDocument();
  });
});

function session(id: string, name: string, microcicloId: string | null, microcicloWeekLabel: string | null = null): TrainingSession {
  return {
    ...sessionsFixture[0],
    id,
    name,
    microcicloId,
    microcicloWeekLabel,
    isAssociatedToPlan: microcicloId !== null,
  };
}

const mixedSessions: TrainingSession[] = [
  session("sess-a", "Sesión semana A", "micro-a", "Semana 3"),
  session("sess-b", "Sesión semana B", "micro-b", "Semana 4"),
  session("sess-free", "Sesión libre", null),
];

function mockBoardData(overrides: Partial<{ gameModel: GameModel | null; sessions: TrainingSession[] }> = {}) {
  mockUseContentBoardData.mockReturnValue({
    gameModel: gameModelFixture,
    coverage: { subSubPrincipios: [], zonas: [], subprincipios: [], principios: [] },
    sessions: mixedSessions,
    setSessions: vi.fn(),
    loading: false,
    error: null,
    refetchSessions: vi.fn(),
    refetchCoverage: vi.fn(),
    ...overrides,
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

type Entry = string | { pathname: string; search: string; state?: unknown };

function renderWithRoutes(entry: Entry) {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/coach/trainings/content-board" element={<ContentBoardPage />} />
          <Route path="/coach/trainings/new-session" element={<div>Editor de sesión</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </UserProvider>
  );
}

const microEntry: Entry = {
  pathname: "/coach/trainings/content-board",
  search: "?clubId=club-1&teamId=team-1&microcicloId=micro-a",
  state: { microciclo: { weekLabel: "Semana 3", startDate: "2026-09-14", endDate: "2026-09-20" } },
};

describe("ContentBoardPage — con microciclo en contexto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra solo las sesiones del microciclo indicado", () => {
    mockBoardData();

    renderWithRoutes(microEntry);

    expect(screen.getByDisplayValue("Sesión semana A")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Sesión semana B")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Sesión libre")).not.toBeInTheDocument();
  });

  it("muestra en la cabecera la semana y sus fechas", () => {
    mockBoardData();

    renderWithRoutes(microEntry);

    expect(screen.getByText(/semana 3 · 2026-09-14 – 2026-09-20/i)).toBeInTheDocument();
  });

  it("sin datos de navegación y sin sesiones, la cabecera muestra 'Microciclo seleccionado'", () => {
    mockBoardData({ sessions: [] });

    renderWithRoutes({ pathname: microEntry.pathname, search: microEntry.search });

    expect(screen.getByText(/microciclo seleccionado/i)).toBeInTheDocument();
  });

  it("crea la sesión nueva asignada al microciclo y sin fecha", async () => {
    mockBoardData();

    renderWithRoutes(microEntry);
    await userEvent.click(screen.getByRole("button", { name: /nueva sesión/i }));

    expect(trainingService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ microcicloId: "micro-a", date: null })
    );
  });

  it("'Ver todas las sesiones' quita el filtro y muestra todas las sesiones", async () => {
    mockBoardData();

    renderWithRoutes(microEntry);
    await userEvent.click(screen.getByRole("button", { name: /ver todas las sesiones/i }));

    expect(screen.getByTestId("location")).not.toHaveTextContent("microcicloId");
    expect(screen.getByDisplayValue("Sesión semana B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sesión libre")).toBeInTheDocument();
  });

  it("sin Modelo de Juego ofrece crear la sesión sin contenido en el editor con el microciclo", async () => {
    mockBoardData({ gameModel: null });

    renderWithRoutes(microEntry);
    await userEvent.click(screen.getByRole("button", { name: /crear sesión sin contenido/i }));

    expect(screen.getByText("Editor de sesión")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("microcicloId=micro-a");
  });
});

describe("ContentBoardPage — sin microciclo en contexto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra todas las sesiones del equipo", () => {
    mockBoardData();

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");

    expect(screen.getByDisplayValue("Sesión semana A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sesión semana B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sesión libre")).toBeInTheDocument();
  });

  it("crea la sesión nueva sin microciclo", async () => {
    mockBoardData();

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");
    await userEvent.click(screen.getByRole("button", { name: /nueva sesión/i }));

    expect(trainingService.createSession).toHaveBeenCalledWith(expect.objectContaining({ microcicloId: null }));
  });

  it("no ofrece 'Crear sesión sin contenido' cuando falta el Modelo de Juego", () => {
    mockBoardData({ gameModel: null });

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");

    expect(screen.queryByRole("button", { name: /crear sesión sin contenido/i })).not.toBeInTheDocument();
  });
});
