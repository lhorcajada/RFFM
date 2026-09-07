import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ContentBoardPage from "../ContentBoardPage";
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
