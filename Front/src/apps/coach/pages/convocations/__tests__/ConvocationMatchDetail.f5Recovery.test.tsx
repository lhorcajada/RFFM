import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserProvider } from "../../../../../shared/context/UserContext";

const getSportEventByIdMock = vi.fn();

vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
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
    players: [],
    loadingPlayers: false,
    excuseTypes: [],
    statuses: [],
    mgmtEventId: "event-1",
    mgmtLoadingConv: false,
    mgmtAvailable: [],
    mgmtCalled: [],
    mgmtNotCalled: [],
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
    moveToNotCalled: vi.fn(),
    moveToAvailable: vi.fn(),
    acceptPending: vi.fn(),
  }),
}));

vi.mock("../hooks/useDesconvocatoriasGrid", () => ({
  useDesconvocatoriasGrid: () => ({
    matchColumns: [],
    enrichedGrid: {},
    isLoading: false,
  }),
}));

vi.mock("../hooks/useConvocationMatchContext", () => ({
  useConvocationMatchContext: () => ({
    seasonEvents: [],
    seasonStats: {},
    gridStartsCountMap: {},
    lastInjuryEndMap: {},
    weekTrainingStatsMap: {},
    weekTrainingCount: 0,
    loadingProposalContext: false,
  }),
}));

vi.mock("../hooks/useConvocationPlayerViews", () => ({
  useConvocationPlayerViews: () => ({
    playerStreaks: {},
    playerTechnicalTotals: {},
    lineupPlayers: [],
    notCalledPlayers: [],
    pendingPlayers: [],
  }),
}));

vi.mock("../hooks/useConvocationProposal", () => ({
  useConvocationProposal: () => ({}),
}));

vi.mock("../components/ConvocationTab", () => ({ default: () => null }));
vi.mock("../components/DesconvocatoriasTab", () => ({ default: () => null }));
vi.mock("../components/AlineacionTab", () => ({ default: () => null }));
vi.mock("../components/SimulacionTab", () => ({ default: () => null }));
vi.mock("../components/PartidoEnDirectoTab", () => ({ default: () => null }));
vi.mock("../components/ConvocatoriaPrint", () => ({ default: React.forwardRef(() => null) }));
vi.mock("../components/ConvocationDeconvokeDialog", () => ({ default: () => null }));
vi.mock("../components/ConvocationMatchActionBar", () => ({ default: () => null }));

const headerPropsSpy = vi.fn();
vi.mock("../components/ConvocationMatchHeader", () => ({
  default: (props: any) => {
    headerPropsSpy(props);
    return <div data-testid="match-header">{props.match?.localTeamName ?? "sin-partido"}</div>;
  },
}));

vi.mock("../../../../../shared/components/ui/EmptyState/EmptyState", () => ({
  default: ({ description }: { description: string }) => <div data-testid="empty-state">{description}</div>,
}));

import ConvocationMatchDetail from "../ConvocationMatchDetail";

function renderAt(path: string, state?: unknown) {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={[state ? { pathname: path.split("?")[0], search: `?${path.split("?")[1] ?? ""}`, state } : path]}>
        <ConvocationMatchDetail />
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("ConvocationMatchDetail - recuperación del partido tras F5", () => {
  beforeEach(() => {
    getSportEventByIdMock.mockReset();
    // useConvocationManagement is mocked to always return mgmtEventId "event-1", which
    // triggers ConvocationMatchDetail's own (pre-existing) getSportEventById(mgmtEventId)
    // effect regardless of the F5-recovery path under test — give it a harmless default.
    getSportEventByIdMock.mockResolvedValue(null);
  });

  it("usa location.state.match directamente cuando existe, sin llamar a getSportEventById", async () => {
    const match = {
      date: "2026-09-10",
      time: "18:00",
      localTeamName: "Mi Equipo",
      localTeamShield: "",
      visitorTeamName: "Rival FC",
      visitorTeamShield: "",
      isFinished: false,
      isHomeTeam: true,
      field: "",
      codacta: null,
      selectedKitNumber: null,
      locationMapUrl: null,
      eventId: "event-1",
    };

    renderAt("/coach/convocations/match?teamId=team-1&eventId=event-1", { match });

    await waitFor(() => {
      expect(screen.getByTestId("match-header")).toHaveTextContent("Mi Equipo");
    });
    // The screen's pre-existing getSportEventById(mgmtEventId) effect still runs (it
    // refreshes selectedKitNumber/isFriendly), but the new F5-recovery fetch must NOT
    // fire when router state already carries the match — so the mock is called at most once.
    expect(getSportEventByIdMock).toHaveBeenCalledTimes(1);
  });

  it("recupera el partido vía getSportEventById cuando no hay state pero sí ?eventId= en la URL (F5)", async () => {
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      teamId: "team-1",
      isHomeMatch: true,
      eveDateTime: "2026-09-10T00:00:00Z",
      startTime: "2026-09-10T18:00:00Z",
      teamName: "Mi Equipo",
      rivalName: "Rival FC",
      matchCategory: "League",
    });

    renderAt("/coach/convocations/match?teamId=team-1&eventId=event-1");

    await waitFor(() => {
      expect(getSportEventByIdMock).toHaveBeenCalledWith("event-1");
    });

    await waitFor(() => {
      expect(screen.getByTestId("match-header")).toHaveTextContent("Mi Equipo");
    });
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("mantiene el mensaje de error actual cuando no hay ni state ni eventId en la URL", async () => {
    renderAt("/coach/convocations/match?teamId=team-1");

    await waitFor(() => {
      expect(screen.getByTestId("match-header")).toHaveTextContent("sin-partido");
    });
    // Only the screen's pre-existing getSportEventById(mgmtEventId) effect runs — no
    // ?eventId= in the URL means the new F5-recovery fetch must never fire.
    expect(getSportEventByIdMock).toHaveBeenCalledTimes(1);
    expect(getSportEventByIdMock).toHaveBeenCalledWith("event-1");
  });
});
