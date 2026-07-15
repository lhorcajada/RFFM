import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();
const addConvocationMock = vi.fn();
const addConvocationsBulkMock = vi.fn();
const updateConvocationStatusMock = vi.fn();
const deleteConvocationMock = vi.fn();

vi.mock("../../../services/convocationService", () => ({
  default: {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    addConvocationsBulk: (...args: unknown[]) => addConvocationsBulkMock(...args),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
    deleteConvocation: (...args: unknown[]) => deleteConvocationMock(...args),
  },
  getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
  addConvocation: (...args: unknown[]) => addConvocationMock(...args),
  addConvocationsBulk: (...args: unknown[]) => addConvocationsBulkMock(...args),
  updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
  deleteConvocation: (...args: unknown[]) => deleteConvocationMock(...args),
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
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
    updateConvocationAssistance: vi.fn(),
  },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: vi.fn().mockReturnValue(["Coach"]),
    hasRole: vi.fn().mockReturnValue(true),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import AttendanceTabs from "../AttendanceTabs";

function buildWaitingList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    playerId: `player-${i}`,
    alias: `Jugador ${i}`,
    urlPhoto: null,
    position: "MC",
    isInjured: false,
    injuryStartDate: null,
  }));
}

describe("AttendanceTabs - waiting list bulk convocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue(buildWaitingList(20));
    getConvocationsMock.mockResolvedValue([]);
    addConvocationsBulkMock.mockResolvedValue(undefined);
  });

  it("calls addConvocationsBulk once and never calls addConvocation when clicking 'Convocar toda la lista de espera'", async () => {
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", {
      name: /convocar toda la lista de espera/i,
    });

    await userEvent.click(button);

    await waitFor(() => expect(addConvocationsBulkMock).toHaveBeenCalledTimes(1));
    expect(addConvocationsBulkMock).toHaveBeenCalledWith("event-1");
    expect(addConvocationMock).not.toHaveBeenCalled();
  });
});
