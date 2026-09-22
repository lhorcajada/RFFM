import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSettingsForUser = vi.fn();

vi.mock("../../../../../shared/context/UserContext", () => ({
  useUser: () => ({ user: { id: "u1" } }),
}));
vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasons: [{ id: 22, label: "2026-2027" }],
    currentSeasonId: 22,
  }),
}));
vi.mock("../../../services/federationApi", () => ({
  getSettingsForUser: (...a: unknown[]) => getSettingsForUser(...a),
}));
vi.mock("../../../../coach/services/authService", () => ({
  coachAuthService: { isAuthenticated: () => true },
}));
vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock(
  "../../../../../shared/components/ui/ContentLayout/ContentLayout",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);

import Dashboard from "../Dashboard";

describe("Dashboard — equipo preferido", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el equipo marcado como principal en la configuración", async () => {
    getSettingsForUser.mockResolvedValue([
      {
        id: "c1",
        teamId: "t1",
        teamName: "CD Ejemplo",
        competitionName: "Liga Alevín",
        groupName: "Grupo 3",
        seasonId: 22,
        isPrimary: true,
      },
      {
        id: "c2",
        teamId: "t2",
        teamName: "Otro equipo",
        isPrimary: false,
      },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("CD Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Equipo preferido")).toBeInTheDocument();
    expect(screen.getByText("Liga Alevín")).toBeInTheDocument();
    expect(screen.getByText("Grupo 3")).toBeInTheDocument();
    expect(screen.getByText("Temporada 2026-2027")).toBeInTheDocument();
  });

  it("invita a configurar un equipo cuando no hay ninguno guardado", async () => {
    getSettingsForUser.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /No tienes ningún equipo preferido configurado/i,
      ),
    ).toBeInTheDocument();
  });
});
