import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamResponse } from "../../../../services/teamService";

const mockUseUserTeams = vi.fn();
vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => mockUseUserTeams() }));
vi.mock("../../hooks/useTeamPhotos", () => ({ useTeamPhotos: () => ({}) }));

const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

import DashboardCards from "../DashboardCards";

function makeTeam(id: string, name: string): TeamResponse {
  return {
    id,
    name,
    category: { id: 1, name: "Alevín F7" },
    league: {},
    club: { id: "club-1", name: "CD Barrio", country: { id: 1, name: "España", code: "ES" } },
    canEdit: true,
    standardHalfDurationMinutes: null,
  };
}

function renderCards(layout: "mobile" | "tablet" | "desktop") {
  return render(
    <MemoryRouter>
      <DashboardCards selectedSeason="" layout={layout} />
    </MemoryRouter>,
  );
}

describe("DashboardCards — presentación según el tamaño de pantalla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeatureAccess.mockReturnValue(true);
    mockUseUserTeams.mockReturnValue({
      teams: [makeTeam("t1", "Alevín A"), makeTeam("t2", "Cadete A")],
      loading: false,
      error: null,
    });
  });

  it("en escritorio muestra la rejilla «Acceso rápido» con una tarjeta por equipo", () => {
    renderCards("desktop");

    const grid = screen.getByRole("list", { name: /acceso rápido/i });
    expect(within(grid).getByRole("link", { name: /alevín a/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=t1",
    );
    expect(within(grid).getByRole("link", { name: /^Configuración$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Inicio$/i })).not.toBeInTheDocument();
  });

  it("en tablet también usa la rejilla y no la lista móvil", () => {
    renderCards("tablet");

    expect(screen.getByRole("list", { name: /acceso rápido/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /mis equipos/i })).not.toBeInTheDocument();
  });

  it("en móvil muestra la lista «Mis equipos» y los botones Configuración e Inicio", () => {
    renderCards("mobile");

    const list = screen.getByRole("list", { name: /mis equipos/i });
    expect(within(list).getByRole("link", { name: /cadete a/i })).toHaveAttribute(
      "href",
      "/coach/team-dashboard?teamId=t2",
    );
    expect(screen.getByRole("link", { name: /^Configuración$/i })).toHaveAttribute("href", "/coach/settings");
    expect(screen.getByRole("link", { name: /^Inicio$/i })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("list", { name: /acceso rápido/i })).not.toBeInTheDocument();
  });

  it("muestra el contador de equipos", () => {
    renderCards("desktop");

    expect(screen.getByText("2 equipos")).toBeInTheDocument();
  });

  it("usa el singular cuando solo hay un equipo", () => {
    mockUseUserTeams.mockReturnValue({ teams: [makeTeam("t1", "Alevín A")], loading: false, error: null });

    renderCards("mobile");

    expect(screen.getByText("1 equipo")).toBeInTheDocument();
  });

  it("en móvil no muestra Configuración cuando no hay permiso", () => {
    mockHasFeatureAccess.mockReturnValue(false);

    renderCards("mobile");

    expect(screen.queryByRole("link", { name: /^Configuración$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inicio$/i })).toBeInTheDocument();
  });

  it("no muestra el acceso rápido a un jugador o familiar", () => {
    render(
      <MemoryRouter>
        <DashboardCards selectedSeason="" layout="mobile" isPlayer />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("list", { name: /mis equipos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Configuración$/i })).not.toBeInTheDocument();
  });
});
