import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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
    excuseTypes: [{ id: 7, name: "Decisión técnica", justified: false }],
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
    mgmtExcuseMap: {},
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

vi.mock("../hooks/useDesconvocatoriasGrid", () => ({
  useDesconvocatoriasGrid: () => ({ matchColumns: [], enrichedGrid: new Map(), isLoading: false }),
}));

vi.mock("../hooks/useConvocationMatchContext", () => ({
  useConvocationMatchContext: () => ({
    seasonEvents: [],
    seasonStats: [],
    gridStartsCountMap: new Map(),
    lastInjuryEndMap: new Map(),
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
  });

  it("muestra la pestaña Convocatoria en segunda posición", () => {
    renderPage();

    const tabNames = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabNames).toEqual(["Desconvocatorias", "Convocatoria", "Alineación", "Simular Partido"]);
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
