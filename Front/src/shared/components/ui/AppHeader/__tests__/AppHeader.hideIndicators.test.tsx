import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

let pendingSanctionsMock: { visible: boolean; count: number; teamId: string | null } = {
  visible: false,
  count: 0,
  teamId: null,
};
vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => pendingSanctionsMock,
}));

let teamFundMock: { visible: boolean; balance: number | null; teamId: string | null } = {
  visible: false,
  balance: null,
  teamId: null,
};
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => teamFundMock,
}));

vi.mock("../../../../hooks/useAuthToken", () => ({
  default: () => ({ isAuthValid: true, token: "fake-token", refresh: vi.fn() }),
}));

vi.mock("../../../../hooks/useRootClassObserver", () => ({
  default: () => {},
}));

vi.mock("../../../../services/notificationService", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "rffm.notifications_changed",
  searchNotifications: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import AppHeader from "../AppHeader";

function renderHeader(initialPath: string, hideIndicators = false) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UserProvider>
        <AppHeader hideIndicators={hideIndicators} />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — hideIndicators (selector de aplicación)", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    pendingSanctionsMock = { visible: false, count: 0, teamId: null };
    teamFundMock = { visible: true, balance: 250, teamId: "team-1" };
  });

  it("no muestra la hucha del equipo", () => {
    renderHeader("/", true);

    expect(screen.queryByRole("button", { name: /250 €/i })).not.toBeInTheDocument();
  });

  it("no muestra las notificaciones", () => {
    renderHeader("/", true);

    expect(screen.queryByRole("button", { name: /notificaciones/i })).not.toBeInTheDocument();
  });

  it("sigue mostrando la hucha y las notificaciones por defecto", () => {
    renderHeader("/coach/dashboard");

    expect(screen.getByRole("button", { name: /250 €/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument();
  });
});
