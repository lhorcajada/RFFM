import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

let rolesMock: string[] = ["Coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    getUserId: () => "user-1",
    hasRole: (role: string) => rolesMock.includes(role),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../../services/configurationCoachService", () => ({
  default: {
    getCurrent: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../../services/seasonService", () => ({
  default: { getSeasons: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/pushSubscriptionService", () => ({
  isPushNotificationsSupported: () => false,
  getCurrentPushSubscriptionStatus: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import Settings from "../Settings";

function renderSettings() {
  return render(
    <UserProvider>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Settings - role-based section visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows all sections for a coach", async () => {
    rolesMock = ["Coach"];
    renderSettings();

    expect((await screen.findAllByText("Mis clubes")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Temporadas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mis equipos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notificaciones").length).toBeGreaterThan(0);
  });

  it("shows only Notificaciones for a player, defaulting to that section", async () => {
    rolesMock = ["Player"];
    renderSettings();

    expect((await screen.findAllByText("Notificaciones")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Mis clubes")).toHaveLength(0);
    expect(screen.queryAllByText("Temporadas")).toHaveLength(0);
    expect(screen.queryAllByText("Mis equipos")).toHaveLength(0);
    expect(
      screen.getByText(/tu navegador no soporta notificaciones push/i)
    ).toBeInTheDocument();
  });

  it("shows only Notificaciones for a family member, defaulting to that section", async () => {
    rolesMock = ["FamilyMember"];
    renderSettings();

    expect((await screen.findAllByText("Notificaciones")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Mis clubes")).toHaveLength(0);
    expect(screen.queryAllByText("Temporadas")).toHaveLength(0);
    expect(screen.queryAllByText("Mis equipos")).toHaveLength(0);
  });
});
