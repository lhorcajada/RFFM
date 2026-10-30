import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";

const moveToNotCalledMock = vi.fn();
const useConvocationProposalMock = vi.fn();
let applyProposal: ((ids: string[]) => Promise<void>) | null = null;

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

vi.mock("../components/ConvocationTab", () => ({
  default: (props: { onApplyProposal: (ids: string[]) => Promise<void> }) => {
    applyProposal = props.onApplyProposal;
    return <div data-testid="convocation-tab" />;
  },
}));
vi.mock("../components/DesconvocatoriasTab", () => ({ default: () => null }));
vi.mock("../components/ConvocatoriaPrint", () => ({ default: React.forwardRef(() => null) }));
vi.mock("../components/ConvocationMatchHeader", () => ({ default: () => null }));
vi.mock("../components/ConvocationMatchActionBar", () => ({ default: () => null }));
vi.mock("../components/ConvocationDeconvokeDialog", () => ({ default: () => null }));

import ConvocationMatchDetail from "../ConvocationMatchDetail";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/convocations/match?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/convocations/match" element={<ConvocationMatchDetail />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("ConvocationMatchDetail - orden de pestañas y propuesta de convocatoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyProposal = null;
    gridData = emptyGrid;
  });

  it("muestra la pestaña Convocatoria en segunda posición", () => {
    renderPage();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveAccessibleName("Desconvocatorias");
    expect(tabs[1]).toHaveAccessibleName("Convocatoria");
    expect(tabs[2]).toHaveAccessibleName("Alineación");
    expect(tabs[3]).toHaveAccessibleName("Simular Partido");
  });

  it("muestra en Convocatoria el número de convocados, sin cambiar el nombre de la pestaña", () => {
    renderPage();

    const counter = within(screen.getByRole("tab", { name: "Convocatoria" })).getByText("1");
    expect(counter).toHaveAttribute("aria-hidden", "true");
  });

  it("muestra en Desconvocatorias el número de jugadores desconvocados alguna vez", () => {
    gridData = {
      matchColumns: [{ eventId: "e1", label: "J1", date: "2026-01-01", rival: null }],
      enrichedGrid: new Map([
        ["e1", new Map([["p2", { statusId: 5, excuseTypeId: 7, statusName: "Deconvoke", excuseName: "Decisión técnica" }]])],
      ]),
      isLoading: false,
    };
    renderPage();

    const counter = within(screen.getByRole("tab", { name: "Desconvocatorias" })).getByText("1");
    expect(counter).toHaveAttribute("aria-hidden", "true");
  });

  it("no muestra contador en Alineación ni en Simular Partido", () => {
    renderPage();

    expect(within(screen.getByRole("tab", { name: "Alineación" })).queryByText(/^\d+$/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("tab", { name: "Simular Partido" })).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("abre el contenido de la convocatoria al pulsar la segunda pestaña", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: "Convocatoria" }));

    expect(screen.getByTestId("convocation-tab")).toBeInTheDocument();
  });

  it("abre la pestaña Convocatoria por defecto", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: "Convocatoria" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("convocation-tab")).toBeInTheDocument();
  });

  it("la pestaña Alineación abre la alineación a pantalla completa con el equipo y el evento", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: "Alineación" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/coach/convocations/lineup?teamId=team-1&eventId=event-1",
    );
  });

  it("la pestaña Simular Partido abre la simulación a pantalla completa con el equipo y el evento", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: "Simular Partido" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/coach/convocations/simulation?teamId=team-1&eventId=event-1",
    );
  });

  it("calcula la propuesta de convocatoria sobre toda la plantilla, no solo sobre los convocados", () => {
    renderPage();

    const lastInput = useConvocationProposalMock.mock.calls.at(-1)?.[0] as { squadIds: string[] };
    expect(lastInput.squadIds).toEqual(["p1", "p2", "p3"]);
  });

  it("pasa a la propuesta los jugadores no disponibles para el partido con su motivo", () => {
    renderPage();

    const lastInput = useConvocationProposalMock.mock.calls.at(-1)?.[0] as {
      matchUnavailable: Map<string, { excuseTypeId: number; reason: string }>;
    };
    expect(Array.from(lastInput.matchUnavailable)).toEqual([["p2", { excuseTypeId: 3, reason: "Enfermedad" }]]);
  });

  it("al aplicar la propuesta no cambia el motivo de los jugadores que ya estaban desconvocados", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: "Convocatoria" }));
    await waitFor(() => expect(applyProposal).not.toBeNull());

    await act(async () => {
      await applyProposal!(["p2", "p3"]);
    });

    expect(moveToNotCalledMock).toHaveBeenCalledTimes(1);
    expect(moveToNotCalledMock).toHaveBeenCalledWith("p3", 7);
  });
});
