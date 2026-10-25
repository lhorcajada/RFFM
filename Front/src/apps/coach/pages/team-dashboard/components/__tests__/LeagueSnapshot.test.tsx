import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseClassification = vi.fn();
vi.mock("../../../../../../shared/hooks/useClassification", () => ({
  default: (params: unknown) => mockUseClassification(params),
}));

vi.mock("../../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: "21", currentSeasonId: "22" }),
}));

const mockUseOwnTeamSeason = vi.fn();
vi.mock("../../../results/hooks/useOwnTeamSeason", () => ({
  default: (params: unknown) => mockUseOwnTeamSeason(params),
}));

const mockHasFeatureAccess = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasFeatureAccess: mockHasFeatureAccess }),
}));

import LeagueSnapshot from "../LeagueSnapshot";

const team = { id: "team-1", name: "Cadete D", rffmCompetitionId: 10, rffmGroupId: 20, rffmTeamCode: "200" };

const classification = {
  loading: false,
  teams: [
    { teamId: "100", teamName: "CF Líder", position: 1, points: 9 },
    { teamId: "200", teamName: "FEPE GETAFE III 'D'", position: 3, points: 7 },
  ],
  teamMatches: {},
};

const match = (localCode: string, localName: string, localGoals: string, visitorCode: string, visitorName: string, visitorGoals: string) => ({
  localTeamCode: localCode,
  localTeamName: localName,
  localGoals,
  visitorTeamCode: visitorCode,
  visitorTeamName: visitorName,
  visitorGoals,
  status: "1",
});

const season = {
  loading: false,
  error: false,
  ownByRound: {
    1: match("200", "FEPE", "1", "300", "C.D. SANTA BARBARA GETAFE 'E'", "1"),
    2: match("400", "ASD MOSTOLES 'B'", "0", "200", "FEPE", "2"),
    3: match("500", "S.A.D. A.V. CASERIO PERALES 'B'", "0", "200", "FEPE", "4"),
    4: match("200", "FEPE", "", "600", "A.D.C.R. LEMANS 'D'", ""),
  },
};

function renderSnapshot(props: Partial<React.ComponentProps<typeof LeagueSnapshot>> = {}) {
  return render(
    <MemoryRouter>
      <LeagueSnapshot team={team as never} isPlayer {...props} />
    </MemoryRouter>,
  );
}

describe("LeagueSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasFeatureAccess.mockReturnValue(true);
    mockUseClassification.mockReturnValue(classification);
    mockUseOwnTeamSeason.mockReturnValue(season);
  });

  it("pide la clasificación y el calendario propio de la competición y temporada del equipo", () => {
    renderSnapshot();
    expect(mockUseClassification).toHaveBeenCalledWith({ season: "22", competition: "10", group: "20" });
    expect(mockUseOwnTeamSeason).toHaveBeenCalledWith({ season: "22", competition: "10", group: "20", teamCode: "200" });
  });

  it("muestra la posición, los puntos y la racha enlazados a la clasificación", () => {
    renderSnapshot();
    const position = screen.getByRole("link", { name: /Posición/ });
    expect(position).toHaveAttribute("href", "/coach/classification?teamId=team-1");
    expect(position).toHaveTextContent("3.º");
    expect(position).toHaveTextContent("7 pts");
    expect(screen.getByRole("list", { name: "Últimos 3: E V V" })).toBeInTheDocument();
  });

  it("muestra el último partido jugado, con los goles propios primero, enlazado a Resultados", () => {
    renderSnapshot();
    const last = screen.getByRole("link", { name: /Último resultado/ });
    expect(last).toHaveAttribute("href", "/coach/results?teamId=team-1");
    expect(last).toHaveTextContent("4 – 0");
    expect(last).toHaveTextContent("V");
    expect(last).toHaveTextContent("J3 · vs S.A.D. A.V. CASERIO PERALES 'B'");
  });

  it("muestra solo la posición si no hay partidos jugados", () => {
    mockUseOwnTeamSeason.mockReturnValue({ ...season, ownByRound: {} });
    renderSnapshot();
    expect(screen.getByRole("link", { name: /Posición/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Último resultado/ })).not.toBeInTheDocument();
  });

  it("no se muestra al entrenador", () => {
    renderSnapshot({ isPlayer: false });
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
    expect(mockUseClassification).toHaveBeenCalledWith({ season: "22", competition: undefined, group: undefined });
    expect(mockUseOwnTeamSeason).toHaveBeenCalledWith({ season: "22", competition: undefined, group: undefined, teamCode: "200" });
  });

  it("no se muestra sin competición asociada", () => {
    renderSnapshot({ team: { ...team, rffmCompetitionId: null } as never });
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
  });

  it("no se muestra si el equipo no aparece en la clasificación", () => {
    renderSnapshot({ team: { ...team, rffmTeamCode: "999" } as never });
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
  });

  it("no se muestra mientras carga la clasificación o el calendario", () => {
    mockUseClassification.mockReturnValue({ ...classification, loading: true });
    const { unmount } = renderSnapshot();
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
    unmount();

    mockUseClassification.mockReturnValue(classification);
    mockUseOwnTeamSeason.mockReturnValue({ ...season, loading: true });
    renderSnapshot();
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
  });

  it("no se muestra sin acceso a la competición", () => {
    mockHasFeatureAccess.mockReturnValue(false);
    renderSnapshot();
    expect(screen.queryByRole("heading", { name: "Liga" })).not.toBeInTheDocument();
  });
});
