import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const updateConvocationAssistanceMock = vi.fn();
vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Asiste" },
      { id: 2, name: "No asiste" },
    ]),
    updateConvocationAssistance: (...args: unknown[]) =>
      updateConvocationAssistanceMock(...args),
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

describe("AttendanceTabs - 'Todos asisten' button visibility by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue(buildAcceptedConvocations());
  });

  it("shows 'Todos asisten' for a coach", async () => {
    rolesMock = ["Coach"];
    hasRoleMock.mockImplementation((role: string) => role === "Coach");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));

    expect(
      await screen.findByRole("button", { name: /todos asisten/i })
    ).toBeInTheDocument();
  });

  it("hides 'Todos asisten' for a player", async () => {
    rolesMock = ["Player"];
    hasRoleMock.mockImplementation((role: string) => role === "Player");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("button", { name: /todos asisten/i })
    ).not.toBeInTheDocument();
  });

  it("hides 'Todos asisten' for a family member", async () => {
    rolesMock = ["FamilyMember"];
    hasRoleMock.mockImplementation((role: string) => role === "FamilyMember");

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));

    await waitFor(() => expect(getConvocationsMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("button", { name: /todos asisten/i })
    ).not.toBeInTheDocument();
  });
});
