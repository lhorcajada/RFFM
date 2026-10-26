import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();

vi.mock("../../../services/convocationService", () => ({
  default: {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
    deconvokeInjuredPlayers: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([
      { id: 1, name: "Pending" },
      { id: 2, name: "Accepted" },
      { id: 5, name: "Deconvoke" },
    ]),
  },
}));

vi.mock("../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: { getAssistanceTypes: vi.fn().mockResolvedValue([]), updateConvocationAssistance: vi.fn() },
}));

vi.mock("../../../services/availabilityService", () => ({
  default: { getAvailabilityRequests: vi.fn().mockResolvedValue([]) },
}));

const getRolesMock = vi.fn();
const hasRoleMock = vi.fn();

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: (...args: unknown[]) => getRolesMock(...args),
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue({ roleName: "Player", playerId: "own-1" }),
}));

import AttendanceTabs from "../AttendanceTabs";

const OWN_ACCEPTED = {
  id: "conv-own",
  player: { id: "own-1", playerId: "own-1", alias: "Araque", urlPhoto: null, position: "Medio Centro Defensivo" },
  status: 2,
  isInjured: false,
};

const PAST_START = "2020-01-01T10:00:00Z";
const FUTURE_START = "2999-01-01T10:00:00Z";

function setupRoles(roles: string[]) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
}

function renderTabs(eventStart: string) {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={eventStart} isMatch />
    </MemoryRouter>,
  );
}

describe("AttendanceTabs — jugador propio en un evento ya empezado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue([OWN_ACCEPTED]);
  });

  it.each(["Player", "FamilyMember"])("no ofrece desconvocar a %s cuando el evento ya ha empezado", async (role) => {
    setupRoles([role]);
    renderTabs(PAST_START);

    await screen.findByText("Araque");

    expect(screen.queryByRole("button", { name: "Desconvocar" })).not.toBeInTheDocument();
  });

  it("ofrece desconvocar a un jugador cuando el evento aún no ha empezado", async () => {
    setupRoles(["Player"]);
    renderTabs(FUTURE_START);

    expect(await screen.findByRole("button", { name: "Desconvocar" })).toBeInTheDocument();
  });
});
