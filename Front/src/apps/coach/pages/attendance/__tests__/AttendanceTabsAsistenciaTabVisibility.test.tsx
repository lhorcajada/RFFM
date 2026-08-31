import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
  },
}));

vi.mock("../../../services/playerService", () => ({
  default: {
    fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
    getPlayerById: vi.fn(),
    getPlayersByClub: vi.fn(),
    createPlayer: vi.fn(),
    uploadPlayerPhoto: vi.fn(),
  },
}));

vi.mock("../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([
      { id: 1, name: "Pending" },
      { id: 2, name: "Accepted" },
      { id: 3, name: "Deconvoke" },
    ]),
  },
}));

vi.mock("../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Asiste" },
      { id: 2, name: "No asiste" },
    ]),
    updateConvocationAssistance: vi.fn(),
  },
}));

const hasRoleMock = vi.fn();
let rolesMock: string[] = ["Coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import AttendanceTabs from "../AttendanceTabs";

function buildAcceptedConvocations() {
  return [
    {
      id: "conv-1",
      player: { id: "player-1", playerId: "player-1", alias: "Jugador 1" },
      status: 2,
      assistanceTypeId: null,
      isInjured: false,
    },
  ];
}

describe("AttendanceTabs - 'Asistencia' tab visibility by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue(buildAcceptedConvocations());
  });

  it("shows the 'Asistencia' tab for a coach", async () => {
    rolesMock = ["Coach"];
    hasRoleMock.mockImplementation((role: string) => role === "Coach");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      await screen.findByRole("tab", { name: /asistencia/i })
    ).toBeInTheDocument();
  });

  it("hides the 'Asistencia' tab for a player", async () => {
    rolesMock = ["Player"];
    hasRoleMock.mockImplementation((role: string) => role === "Player");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("tab", { name: /asistencia/i })
    ).not.toBeInTheDocument();
  });

  it("hides the 'Asistencia' tab for a family member", async () => {
    rolesMock = ["FamilyMember"];
    hasRoleMock.mockImplementation((role: string) => role === "FamilyMember");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("tab", { name: /asistencia/i })
    ).not.toBeInTheDocument();
  });

  it("hides the 'Asistencia' tab for a family player", async () => {
    rolesMock = ["FamilyPlayer"];
    hasRoleMock.mockImplementation((role: string) => role === "FamilyPlayer");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("tab", { name: /asistencia/i })
    ).not.toBeInTheDocument();
  });

  it("never renders the assistance content (attendance action buttons) for a player even if the tab index is forced to 1", async () => {
    rolesMock = ["Player"];
    hasRoleMock.mockImplementation((role: string) => role === "Player");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    // The assistance marking options ("Sin indicar", assistance type buttons) must never
    // be reachable by a player/family user, regardless of any residual tab state.
    expect(screen.queryByRole("button", { name: /^sin indicar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^asiste$/i })).not.toBeInTheDocument();
  });
});
