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

vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: vi.fn().mockResolvedValue({ id: "event-1", matchCategory: "League" }),
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

vi.mock("../../../hooks/useIsPlayerRole", () => ({
  useIsPlayerRole: () => true,
  default: () => true,
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

const matchAt = (date: string, time: string) => ({
  date,
  time,
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
});

function renderPage(match = matchAt("2999-01-01", "10:00")) {
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

describe("ConvocationMatchDetail - vista de jugador/familiar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabProps = {};
    barProps = {};
    gridTabProps = {};
    gridData = emptyGrid;
  });

  it("solo muestra las pestañas Desconvocatorias y Convocatoria", () => {
    renderPage();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAccessibleName("Desconvocatorias");
    expect(tabs[1]).toHaveAccessibleName("Convocatoria");
  });

  it("pasa la pestaña Convocatoria en solo lectura", () => {
    renderPage();

    expect(tabProps.readOnly).toBe(true);
  });

  it("pide la barra de acciones en solo lectura", () => {
    renderPage();

    expect(barProps.readOnly).toBe(true);
  });

  it("no ofrece Partido en directo antes de la hora de inicio", () => {
    renderPage(matchAt("2999-01-01", "10:00"));

    expect(barProps.onOpenLiveMatch).toBeUndefined();
  });

  it("ofrece Partido en directo cuando el partido ya ha empezado", () => {
    renderPage(matchAt("2020-01-01", "10:00"));

    expect(barProps.onOpenLiveMatch).toBeTypeOf("function");
  });

  it("la pestaña Desconvocatorias no ofrece desconvocar jugadores", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: "Desconvocatorias" }));

    expect(screen.getByTestId("desconvocatorias-tab")).toBeInTheDocument();
    expect(gridTabProps.onDeconvokePlayer).toBeUndefined();
  });
});
