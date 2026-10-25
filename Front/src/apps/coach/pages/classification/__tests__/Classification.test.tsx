import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    title,
    subtitle,
    actionBar,
    children,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      <h1>{title}</h1>
      <div data-testid="subtitle">{subtitle}</div>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: vi.fn(),
}));

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 21, currentSeasonId: 21 }),
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

const mockUseTeamAndClub = vi.fn();
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => mockUseTeamAndClub(),
}));

const mockCompetitionNames = vi.fn();
vi.mock("../../../hooks/useRffmCompetitionNames", () => ({
  default: () => mockCompetitionNames(),
}));

const mockUseClassification = vi.fn();
vi.mock("../../../../../shared/hooks/useClassification", () => ({
  default: (params: unknown) => mockUseClassification(params),
}));

const mockIsDesktop = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: () => mockIsDesktop(),
}));

import Classification from "../Classification";

const team = {
  id: "team-1",
  name: "Cadete D",
  canEdit: true,
  club: { id: "club-1" },
  rffmCompetitionId: 5,
  rffmGroupId: 34,
};

const classifiedTeam = {
  teamId: "a",
  teamName: "FEPE GETAFE III 'D'",
  position: 1,
  points: 9,
  played: 3,
  won: 3,
  drawn: 0,
  lost: 0,
  goalsFor: 8,
  goalsAgainst: 2,
  matchStreaks: [{ type: "W" }],
};

const ownTeam = {
  teamId: "rffm-own",
  teamName: "CADETE D",
  position: 2,
  points: 6,
  played: 3,
  won: 2,
  drawn: 0,
  lost: 1,
  goalsFor: 5,
  goalsAgainst: 3,
  matchStreaks: [{ type: "W" }, { type: "L" }, { type: "W" }],
};

const ownTeamMatches = {
  "rffm-own": [
    {
      date: "2026-09-10T10:00:00",
      opponent: "CD RIVAL",
      result: "G",
      localGoals: 3,
      visitorGoals: 1,
      isLocal: true,
      scoreLeft: "3",
      scoreRight: "1",
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Classification />
    </MemoryRouter>,
  );
}

describe("Classification (coach)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktop.mockReturnValue(false);
    mockCompetitionNames.mockReturnValue({ competitionName: "SEGUNDA CADETE", groupName: "Grupo 34" });
    mockHasFeatureAccess.mockReturnValue(true);
    mockUseTeamAndClub.mockReturnValue({ team, loading: false });
    mockUseClassification.mockReturnValue({
      teams: [classifiedTeam],
      teamMatches: {},
      loading: false,
    });
  });

  it("muestra el título Clasificación", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Clasificación" })).toBeInTheDocument();
  });

  it("carga la clasificación con la competición y el grupo RFFM del equipo", () => {
    renderPage();

    expect(mockUseClassification).toHaveBeenLastCalledWith(
      expect.objectContaining({ season: "21", competition: "5", group: "34" }),
    );
  });

  it("muestra la competición y el grupo en la cabecera", () => {
    renderPage();

    expect(screen.getByTestId("subtitle")).toHaveTextContent("SEGUNDA CADETE");
    expect(screen.getByTestId("subtitle")).toHaveTextContent("Grupo 34");
  });

  it("muestra los equipos de la clasificación sin filtros", () => {
    renderPage();

    expect(screen.getByText("FEPE GETAFE III 'D'")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("avisa y ofrece configurarla cuando el equipo no tiene competición", () => {
    mockUseTeamAndClub.mockReturnValue({
      team: { ...team, rffmCompetitionId: null, rffmGroupId: null },
      loading: false,
    });
    mockUseClassification.mockReturnValue({ teams: [], teamMatches: {}, loading: false });

    renderPage();

    expect(screen.getByText(/el equipo no tiene una competición configurada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar competición" })).toHaveAttribute(
      "href",
      "/coach/clubs/club-1/teams/team-1/edit",
    );
  });

  describe("con el equipo propio en la clasificación", () => {
    beforeEach(() => {
      mockUseTeamAndClub.mockReturnValue({
        team: { ...team, rffmTeamCode: "rffm-own" },
        loading: false,
      });
      mockUseClassification.mockReturnValue({
        teams: [classifiedTeam, ownTeam],
        teamMatches: ownTeamMatches,
        loading: false,
      });
    });

    it("resume la posición, los puntos y la distancia del equipo propio", () => {
      renderPage();

      const summary = screen.getByRole("region", { name: "Tu equipo" });
      expect(summary).toHaveTextContent("2º");
      expect(summary).toHaveTextContent("6");
      expect(summary).toHaveTextContent("A 3 del 1º");
    });

    it("en móvil mantiene plegado el detalle del equipo propio por defecto", () => {
      renderPage();

      expect(screen.getByRole("button", { name: /2º CADETE D/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByText("CD RIVAL")).not.toBeInTheDocument();
    });

    it("abre todos los resultados del equipo en un diálogo", async () => {
      renderPage();
      await userEvent.click(screen.getByRole("button", { name: /2º CADETE D/ }));

      await userEvent.click(screen.getByRole("button", { name: "Ver todos los resultados" }));

      const dialog = screen.getByRole("dialog", { name: /Resultados de CADETE D/ });
      expect(within(dialog).getByText("CD RIVAL")).toBeInTheDocument();
    });

    it("en escritorio muestra el detalle del equipo propio en un panel lateral", () => {
      mockIsDesktop.mockReturnValue(true);

      renderPage();

      const panel = screen.getByRole("region", { name: "Detalle de CADETE D" });
      expect(within(panel).getByText("CD RIVAL")).toBeInTheDocument();
    });
  });

  it("en móvil despliega el detalle de un equipo al pulsar su fila", async () => {
    renderPage();
    const row = screen.getByRole("button", { name: /1º FEPE GETAFE III 'D'/ });
    expect(row).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(row);

    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Ver todos los resultados" })).toBeInTheDocument();
  });

  it("en escritorio cambia el panel de detalle al seleccionar otro equipo", async () => {
    mockIsDesktop.mockReturnValue(true);
    mockUseClassification.mockReturnValue({
      teams: [classifiedTeam, ownTeam],
      teamMatches: {},
      loading: false,
    });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /2º CADETE D/ }));

    expect(screen.getByRole("region", { name: "Detalle de CADETE D" })).toBeInTheDocument();
  });

  it("en móvil no ofrece cambiar entre vista compacta y completa", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: "Completa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compacta" })).not.toBeInTheDocument();
  });

  it("en móvil la fila muestra solo el equipo y los puntos", () => {
    renderPage();

    expect(screen.getByText("Pts", { selector: "[data-column]" })).toBeInTheDocument();
    expect(screen.queryByText("PJ", { selector: "[data-column]" })).not.toBeInTheDocument();
    expect(screen.queryByText("DG", { selector: "[data-column]" })).not.toBeInTheDocument();
  });

  it("en móvil el detalle desplegado incluye partidos jugados y diferencia de goles", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /1º FEPE GETAFE III 'D'/ }));

    const detail = screen.getByRole("region", { name: "Detalle de FEPE GETAFE III 'D'" });
    expect(within(detail).getByText("Jugados")).toBeInTheDocument();
    expect(within(detail).getByText("Dif. goles")).toBeInTheDocument();
    expect(within(detail).getByText("+6")).toBeInTheDocument();
  });

  it("en escritorio la lista mantiene las columnas de partidos y goles", () => {
    mockIsDesktop.mockReturnValue(true);

    renderPage();

    expect(screen.getByText("PJ", { selector: "[data-column]" })).toBeInTheDocument();
    expect(screen.getByText("DG", { selector: "[data-column]" })).toBeInTheDocument();
  });

  describe("con las plazas de la liga configuradas en el equipo", () => {
    beforeEach(() => {
      mockUseTeamAndClub.mockReturnValue({
        team: { ...team, promotionSpots: 2, playoffSpots: null, relegationSpots: 0 },
        loading: false,
      });
      mockUseClassification.mockReturnValue({
        teams: [
          classifiedTeam,
          { ...ownTeam, teamId: "b", teamName: "SEGUNDO", position: 2 },
          { ...ownTeam, teamId: "c", teamName: "TERCERO", position: 3 },
        ],
        teamMatches: {},
        loading: false,
      });
    });

    it("marca como ascenso las plazas de ascenso de la liga", () => {
      renderPage();

      expect(screen.getByRole("button", { name: /2º SEGUNDO, 6 puntos, zona de ascenso/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /3º TERCERO, 6 puntos$/ })).toBeInTheDocument();
    });

    it("muestra en la leyenda solo las zonas que tiene la liga", () => {
      renderPage();

      const legend = screen.getByRole("list", { name: "Zonas de la clasificación" });
      expect(legend).toHaveTextContent("Ascenso (1º–2º)");
      expect(legend).not.toHaveTextContent("Promoción");
      expect(legend).not.toHaveTextContent("Descenso");
    });
  });

  it("sin plazas configuradas aplica las de las Bases de su competición", () => {
    mockUseClassification.mockReturnValue({
      teams: [
        classifiedTeam,
        { ...ownTeam, teamId: "b", teamName: "SEGUNDO", position: 2 },
        { ...ownTeam, teamId: "c", teamName: "TERCERO", position: 3 },
      ],
      teamMatches: {},
      loading: false,
    });

    renderPage();

    expect(screen.getByRole("button", { name: /2º SEGUNDO, 6 puntos, zona de ascenso/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Zonas de la clasificación" })).toHaveTextContent(
      "Ascenso (1º–2º)",
    );
  });

  it("no muestra zonas sin plazas configuradas ni regla para su competición", () => {
    mockCompetitionNames.mockReturnValue({ competitionName: "PREFERENTE JUVENIL", groupName: "Grupo 1" });

    renderPage();

    expect(screen.queryByRole("list", { name: "Zonas de la clasificación" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1º FEPE GETAFE III 'D', 9 puntos$/ })).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando la competición no tiene equipos", () => {
    mockUseClassification.mockReturnValue({ teams: [], teamMatches: {}, loading: false });

    renderPage();

    expect(screen.getByText(/no hay clasificación disponible/i)).toBeInTheDocument();
  });
});
