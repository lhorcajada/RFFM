import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  ),
}));
vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({ useAuditPageAccess: vi.fn() }));
vi.mock("../../../hooks/useTeamDashboardBack", () => ({ default: () => vi.fn() }));
vi.mock("../../../components/TeamCompetitionMissing/TeamCompetitionMissing", () => ({
  default: () => <div>El equipo no tiene una competición configurada</div>,
}));

const teamState = vi.hoisted(() => ({
  value: { team: { id: "team-1", rffmCompetitionId: 1, rffmGroupId: 2 } as unknown, loading: false },
}));
vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({ team: teamState.value.team, teamTitleNode: null, loading: teamState.value.loading }),
}));

vi.mock("../../../services/leagueScorersService", () => ({ getLeagueScorers: vi.fn(), refreshLeagueActas: vi.fn() }));

import { getLeagueScorers, refreshLeagueActas, type LeagueScorersResponse } from "../../../services/leagueScorersService";
import Scorers from "../Scorers";

const data = (round: number): LeagueScorersResponse => ({
  rounds: [7, 8],
  round,
  matches: [
    {
      recordCode: "R1",
      date: "01/11/2026",
      time: "10:00",
      home: "Alameda CF",
      away: "Racing Pinar",
      homeGoals: "2",
      awayGoals: "1",
      isOwnTeam: true,
      pendingActa: false,
      goals: [
        { minute: "14'", player: "Hugo Martín", team: "Alameda CF", type: "normal", seasonGoals: 9 },
        { minute: "44'", player: "Iker Gil", team: "Racing Pinar", type: "penalty", seasonGoals: 8 },
        { minute: "60'", player: "Sergio Lara", team: "Racing Pinar", type: "ownGoal", seasonGoals: null },
      ],
    },
    {
      recordCode: "R2",
      date: "01/11/2026",
      time: "12:00",
      home: "Unión Sur",
      away: "Atlético Vega",
      homeGoals: "0",
      awayGoals: "0",
      isOwnTeam: false,
      pendingActa: false,
      goals: [],
    },
    {
      recordCode: "R3",
      date: "02/11/2026",
      time: "11:00",
      home: "Real Olmo",
      away: "Juventud Roble",
      homeGoals: "1",
      awayGoals: "0",
      isOwnTeam: false,
      pendingActa: true,
      goals: [],
    },
  ],
  scorers: [
    { rank: 1, player: "Hugo Martín", team: "Alameda CF", goals: 9 },
    { rank: 2, player: "Iker Gil", team: "Racing Pinar", goals: 8 },
  ],
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Scorers />
    </MemoryRouter>,
  );
}

describe("Scorers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamState.value = { team: { id: "team-1", rffmCompetitionId: 1, rffmGroupId: 2 }, loading: false };
    vi.mocked(getLeagueScorers).mockImplementation(async (_team, round) => data(round ?? 8));
  });

  it("muestra los goles del partido con minuto, jugador y etiquetas", async () => {
    renderPage();

    const card = (await screen.findByText("Alameda CF 2 – 1 Racing Pinar")).closest("article") as HTMLElement;
    expect(within(card).getByText("14'")).toBeInTheDocument();
    expect(within(card).getByText("Hugo Martín")).toBeInTheDocument();
    expect(within(card).getByText("Penalti")).toBeInTheDocument();
    expect(within(card).getByText("En propia")).toBeInTheDocument();
  });

  it("muestra entre paréntesis los goles de la temporada del goleador y no en las propias", async () => {
    renderPage();

    const card = (await screen.findByText("Alameda CF 2 – 1 Racing Pinar")).closest("article") as HTMLElement;
    expect(within(card).getByText("(9)")).toBeInTheDocument();
    expect(within(card).getByText("(8)")).toBeInTheDocument();
    expect(within(card).getAllByText(/^\(\d+\)$/)).toHaveLength(2);
  });

  it("etiqueta el partido del equipo propio como «Mi equipo»", async () => {
    renderPage();

    const card = (await screen.findByText("Alameda CF 2 – 1 Racing Pinar")).closest("article") as HTMLElement;
    expect(within(card).getByText("Mi equipo")).toBeInTheDocument();
  });

  it("muestra «Acta pendiente» y «Sin goles» según el partido", async () => {
    renderPage();

    const pending = (await screen.findByText("Real Olmo 1 – 0 Juventud Roble")).closest("article") as HTMLElement;
    const empty = screen.getByText("Unión Sur 0 – 0 Atlético Vega").closest("article") as HTMLElement;
    expect(within(pending).getByText("Acta pendiente")).toBeInTheDocument();
    expect(within(empty).getByText("Sin goles")).toBeInTheDocument();
  });

  it("muestra el ranking con la nota de acumulado", async () => {
    renderPage();

    const ranking = (await screen.findByRole("heading", { name: "Máximos goleadores" })).closest("section") as HTMLElement;
    expect(within(ranking).getByText("Hugo Martín")).toBeInTheDocument();
    expect(within(ranking).getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Clasificación acumulada hasta la jornada 8.")).toBeInTheDocument();
  });

  it("ofrece un selector de jornada con la actual seleccionada y pide otra al cambiarlo", async () => {
    renderPage();

    const select = await screen.findByRole("combobox", { name: "Jornada" });
    expect(select).toHaveValue("8");
    expect(within(select).getByRole("option", { name: "Jornada 7" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "7" } });

    expect(await screen.findByRole("combobox", { name: "Jornada" })).toHaveValue("7");
    expect(getLeagueScorers).toHaveBeenLastCalledWith("team-1", 7);
  });

  it("no usa botones de jornada con scroll horizontal", async () => {
    renderPage();

    await screen.findByRole("combobox", { name: "Jornada" });
    expect(screen.queryByRole("button", { name: "J8" })).not.toBeInTheDocument();
  });

  it("coloca el ranking antes que los partidos en el orden del documento", async () => {
    renderPage();

    const ranking = await screen.findByRole("heading", { name: "Máximos goleadores" });
    const matches = screen.getByRole("heading", { name: /Goles de la jornada 8/ });
    expect(ranking.compareDocumentPosition(matches) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("muestra un error con «Reintentar» cuando falla la carga", async () => {
    vi.mocked(getLeagueScorers).mockRejectedValueOnce(new Error("boom"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Alameda CF 2 – 1 Racing Pinar")).toBeInTheDocument();
  });

  it("muestra «Actualizar actas» solo si hay actas pendientes en la jornada", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Actualizar actas" })).toBeInTheDocument();
  });

  it("no muestra «Actualizar actas» cuando no falta ninguna acta", async () => {
    vi.mocked(getLeagueScorers).mockImplementation(async (_team, round) => {
      const base = data(round ?? 8);
      return { ...base, matches: base.matches.map((m) => ({ ...m, pendingActa: false })) };
    });
    renderPage();

    await screen.findByRole("combobox", { name: "Jornada" });
    expect(screen.queryByRole("button", { name: "Actualizar actas" })).not.toBeInTheDocument();
  });

  it("descarga las actas de la jornada, recarga los datos y avisa del resultado", async () => {
    vi.mocked(refreshLeagueActas).mockResolvedValue({ requested: 2, stored: 2, failed: 0 });
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Actualizar actas" }));

    await waitFor(() => expect(refreshLeagueActas).toHaveBeenCalledWith("team-1", 8));
    await waitFor(() => expect(getLeagueScorers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(snackbar).toHaveBeenCalled());
    const detail = (snackbar.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.message).toBe("Se han guardado 2 actas.");
    expect(detail.severity).toBe("success");
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("avisa de las actas que la RFFM no ha podido devolver", async () => {
    vi.mocked(refreshLeagueActas).mockResolvedValue({ requested: 3, stored: 1, failed: 2 });
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Actualizar actas" }));

    await waitFor(() => expect(snackbar).toHaveBeenCalled());
    const detail = (snackbar.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.message).toBe("Se ha guardado 1 acta y 2 no han podido descargarse.");
    expect(detail.severity).toBe("warning");
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("avisa con un error si falla la descarga de actas", async () => {
    vi.mocked(refreshLeagueActas).mockRejectedValue(new Error("boom"));
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Actualizar actas" }));

    await waitFor(() => expect(snackbar).toHaveBeenCalled());
    expect((snackbar.mock.calls[0][0] as CustomEvent).detail.severity).toBe("error");
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("avisa cuando la liga no tiene jornadas", async () => {
    vi.mocked(getLeagueScorers).mockResolvedValue({ rounds: [], round: 0, matches: [], scorers: [] });
    renderPage();

    expect(await screen.findByText("Todavía no hay jornadas guardadas para esta liga.")).toBeInTheDocument();
  });

  it("avisa cuando el equipo no tiene liga", () => {
    teamState.value = { team: { id: "team-1" }, loading: false };
    renderPage();

    expect(screen.getByText("El equipo no tiene una competición configurada")).toBeInTheDocument();
    expect(getLeagueScorers).not.toHaveBeenCalled();
  });
});
