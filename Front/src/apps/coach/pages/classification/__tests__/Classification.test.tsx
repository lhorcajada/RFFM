import React from "react";
import { render, screen } from "@testing-library/react";
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

vi.mock("../../../hooks/useRffmCompetitionNames", () => ({
  default: () => ({ competitionName: "SEGUNDA CADETE", groupName: "Grupo 34" }),
}));

const mockUseClassification = vi.fn();
vi.mock("../../../../../shared/hooks/useClassification", () => ({
  default: (params: unknown) => mockUseClassification(params),
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

  it("muestra un estado vacío cuando la competición no tiene equipos", () => {
    mockUseClassification.mockReturnValue({ teams: [], teamMatches: {}, loading: false });

    renderPage();

    expect(screen.getByText(/no hay clasificación disponible/i)).toBeInTheDocument();
  });
});
