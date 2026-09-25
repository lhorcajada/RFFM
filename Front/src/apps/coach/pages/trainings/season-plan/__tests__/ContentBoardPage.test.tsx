import { render, screen, waitFor, within } from "@testing-library/react";
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

function GameModelEditorProbe({ title }: { title: string }) {
  const location = useLocation();
  const state = location.state as { season?: string; teamId?: string; returnTo?: string } | null;
  return (
    <div>
      <div>{title}</div>
      <div data-testid="editor-season">{state?.season ?? ""}</div>
      <div data-testid="editor-team">{state?.teamId ?? ""}</div>
      <div data-testid="editor-return-to">{state?.returnTo ?? ""}</div>
    </div>
  );
}

type Entry =string | { pathname: string; search: string; state?: unknown };

function renderWithRoutes(entry: Entry) {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/coach/trainings/content-board" element={<ContentBoardPage />} />
          <Route path="/coach/trainings/new-session" element={<div>Editor de sesión</div>} />
          <Route path="/coach/game-model/edit" element={<GameModelEditorProbe title="Editor del modelo" />} />
          <Route path="/coach/game-model/create" element={<GameModelEditorProbe title="Creación del modelo" />} />
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

describe("ContentBoardPage — habilidades en los objetivos de sesión", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra en el objetivo de la tarjeta las habilidades del sub-subprincipio del modelo", () => {
    const modelWithHabilidades: GameModel = {
      ...gameModelFixture,
      principles: [
        {
          ...gameModelFixture.principles[0],
          subprincipios: [
            {
              id: 1,
              apiId: "sub-1",
              numero: "1.1",
              titulo: "Presión alta",
              texto: "",
              zonas: [],
              notas: [],
              subSubPrincipios: [
                {
                  id: 1,
                  apiId: "ssp-1",
                  numero: "1.1.1",
                  rol: "Delantero",
                  texto: "",
                  notas: [],
                  habilidades: [
                    { id: 1, apiId: "hab-1", nombre: "Temporización", descripcion: "", entrenable: "", referenciaAKey: null },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const sessionWithTarget: TrainingSession = {
      ...sessionsFixture[0],
      targets: [
        {
          subSubPrincipioId: "ssp-1",
          rol: "Delantero",
          numero: "1.1.1",
          subprincipioId: "sub-1",
          subprincipioTitulo: "Presión alta",
          zonaId: null,
          zonaLabel: null,
          principioId: "principle-1",
          principioTitulo: "Defensa organizada",
          gameMomentId: 1,
          gameMomentName: "Fase defensiva",
        },
      ],
    };
    mockBoardData({ gameModel: modelWithHabilidades, sessions: [sessionWithTarget] });

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");

    const leaf = screen.getByTestId("session-target-leaf-ssp-1");
    expect(within(leaf).getByText("Temporización")).toBeInTheDocument();
  });
});

describe("ContentBoardPage — editar o crear el Modelo de Juego", () => {
  beforeEach(() => vi.clearAllMocks());

  it("'Editar modelo' abre el editor de la temporada activa y guarda la URL actual para volver", async () => {
    mockBoardData();

    renderWithRoutes(microEntry);
    const button = screen.getByRole("button", { name: /editar modelo/i });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(screen.getByText("Editor del modelo")).toBeInTheDocument();
    expect(screen.getByTestId("editor-season")).toHaveTextContent("2026-2027");
    expect(screen.getByTestId("editor-team")).toHaveTextContent("team-1");
    expect(screen.getByTestId("editor-return-to")).toHaveTextContent(
      "/coach/trainings/content-board?clubId=club-1&teamId=team-1&microcicloId=micro-a"
    );
  });

  it("sin Modelo de Juego, 'Crear modelo' abre el editor de creación", async () => {
    mockBoardData({ gameModel: null });

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");
    const button = screen.getByRole("button", { name: /crear modelo/i });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(screen.getByText("Creación del modelo")).toBeInTheDocument();
    expect(screen.getByTestId("editor-return-to")).toHaveTextContent(
      "/coach/trainings/content-board?clubId=club-1&teamId=team-1"
    );
  });

  it("no muestra 'Editar modelo' cuando el equipo no tiene modelo", () => {
    mockBoardData({ gameModel: null });

    renderWithRoutes("/coach/trainings/content-board?clubId=club-1&teamId=team-1");

    expect(screen.queryByRole("button", { name: /editar modelo/i })).not.toBeInTheDocument();
  });
});
