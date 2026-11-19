import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../context/UserContext";

vi.mock("../../../../hooks/useMyPendingSanctionsCount", () => ({
  default: () => ({ visible: false, count: 0, teamId: null }),
}));
vi.mock("../../../../hooks/useTeamFundBalance", () => ({
  default: () => ({ visible: false, balance: null, teamId: null }),
}));
vi.mock("../../../../hooks/useAuthToken", () => ({
  default: () => ({ isAuthValid: true, token: "fake-token", refresh: vi.fn() }),
}));
vi.mock("../../../../hooks/useRootClassObserver", () => ({
  default: () => {},
}));
vi.mock("../../NotificationsBell/NotificationsBell", () => ({
  default: () => null,
}));
vi.mock("../../AppVersionInfo/AppVersionInfo", () => ({
  default: () => null,
}));
vi.mock("../../../../services/profile/profileService", () => ({
  getMyAccount: vi.fn(() => new Promise(() => {})),
}));

import AppHeader from "../AppHeader";

function renderHeader(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UserProvider>
        <Routes>
          <Route path="/coach/dashboard" element={<AppHeader />} />
          <Route path="/federation/dashboard" element={<AppHeader />} />
          <Route path="/coach/ai-settings" element={<div>Página de ajustes de IA</div>} />
        </Routes>
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — Ajustes de IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag" }));
  });

  it("navega a la página de ajustes de IA al elegir «Ajustes de IA» en el menú del avatar", async () => {
    renderHeader("/coach/dashboard");

    await userEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes de IA" }));

    expect(screen.getByText("Página de ajustes de IA")).toBeInTheDocument();
  });

  it("no ofrece «Ajustes de IA» en la app de Federación", async () => {
    renderHeader("/federation/dashboard");

    await userEvent.click(screen.getByRole("button", { name: /abrir menú/i }));

    expect(screen.queryByRole("menuitem", { name: "Ajustes de IA" })).not.toBeInTheDocument();
  });
});
