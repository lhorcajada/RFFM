import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

const mockUseTeamAndClub = vi.fn();
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => mockUseTeamAndClub(),
}));

const teamAndClubWithoutTeam = {
  teamTitleNode: <span>Equipo 1</span>,
  clubSubtitleNode: <span>Club 1</span>,
  team: null,
};

const teamAndClubWithClub = {
  ...teamAndClubWithoutTeam,
  team: { id: "team-1", name: "Equipo 1", club: { id: "club-42", name: "Club 1" } },
};

const mockUsePlayerAutoLoad = vi.fn();
vi.mock("../../Dashboard/hooks/usePlayerAutoLoad", () => ({
  usePlayerAutoLoad: () => mockUsePlayerAutoLoad(),
}));

vi.mock("../components/UpcomingEventsWidget", () => ({
  default: () => <div>upcoming-events-widget</div>,
}));

vi.mock("../components/NewsWidget", () => ({
  default: () => <div>news-widget</div>,
}));

vi.mock("../components/LeagueSnapshot", () => ({
  default: ({ isPlayer }: { isPlayer: boolean }) => <div>{`league-snapshot-${isPlayer ? "player" : "coach"}`}</div>,
}));

vi.mock("../components/QuickActions", () => ({
  default: ({ teamId }: { teamId: string | null }) => <div>{`quick-actions-${teamId}`}</div>,
}));

vi.mock("../../../components/PushActivationBanner/PushActivationBanner", () => ({
  default: () => <div>push-activation-banner</div>,
}));

import TeamDashboard from "../TeamDashboard";

describe("TeamDashboard back button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithoutTeam);
  });

  it("no muestra ningún botón de volver cuando el usuario es jugador o familiar", () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument();
  });

  it("shows 'Volver' and navigates to /coach/dashboard when the user is a coach", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Volver" });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/coach/dashboard");
  });
});

describe("TeamDashboard botón Ir al club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navega al dashboard del club del equipo cuando el usuario es entrenador", async () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithClub);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Ir al club" }));

    expect(mockNavigate).toHaveBeenCalledWith("/coach/clubs/dashboard/club-42");
  });

  it("no muestra el botón Ir al club cuando el usuario es jugador o familiar", () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithClub);

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Ir al club" })).not.toBeInTheDocument();
  });

  it("no muestra el botón Ir al club cuando el equipo no tiene club cargado", () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithoutTeam);

    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Ir al club" })).not.toBeInTheDocument();
  });
});

describe("TeamDashboard — A la vista section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: false });
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithoutTeam);
  });

  it("muestra los widgets de próximos eventos y noticias", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("upcoming-events-widget")).toBeInTheDocument();
    expect(screen.getByText("news-widget")).toBeInTheDocument();
  });

  it("no muestra tarjetas de acceso: las secciones están en el Menú", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Plantilla" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Notificaciones" })).not.toBeInTheDocument();
    expect(document.querySelector('[class*="tilesGrid"]')).toBeNull();
  });

  it("agrupa los widgets en su propio contenedor dentro del contenido con margen inferior", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const widgetsGrid = screen.getByText("upcoming-events-widget").closest('[class*="widgetsGrid"]');

    expect(widgetsGrid).not.toBeNull();
    expect(widgetsGrid!.contains(screen.getByText("news-widget"))).toBe(true);
    expect(widgetsGrid!.closest('[class*="pageContent"]')).not.toBeNull();
  });

  it("muestra el banner para activar las notificaciones push", () => {
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("push-activation-banner")).toBeInTheDocument();
  });

  it("pasa al bloque Liga si el usuario es jugador o familiar", () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("league-snapshot-player")).toBeInTheDocument();
  });

  it("muestra las acciones rápidas al entrenador con el equipo", () => {
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithClub);
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("quick-actions-team-1")).toBeInTheDocument();
  });

  it("no muestra las acciones rápidas al jugador", () => {
    mockUsePlayerAutoLoad.mockReturnValue({ isPlayer: true });
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithClub);
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText(/quick-actions/)).not.toBeInTheDocument();
  });

  it("coloca eventos y Liga en la columna principal y acciones y noticias en la secundaria", () => {
    mockUseTeamAndClub.mockReturnValue(teamAndClubWithClub);
    render(
      <MemoryRouter>
        <TeamDashboard />
      </MemoryRouter>
    );

    const main = screen.getByText("upcoming-events-widget").closest('[class*="mainColumn"]');
    const side = screen.getByText("news-widget").closest('[class*="sideColumn"]');
    expect(main!.contains(screen.getByText("league-snapshot-coach"))).toBe(true);
    expect(side!.contains(screen.getByText("quick-actions-team-1"))).toBe(true);
  });
});
