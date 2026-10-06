import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../services/profile/profileService", () => ({
  getMyAccount: vi.fn(),
  getMyMemberships: vi.fn(),
}));
vi.mock("../../../hooks/useFeaturePermission", () => ({
  useFeaturePermission: () => ({ hasAccess: false, loading: false }),
}));

import Profile from "../Profile";
import { UserProvider } from "../../../context/UserContext";
import { getMyAccount, getMyMemberships } from "../../../services/profile/profileService";

const account = {
  alias: "anag",
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "García",
  secondLastName: null,
  phoneNumber: null,
  avatarUrl: null,
};

function renderPage(state?: { from: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/profile", state }]}>
      <UserProvider>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/coach/team-dashboard" element={<div>Panel del equipo</div>} />
          <Route path="/appSelector" element={<div>Selector de app</div>} />
        </Routes>
      </UserProvider>
    </MemoryRouter>
  );
}

describe("Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("muestra las cuatro tarjetas al cargar", async () => {
    vi.mocked(getMyAccount).mockResolvedValue(account);
    vi.mocked(getMyMemberships).mockResolvedValue({ clubs: [], teams: [] });

    renderPage();

    expect(await screen.findByText("Datos personales")).toBeInTheDocument();
    expect(screen.getByText("Foto")).toBeInTheDocument();
    expect(screen.getByText("Contraseña")).toBeInTheDocument();
    expect(screen.getByText("Mis clubes y equipos")).toBeInTheDocument();
  });

  it("«Volver» lleva a la pantalla desde la que se abrió el perfil", async () => {
    vi.mocked(getMyAccount).mockResolvedValue(account);
    vi.mocked(getMyMemberships).mockResolvedValue({ clubs: [], teams: [] });

    renderPage({ from: "/coach/team-dashboard?teamId=t1" });
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.getByText("Panel del equipo")).toBeInTheDocument();
  });

  it("sin pantalla de origen, «Volver» lleva al selector de app", async () => {
    vi.mocked(getMyAccount).mockResolvedValue(account);
    vi.mocked(getMyMemberships).mockResolvedValue({ clubs: [], teams: [] });

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.getByText("Selector de app")).toBeInTheDocument();
  });

  it("permite reintentar si falla la carga", async () => {
    vi.mocked(getMyAccount).mockRejectedValueOnce(new Error("network")).mockResolvedValue(account);
    vi.mocked(getMyMemberships).mockResolvedValue({ clubs: [], teams: [] });

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Datos personales")).toBeInTheDocument();
  });
});
