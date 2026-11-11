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
const updateConvocationsAssistanceBulkMock = vi.fn();
vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Asiste" },
      { id: 2, name: "No asiste" },
    ]),
    updateConvocationAssistance: (...args: unknown[]) =>
      updateConvocationAssistanceMock(...args),
    updateConvocationsAssistanceBulk: (...args: unknown[]) =>
      updateConvocationsAssistanceBulkMock(...args),
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

describe("AttendanceTabs - 'Todos asisten' error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rolesMock = ["Coach"];
    hasRoleMock.mockImplementation((role: string) => role === "Coach");
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue(buildAcceptedConvocations());
  });

  it("muestra un snackbar y no un alert nativo cuando falla la actualización", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("rffm.show_snackbar", listener);
    updateConvocationsAssistanceBulkMock.mockRejectedValue(new Error("Request failed with status code 500"));

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));
    await userEvent.click(await screen.findByRole("button", { name: /todos asisten/i }));

    await waitFor(() => expect(events.length).toBe(1));
    expect(events[0].detail.severity).toBe("error");
    expect(events[0].detail.message).toMatch(/asistencia/i);
    expect(alertSpy).not.toHaveBeenCalled();

    window.removeEventListener("rffm.show_snackbar", listener);
    alertSpy.mockRestore();
  });

  it("marca a todos con una única petición masiva", async () => {
    updateConvocationsAssistanceBulkMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));
    await userEvent.click(await screen.findByRole("button", { name: /todos asisten/i }));

    await waitFor(() =>
      expect(updateConvocationsAssistanceBulkMock).toHaveBeenCalledWith("event-1", ["conv-1"], 1)
    );
    expect(updateConvocationAssistanceMock).not.toHaveBeenCalled();
  });
});
