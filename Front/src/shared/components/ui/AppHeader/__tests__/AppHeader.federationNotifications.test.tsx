import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => ({ visible: false, count: 0, teamId: null }),
}));
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => ({ visible: false, balance: 0, teamId: null }),
}));
vi.mock("../../../../hooks/useAuthToken", () => ({
  default: () => ({ isAuthValid: true, token: "fake-token", refresh: vi.fn() }),
}));
vi.mock("../../../../hooks/useRootClassObserver", () => ({
  default: () => {},
}));
vi.mock("../../FederationNotificationsBell/FederationNotificationsBell", () => ({
  default: () => <button type="button">Notificaciones</button>,
}));

import AppHeader from "../AppHeader";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UserProvider>
        <AppHeader />
      </UserProvider>
    </MemoryRouter>,
  );
}

describe("AppHeader — campana de notificaciones de Federación", () => {
  it("muestra la campana en las páginas de Federación", () => {
    renderAt("/federation/get-players");
    expect(screen.getByRole("button", { name: /notificaciones/i })).toBeInTheDocument();
  });

  it("no muestra la campana en Coach", () => {
    renderAt("/coach/dashboard");
    expect(screen.queryByRole("button", { name: /notificaciones/i })).not.toBeInTheDocument();
  });
});
