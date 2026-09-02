import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
vi.mock("../components/ConvocatoriaPrint", () => ({ default: React.forwardRef(() => null) }));
vi.mock("../components/ConvocationMatchHeader", () => ({ default: () => null }));
vi.mock("../components/ConvocationMatchActionBar", () => ({ default: () => null }));
vi.mock("../components/ConvocationDeconvokeDialog", () => ({ default: () => null }));

vi.mock("../components/PartidoEnDirectoTab", () => ({
  default: (props: { isFriendly?: boolean }) => (
    <div data-testid="partido-en-directo" data-friendly={String(!!props.isFriendly)} />
  ),
}));

import ConvocationMatchDetail from "../ConvocationMatchDetail";

function renderPage() {
  render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/convocations/match?teamId=team-1"]}>
        <ConvocationMatchDetail />
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("ConvocationMatchDetail - threading isFriendly into the live tracker", () => {
  beforeEach(() => {
    getSportEventByIdMock.mockReset();
  });

  it("passes isFriendly=true to PartidoEnDirectoTab when matchCategory is Friendly", async () => {
    getSportEventByIdMock.mockResolvedValue({ id: "event-1", matchCategory: "Friendly" });
    renderPage();

    await userEvent.click(screen.getByText("Partido en Directo"));

    await waitFor(() =>
      expect(screen.getByTestId("partido-en-directo")).toHaveAttribute("data-friendly", "true"),
    );
    expect(getSportEventByIdMock).toHaveBeenCalledWith("event-1");
  });

  it("passes isFriendly=false to PartidoEnDirectoTab when matchCategory is not Friendly", async () => {
    getSportEventByIdMock.mockResolvedValue({ id: "event-1", matchCategory: "League" });
    renderPage();

    await userEvent.click(screen.getByText("Partido en Directo"));

    await waitFor(() =>
      expect(screen.getByTestId("partido-en-directo")).toHaveAttribute("data-friendly", "false"),
    );
  });
});
