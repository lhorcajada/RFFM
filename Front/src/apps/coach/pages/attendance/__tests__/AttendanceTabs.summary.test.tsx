import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
  addConvocation: vi.fn(),
  addConvocationsBulk: vi.fn(),
  updateConvocationStatus: vi.fn(),
  deleteConvocation: vi.fn(),
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

const getMyProfileMock = vi.fn();

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
}));

import AttendanceTabs from "../AttendanceTabs";

const WAITING_PLAYER = {
  id: "waiting-1",
  playerId: "waiting-1",
  alias: "Espera Uno",
  urlPhoto: null,
  position: "MC",
  isInjured: false,
  injuryStartDate: null,
};

const PENDING_CONV = {
  id: "conv-pending-1",
  player: {
    id: "pending-1",
    playerId: "pending-1",
    alias: "Pendiente Uno",
    urlPhoto: null,
    position: "DF",
  },
  status: 1,
  isInjured: false,
};

const ACCEPTED_CONV = {
  id: "conv-accepted-1",
  player: {
    id: "accepted-1",
    playerId: "accepted-1",
    alias: "Aceptado Uno",
    urlPhoto: null,
    position: "DL",
  },
  status: 2,
  isInjured: false,
};

const DECLINED_CONV = {
  id: "conv-declined-1",
  player: {
    id: "declined-1",
    playerId: "declined-1",
    alias: "Desconvocado Uno",
    urlPhoto: null,
    position: "PT",
  },
  status: 3,
  isInjured: false,
  excuseTypeId: null,
};

function setup({ roles, playerId }: { roles: string[]; playerId: string | null }) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role) || roles.includes("Administrator"));
  getMyProfileMock.mockResolvedValue(playerId ? { roleName: roles[0], playerId } : null);
  getEventPlayersMock.mockResolvedValue([WAITING_PLAYER]);
  getConvocationsMock.mockResolvedValue([PENDING_CONV, ACCEPTED_CONV, DECLINED_CONV]);
}

async function renderTabs() {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
    </MemoryRouter>
  );
  // Wait for data to load
  await screen.findByRole("button", { name: /^Lista de espera/i });
}

function summaryValue(label: string): string | null {
  const summary = screen.getByRole("region", { name: "Resumen de la convocatoria" });
  return within(summary).getByText(label).closest("li")?.textContent ?? null;
}

describe("AttendanceTabs - resumen de la convocatoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cuenta convocados, aceptados, pendientes y bajas de un entrenamiento", async () => {
    setup({ roles: ["Coach"], playerId: null });
    getConvocationsMock.mockResolvedValue([
      PENDING_CONV,
      ACCEPTED_CONV,
      { ...ACCEPTED_CONV, id: "conv-accepted-2", player: { ...ACCEPTED_CONV.player, id: "accepted-2", playerId: "accepted-2" } },
      DECLINED_CONV,
    ]);
    await renderTabs();

    await waitFor(() => expect(summaryValue("Convocados")).toBe("3Convocados"));
    expect(summaryValue("Van")).toBe("2Van");
    expect(summaryValue("Pendientes")).toBe("1Pendientes");
    expect(summaryValue("Bajas")).toBe("1Bajas");
  });

  it("no cuenta como convocados a los desconvocados: la cabecera de la lista coincide con el resumen", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs();

    await waitFor(() => expect(summaryValue("Convocados")).toBe("2Convocados"));
    const summary = screen.getByRole("region", { name: "Resumen de la convocatoria" });
    const header = screen
      .getAllByText("Convocados", { selector: "span" })
      .find((el) => !summary.contains(el));
    expect(header?.nextElementSibling).toHaveTextContent("2");
  });

  it("incluye al jugador propio en las cifras", async () => {
    setup({ roles: ["Player"], playerId: "accepted-1" });
    await renderTabs();

    await screen.findByRole("region", { name: "Tu jugador" });
    expect(summaryValue("Van")).toBe("1Van");
  });
});
