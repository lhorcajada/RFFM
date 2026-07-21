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

describe("AttendanceTabs - collapsible groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps player counters visible for all groups regardless of collapsed state", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveTextContent("1");
    });
  });

  it("collapses all 4 groups by default for a Coach", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");

    expect(screen.queryByText("Espera Uno")).not.toBeInTheDocument();
    expect(screen.queryByText("Pendiente Uno")).not.toBeInTheDocument();
    expect(screen.queryByText("Aceptado Uno")).not.toBeInTheDocument();
    expect(screen.queryByText("Desconvocado Uno")).not.toBeInTheDocument();
  });

  it("collapses all 4 groups by default for an Administrator", async () => {
    setup({ roles: ["Administrator"], playerId: null });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles a group open and closed on click", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs();

    const header = await screen.findByRole("button", { name: /^Aceptados/i });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Aceptado Uno")).not.toBeInTheDocument();

    await userEvent.click(header);
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "true"));
    expect(await screen.findByText("Aceptado Uno")).toBeInTheDocument();

    await userEvent.click(header);
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(screen.queryByText("Aceptado Uno")).not.toBeInTheDocument());
  });

  it("expands the waiting list group by default when the associated player is waiting", async () => {
    setup({ roles: ["Player"], playerId: "waiting-1" });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Espera Uno")).toBeInTheDocument();
  });

  it("expands the pending group by default when the associated player is pending (FamilyMember)", async () => {
    setup({ roles: ["FamilyMember"], playerId: "pending-1" });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Pendiente Uno")).toBeInTheDocument();
  });

  it("expands the accepted group by default when the associated player is accepted", async () => {
    setup({ roles: ["Player"], playerId: "accepted-1" });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Aceptado Uno")).toBeInTheDocument();
  });

  it("expands the desconvocados group by default when the associated player was declined", async () => {
    setup({ roles: ["FamilyMember"], playerId: "declined-1" });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Desconvocado Uno")).toBeInTheDocument();
  });

  it("collapses all groups when the Player/FamilyMember associated player is not found in any group (edge case)", async () => {
    setup({ roles: ["Player"], playerId: "unknown-player-id" });
    await renderTabs();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.getByRole("button", { name: /^Pendientes de aceptar/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Desconvocados/i })).toHaveAttribute("aria-expanded", "false");
  });
});
