import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => ({ visible: false, count: 0, teamId: null }),
}));

let teamFundMock: { visible: boolean; balance: number | null; teamId: string | null } = {
  visible: false,
  balance: null,
  teamId: null,
};
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => teamFundMock,
}));

let walletMock: { visible: boolean; balance: number | null; teamId: string | null } = {
  visible: false,
  balance: null,
  teamId: null,
};
vi.mock("../../../../hooks/useQuinielaWalletBalance", () => ({
  default: () => walletMock,
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

function renderHeader(initialPath = "/coach/dashboard", hideIndicators = false) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UserProvider>
        <AppHeader hideIndicators={hideIndicators} />
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — saldo del monedero de la quiniela", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    teamFundMock = { visible: true, balance: 250, teamId: "team-1" };
    walletMock = { visible: true, balance: 3, teamId: "team-1" };
  });

  it("muestra el monedero y la hucha como dos botones distintos con aria-label diferente", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: /Monedero: 3,00\s€/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hucha del equipo: 250\s€/ })).toBeInTheDocument();
  });

  it("no muestra el monedero en la app de federación", () => {
    renderHeader("/federation/dashboard");

    expect(screen.queryByRole("button", { name: /Monedero/ })).not.toBeInTheDocument();
  });

  it("no muestra el monedero con hideIndicators", () => {
    renderHeader("/", true);

    expect(screen.queryByRole("button", { name: /Monedero/ })).not.toBeInTheDocument();
  });

  it("no muestra el monedero si el hook no es visible", () => {
    walletMock = { visible: false, balance: null, teamId: null };

    renderHeader();

    expect(screen.queryByRole("button", { name: /Monedero/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hucha del equipo/ })).toBeInTheDocument();
  });

  it("navega a la quiniela del equipo al pulsar el monedero", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    walletMock = { visible: true, balance: 3, teamId: "team-9" };

    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: /Monedero: 3,00\s€/ }));

    expect(navigateMock).toHaveBeenCalledWith("/coach/quiniela?teamId=team-9");
  });
});
