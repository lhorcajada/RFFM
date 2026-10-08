import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();
const addConvocationMock = vi.fn();
const updateConvocationStatusMock = vi.fn();
const deconvokeInjuredPlayersMock = vi.fn();

vi.mock("../../../services/convocationService", () => {
  const service = {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
    deleteConvocation: vi.fn(),
    deconvokeInjuredPlayers: (...args: unknown[]) => deconvokeInjuredPlayersMock(...args),
  };
  return { default: service, ...service };
});

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

const getRolesMock = vi.fn();

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: (...args: unknown[]) => getRolesMock(...args),
    hasRole: vi.fn().mockReturnValue(true),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import AttendanceTabs from "../AttendanceTabs";

const INJURED_PLAYER = {
  id: "injured-1",
  playerId: "injured-1",
  alias: "Lesionado Uno",
  urlPhoto: null,
  position: "LD",
  isInjured: true,
  injuryStartDate: null,
};

function renderTabs() {
  return render(
    <React.StrictMode>
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart="2030-01-10T20:00:00" />
      </MemoryRouter>
    </React.StrictMode>
  );
}

describe("AttendanceTabs — desconvocatoria automática de lesionados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue([INJURED_PLAYER]);
    getConvocationsMock.mockResolvedValue([]);
    deconvokeInjuredPlayersMock.mockResolvedValue(undefined);
  });

  it("como entrenador delega en el servidor la desconvocatoria de los lesionados del evento", async () => {
    getRolesMock.mockReturnValue(["Coach"]);

    renderTabs();

    await screen.findByRole("button", { name: /^Desconvocados/i });
    expect(deconvokeInjuredPlayersMock).toHaveBeenCalledWith("event-1");
  });

  it("nunca crea convocatorias desde el navegador al cargar, aunque la página se monte dos veces", async () => {
    getRolesMock.mockReturnValue(["Coach"]);

    renderTabs();

    await screen.findByRole("button", { name: /^Desconvocados/i });
    expect(addConvocationMock).not.toHaveBeenCalled();
    expect(updateConvocationStatusMock).not.toHaveBeenCalled();
  });

  it("como jugador no intenta desconvocar a los lesionados", async () => {
    getRolesMock.mockReturnValue(["Player"]);

    renderTabs();

    await screen.findByRole("button", { name: /^Desconvocados/i });
    expect(deconvokeInjuredPlayersMock).not.toHaveBeenCalled();
  });
});
