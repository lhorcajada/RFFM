import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function ProfileProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "sin origen";
  return <div>{`Página de perfil desde ${from}`}</div>;
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/coach/dashboard?teamId=t1"]}>
      <UserProvider>
        <Routes>
          <Route path="/coach/dashboard" element={<AppHeader />} />
          <Route path="/profile" element={<ProfileProbe />} />
        </Routes>
      </UserProvider>
    </MemoryRouter>
  );
}

describe("AppHeader — perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("navega a /profile al elegir «Perfil» recordando la pantalla de origen", async () => {
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag" }));
    renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Perfil" }));

    expect(screen.getByText("Página de perfil desde /coach/dashboard?teamId=t1")).toBeInTheDocument();
  });

  it("muestra las iniciales del nombre y el primer apellido", () => {
    localStorage.setItem(
      "rffm_user",
      JSON.stringify({ id: "u1", username: "anag", firstName: "Ana", lastName: "García" })
    );
    renderHeader();

    expect(screen.getByText("AG")).toBeInTheDocument();
  });

  it("sin nombre, muestra la inicial del alias", () => {
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "anag" }));
    renderHeader();

    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
