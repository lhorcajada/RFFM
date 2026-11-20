import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";

const moveToNotCalledMock = vi.fn();
const useConvocationProposalMock = vi.fn();
let tabProps: Record<string, unknown> = {};
let barProps: Record<string, unknown> = {};
let gridTabProps: Record<string, unknown> = {};

const getSportEventByIdMock = vi.fn();
vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
}));

const publishConvocationMock = vi.fn();
vi.mock("../../../services/convocationService", () => ({
  publishConvocation: (...args: unknown[]) => publishConvocationMock(...args),
}));

vi.mock("../../../services/configurationCoachService", () => ({
  default: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/kitService", () => ({
  getTeamKits: vi.fn().mockResolvedValue([]),
  updateEventKit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../hooks/useConvocationManagement", () => ({
  useConvocationManagement: () => ({
    players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    loadingPlayers: false,
    excuseTypes: [
      { id: 3, name: "Enfermedad", justified: true },
      { id: 7, name: "Decisión técnica", justified: false },
    ],
    statuses: [],
    mgmtEventId: "event-1",
    mgmtLoadingConv: false,
    mgmtAvailable: ["p3"],
    mgmtCalled: ["p1"],
    mgmtNotCalled: ["p2"],
    mgmtPending: [],
    mgmtConvMap: {},
    mgmtRatings: {},
    mgmtPhotos: {},
    mgmtExcuseMap: { p2: 3 },
    setMgmtExcuseMap: vi.fn(),
    mgmtDragPlayer: null,
    mgmtDragOver: null,
    setMgmtDragOver: vi.fn(),
    mgmtSaving: false,
    mgmtSaveResult: null,
    setMgmtSaveResult: vi.fn(),
    teamAvgRating: null,
    handleDragStart: vi.fn(),
    handleDrop: vi.fn(),
    handleSave: vi.fn(),
    moveToNotCalled: (...args: unknown[]) => moveToNotCalledMock(...args),
    moveToAvailable: vi.fn(),
    acceptPending: vi.fn(),
  }),
}));

const emptyGrid = { matchColumns: [], enrichedGrid: new Map(), isLoading: false };
let gridData: {
  matchColumns: { eventId: string; label: string; date: string; rival: string | null }[];
  enrichedGrid: Map<string, Map<string, { statusId: number | null; excuseTypeId: number | null; statusName: string; excuseName: string | null }>>;
  isLoading: boolean;
} = emptyGrid;

vi.mock("../hooks/useDesconvocatoriasGrid", () => ({
  useDesconvocatoriasGrid: () => gridData,
}));

vi.mock("../hooks/useConvocationMatchContext", () => ({
  useConvocationMatchContext: () => ({
    seasonEvents: [],
    seasonStats: [],
    gridStartsCountMap: new Map(),
    lastInjuryEndMap: new Map(),
    lastInjuryStartMap: new Map(),
    weekTrainingStatsMap: new Map(),
    weekTrainingCount: 0,
    loadingProposalContext: false,
  }),
}));

vi.mock("../hooks/useConvocationPlayerViews", () => ({
  useConvocationPlayerViews: () => ({
    playerStreaks: new Map(),
    playerTechnicalTotals: new Map(),
    lineupPlayers: [],
    notCalledPlayers: [],
    pendingPlayers: [],
    notAttendingPlayers: [],
  }),
}));

vi.mock("../hooks/useConvocationProposal", () => ({
  useConvocationProposal: (input: unknown) => {
    useConvocationProposalMock(input);
    return {};
  },
}));

let isPlayerRole = true;
vi.mock("../../../hooks/useIsPlayerRole", () => ({
  useIsPlayerRole: () => isPlayerRole,
  default: () => isPlayerRole,
}));

vi.mock("../components/ConvocationTab", () => ({
  default: (props: Record<string, unknown>) => {
    tabProps = props;
    return <div data-testid="convocation-tab" />;
  },
}));
vi.mock("../components/DesconvocatoriasTab", () => ({
  default: (props: Record<string, unknown>) => {
    gridTabProps = props;
    return <div data-testid="desconvocatorias-tab" />;
  },
}));
vi.mock("../components/ConvocatoriaPrint", () => ({ default: React.forwardRef(() => null) }));
vi.mock("../components/ConvocationMatchHeader", () => ({ default: () => null }));
vi.mock("../components/ConvocationMatchActionBar", () => ({
  default: (props: Record<string, unknown>) => {
    barProps = props;
    return null;
  },
}));
vi.mock("../components/ConvocationDeconvokeDialog", () => ({ default: () => null }));

import ConvocationMatchDetail from "../ConvocationMatchDetail";

const match = {
  date: "2999-01-01",
  time: "10:00",
  localTeamName: "Local",
  localTeamShield: "",
  visitorTeamName: "Visitante",
  visitorTeamShield: "",
  isFinished: false,
  isHomeTeam: true,
  field: "",
  codacta: null,
  selectedKitNumber: null,
  locationMapUrl: null,
  eventId: "event-1",
};

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter
        initialEntries={[{ pathname: "/coach/convocations/match", search: "?teamId=team-1", state: { match } }]}
      >
        <Routes>
          <Route path="/coach/convocations/match" element={<ConvocationMatchDetail />} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

const event = (matchCategory: string, convocationPublished: boolean) => ({
  id: "event-1",
  matchCategory,
  convocationPublished,
});

describe("ConvocationMatchDetail - publicación de la convocatoria de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabProps = {};
    barProps = {};
    gridTabProps = {};
    gridData = emptyGrid;
    isPlayerRole = true;
    publishConvocationMock.mockResolvedValue(undefined);
  });

  it("el jugador no ve la convocatoria de un partido de liga sin publicar y se le avisa", async () => {
    getSportEventByIdMock.mockResolvedValue(event("League", false));
    renderPage();

    expect(await screen.findByText(/La convocatoria aún no está publicada/i)).toBeInTheDocument();
    expect(screen.queryByTestId("convocation-tab")).not.toBeInTheDocument();
  });

  it("el jugador ve la convocatoria de un partido de liga ya publicada", async () => {
    getSportEventByIdMock.mockResolvedValue(event("League", true));
    renderPage();

    expect(await screen.findByTestId("convocation-tab")).toBeInTheDocument();
    expect(screen.queryByText(/La convocatoria aún no está publicada/i)).not.toBeInTheDocument();
  });

  it("el jugador sigue viendo la pestaña Desconvocatorias aunque la convocatoria no esté publicada", async () => {
    getSportEventByIdMock.mockResolvedValue(event("League", false));
    renderPage();
    await screen.findByText(/La convocatoria aún no está publicada/i);

    await userEvent.click(screen.getByRole("tab", { name: "Desconvocatorias" }));

    expect(screen.getByTestId("desconvocatorias-tab")).toBeInTheDocument();
  });

  it("el jugador ve la convocatoria de un amistoso sin publicar", async () => {
    getSportEventByIdMock.mockResolvedValue(event("Friendly", false));
    renderPage();

    expect(await screen.findByTestId("convocation-tab")).toBeInTheDocument();
  });

  it("el entrenador ve el borrador y puede publicarlo en un partido de liga sin publicar", async () => {
    isPlayerRole = false;
    getSportEventByIdMock.mockResolvedValue(event("League", false));
    renderPage();

    await waitFor(() => expect(barProps.onPublishConvocation).toBeTypeOf("function"));
    expect(screen.getByTestId("convocation-tab")).toBeInTheDocument();
  });

  it("el entrenador no puede publicar una convocatoria de liga ya publicada", async () => {
    isPlayerRole = false;
    getSportEventByIdMock.mockResolvedValue(event("League", true));
    renderPage();

    await waitFor(() => expect(getSportEventByIdMock).toHaveBeenCalled());
    await waitFor(() => expect(barProps.onPublishConvocation).toBeUndefined());
  });

  it("el entrenador no puede publicar la convocatoria de un amistoso", async () => {
    isPlayerRole = false;
    getSportEventByIdMock.mockResolvedValue(event("Friendly", false));
    renderPage();

    await waitFor(() => expect(getSportEventByIdMock).toHaveBeenCalled());
    expect(barProps.onPublishConvocation).toBeUndefined();
  });

  it("publicar pide confirmación y llama al backend al confirmar", async () => {
    isPlayerRole = false;
    getSportEventByIdMock.mockResolvedValue(event("League", false));
    renderPage();
    await waitFor(() => expect(barProps.onPublishConvocation).toBeTypeOf("function"));

    act(() => (barProps.onPublishConvocation as () => void)());
    expect(publishConvocationMock).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(publishConvocationMock).toHaveBeenCalledWith("event-1"));
    await waitFor(() => expect(barProps.onPublishConvocation).toBeUndefined());
  });

  it("si publicar falla, la convocatoria sigue sin publicar", async () => {
    isPlayerRole = false;
    publishConvocationMock.mockRejectedValue(new Error("boom"));
    getSportEventByIdMock.mockResolvedValue(event("League", false));
    renderPage();
    await waitFor(() => expect(barProps.onPublishConvocation).toBeTypeOf("function"));

    act(() => (barProps.onPublishConvocation as () => void)());
    await userEvent.click(await screen.findByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(publishConvocationMock).toHaveBeenCalled());
    expect(barProps.onPublishConvocation).toBeTypeOf("function");
  });
});
