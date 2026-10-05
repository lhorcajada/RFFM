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
vi.mock("../../NotificationsBell/NotificationsBell", () => ({
  default: ({ app }: { app: string }) => <button type="button">{`Notificaciones ${app}`}</button>,
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

describe("AppHeader — campana de notificaciones", () => {
  it("muestra la campana de Federación en las páginas de Federación", () => {
    renderAt("/federation/get-players");
    expect(screen.getByRole("button", { name: "Notificaciones federation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notificaciones coach" })).not.toBeInTheDocument();
  });

  it("muestra la campana de Coach en las páginas de Coach", () => {
    renderAt("/coach/dashboard");
    expect(screen.getByRole("button", { name: "Notificaciones coach" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notificaciones federation" })).not.toBeInTheDocument();
  });
});
