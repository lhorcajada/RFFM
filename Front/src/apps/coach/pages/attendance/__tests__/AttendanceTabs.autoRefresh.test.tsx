import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();
let capturedRefresh: (() => void) | null = null;

vi.mock("../../../hooks/useAutoRefresh", () => ({
  default: (cb: () => void) => {
    capturedRefresh = cb;
  },
}));

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
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
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
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
    updateConvocationAssistance: vi.fn(),
  },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: (role: string) => role === "Coach",
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../components/NotifyPendingConvocationDialog", () => ({
  default: () => null,
}));

import AttendanceTabs from "../AttendanceTabs";

function conv(status: number) {
  return {
    id: "conv-p1",
    player: { id: "p1", playerId: "p1", alias: "Jugador Uno", urlPhoto: null },
    status,
    isInjured: false,
  };
}

describe("AttendanceTabs - autorefresco de la convocatoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedRefresh = null;
    getEventPlayersMock.mockResolvedValue([]);
  });

  it("muestra al jugador como aceptado tras el refresco automático cuando acepta la convocatoria", async () => {
    getConvocationsMock.mockResolvedValue([conv(1)]);
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await screen.findByRole("button", { name: /^Pendientes de aceptar/i });

    getConvocationsMock.mockResolvedValue([conv(2)]);
    await act(async () => {
      capturedRefresh?.();
    });

    expect(await screen.findByRole("button", { name: /^Aceptados/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pendientes de aceptar/i })).not.toBeInTheDocument();
  });

  it("muestra al jugador como desconvocado tras el refresco automático cuando rechaza la convocatoria", async () => {
    getConvocationsMock.mockResolvedValue([conv(1)]);
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await screen.findByRole("button", { name: /^Pendientes de aceptar/i });

    getConvocationsMock.mockResolvedValue([conv(3)]);
    await act(async () => {
      capturedRefresh?.();
    });

    expect(await screen.findByRole("button", { name: /^Desconvocados/i })).toBeInTheDocument();
  });

  it("no oculta la convocatoria con el indicador de carga durante el refresco", async () => {
    getConvocationsMock.mockResolvedValue([conv(1)]);
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await screen.findByRole("button", { name: /^Pendientes de aceptar/i });

    getConvocationsMock.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      capturedRefresh?.();
    });

    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
  });
});
