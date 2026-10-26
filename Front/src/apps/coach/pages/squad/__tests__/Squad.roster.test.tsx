import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { getPlayersByTeamMock, getRolesMock, getMyProfileMock, stableTeam } = vi.hoisted(() => ({
  stableTeam: { id: "team-1", name: "Alevín A" },
  getPlayersByTeamMock: vi.fn(),
  getRolesMock: vi.fn(),
  getMyProfileMock: vi.fn(),
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  __esModule: true,
  default: () => ({
    team: stableTeam,
    teamTitleNode: "Alevín A",
    clubSubtitleNode: null,
    loading: false,
  }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  __esModule: true,
  default: () => vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: { getRoles: getRolesMock },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: getMyProfileMock,
}));

vi.mock("../../../services/teamplayerService", () => ({
  __esModule: true,
  default: { getPlayersByTeam: getPlayersByTeamMock },
  dischargeActiveInjury: vi.fn(),
}));

vi.mock("../../../services/playerService", () => ({
  __esModule: true,
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/playerRatingService", () => ({
  __esModule: true,
  default: { getTeamLatestRatings: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/teamPlayerStatisticsService", () => ({
  __esModule: true,
  getTeamPlayerStatistics: vi.fn().mockResolvedValue([]),
  default: { getTeamPlayerStatistics: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/leagueStatsService", () => ({
  __esModule: true,
  getTeamLeagueStats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../components/SquadRatings", () => ({ __esModule: true, default: () => <div>SquadRatings</div> }));
vi.mock("../components/SquadRanking", () => ({ __esModule: true, default: () => <div>SquadRanking</div> }));
vi.mock("../components/IdealLineup", () => ({ __esModule: true, default: () => <div>IdealLineup</div> }));
vi.mock("../components/SquadStatistics", () => ({ __esModule: true, default: () => <div>SquadStatistics</div> }));

import Squad from "../Squad";

function renderSquad() {
  return render(
    <MemoryRouter initialEntries={["/coach/squad?teamId=team-1"]}>
      <Squad />
    </MemoryRouter>,
  );
}

describe("Squad — pestañas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([]);
  });

  it("el entrenador ve las cinco pestañas", async () => {
    getRolesMock.mockReturnValue(["coach"]);

    renderSquad();

    for (const name of ["Plantilla", "Valoraciones", "Estadísticas", "Ranking", "Alineación ideal"]) {
      expect(await screen.findByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("el aficionado solo ve la pestaña Plantilla", async () => {
    getRolesMock.mockReturnValue(["fan"]);

    renderSquad();

    expect(await screen.findByRole("tab", { name: "Plantilla" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("el jugador no ve Ranking ni Alineación ideal", async () => {
    getRolesMock.mockReturnValue(["player"]);

    renderSquad();

    expect(await screen.findByRole("tab", { name: "Valoraciones" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Ranking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Alineación ideal" })).not.toBeInTheDocument();
  });

  it("las pestañas no usan scroll horizontal", async () => {
    getRolesMock.mockReturnValue(["coach"]);

    const { container } = renderSquad();

    await screen.findByRole("tab", { name: "Plantilla" });
    expect(container.querySelector(".MuiTabs-scrollableX")).toBeNull();
  });
});

describe("Squad — pestaña Plantilla: resumen, filtros y buscador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRolesMock.mockReturnValue(["coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", name: "Juan", lastName: "Pérez", alias: "Juanito", position: "Portero", dorsal: 1 },
      { id: "tp-2", name: "Luis", lastName: "Gómez", position: "Central", dorsal: 4, isInjured: true },
      { id: "tp-3", name: "Ana", lastName: "Ruiz", position: "Delantero centro", dorsal: 9 },
    ]);
  });

  it("muestra el resumen con el total y los lesionados", async () => {
    renderSquad();

    await screen.findByText("Juanito");
    expect((screen.getByText("Jugadores").parentElement as HTMLElement)).toHaveTextContent("3");
    expect((screen.getByText("Lesionados").parentElement as HTMLElement)).toHaveTextContent("1");
  });

  it("filtra por posición al pulsar un chip", async () => {
    renderSquad();
    await screen.findByText("Juanito");

    await userEvent.click(screen.getByRole("button", { name: "Delanteros" }));

    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Juanito")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delanteros" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtra por nombre o alias con el buscador", async () => {
    renderSquad();
    await screen.findByText("Juanito");

    await userEvent.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "juan");

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Ana Ruiz")).not.toBeInTheDocument();
  });

  it("sin coincidencias muestra el estado vacío y «Quitar filtros» restaura la lista", async () => {
    renderSquad();
    await screen.findByText("Juanito");

    await userEvent.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "zzz");

    expect(screen.getByText(/no hay jugadores/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /quitar filtros/i }));

    await waitFor(() => expect(screen.getByText("Juanito")).toBeInTheDocument());
  });
});
