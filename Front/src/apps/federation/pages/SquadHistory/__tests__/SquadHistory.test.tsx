import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/squadHistoryService", async () => {
  const actual = await vi.importActual<typeof import("../../../services/squadHistoryService")>(
    "../../../services/squadHistoryService",
  );
  return { ...actual, getSquadHistory: vi.fn(), requestSquadHistory: vi.fn() };
});

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({
  useAuditPageAccess: () => {},
}));

import SquadHistory from "../SquadHistory";
import {
  getSquadHistory,
  requestSquadHistory,
  type SquadHistoryReport,
  type SquadHistoryTeam,
} from "../../../services/squadHistoryService";

const getMock = vi.mocked(getSquadHistory);
const requestMock = vi.mocked(requestSquadHistory);

function team(overrides: Partial<SquadHistoryTeam>): SquadHistoryTeam {
  return {
    competitionCode: "10",
    competitionName: "Liga Infantil",
    groupCode: "20",
    groupName: "Grupo 1",
    teamCode: "E1",
    teamName: "CD Ejemplo A",
    clubName: "CD Ejemplo",
    teamShieldUrl: null,
    teamPoints: 40,
    teamPosition: 2,
    goals: 7,
    yellowCards: 3,
    redCards: 1,
    starts: 15,
    callUps: 20,
    source: "PlayerSheet",
    isIncomplete: false,
    ...overrides,
  };
}

function report(overrides: Partial<SquadHistoryReport> = {}): SquadHistoryReport {
  return {
    reportId: "r1",
    teamCode: "555",
    teamName: "CD Ejemplo A",
    seasonId: 22,
    previousSeasonId: 21,
    status: "Completed",
    totalPlayers: 2,
    processedPlayers: 2,
    failedPlayers: 0,
    requestedAt: "2026-09-28T09:00:00Z",
    completedAt: "2026-09-28T09:30:00Z",
    errorMessage: null,
    isCandidateSquad: false,
    candidateSearchNote: null,
    players: [
      {
        playerCode: "P1",
        playerName: "LUCAS PEREZ",
        birthYear: 2011,
        originTeamName: null,
        isIncomplete: false,
        seasons: [
          { seasonId: 22, seasonName: "2026-2027", teams: [team({})] },
          {
            seasonId: 21,
            seasonName: "2025-2026",
            teams: [
              team({ teamCode: "E2", teamName: "AD Norte B", source: "Actas", starts: null, callUps: 4 }),
              team({ teamCode: "E3", teamName: "CF Sur C", source: "Actas" }),
            ],
          },
        ],
      },
      {
        playerCode: "P2",
        playerName: "MARIO GOMEZ",
        birthYear: null,
        originTeamName: null,
        isIncomplete: true,
        seasons: [
          {
            seasonId: 22,
            seasonName: "2026-2027",
            teams: [team({ teamCode: "", teamName: "", clubName: "", isIncomplete: true })],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/federation/squad-history/555?seasonId=22"]}>
      <Routes>
        <Route path="/federation/squad-history/:teamCode" element={<SquadHistory />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SquadHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pide el historial del equipo y la temporada de la URL", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    await screen.findByText("LUCAS PEREZ");
    expect(getMock).toHaveBeenCalledWith("555", 22);
  });

  it("muestra por jugador y temporada una tarjeta por equipo con todos los datos", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    const player = await screen.findByRole("article", { name: "LUCAS PEREZ" });
    expect(within(player).getByText("Temporada 2026-2027")).toBeInTheDocument();
    expect(within(player).getByText("Temporada 2025-2026")).toBeInTheDocument();

    const teamCard = within(player).getByRole("region", { name: "CD Ejemplo A · 2026-2027" });
    expect(within(teamCard).getByText("Liga Infantil · Grupo 1")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Puntos: 40 (2º)")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Goles: 7")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Amarillas: 3")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Rojas: 1")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Titularidades: 15")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Convocatorias: 20")).toBeInTheDocument();
    expect(within(teamCard).getByText("Totales de temporada")).toBeInTheDocument();
  });

  it("las tarjetas de equipo no muestran el club ni el escudo", async () => {
    const base = report();
    getMock.mockResolvedValue(
      report({
        players: [
          {
            ...base.players[0],
            seasons: [{ seasonId: 22, seasonName: "2026-2027", teams: [team({ teamShieldUrl: "https://rffm.es/escudo.png" })] }],
          },
        ],
      }),
    );
    const { container } = renderPage();

    const teamCard = await screen.findByRole("region", { name: "CD Ejemplo A · 2026-2027" });
    expect(within(teamCard).queryByText("CD Ejemplo")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("ordena los jugadores por temporada, competición y equipo de la tarjeta con más convocatorias", async () => {
    const player = (playerName: string, seasons: SquadHistoryReport["players"][number]["seasons"]) => ({
      playerCode: playerName,
      playerName,
      birthYear: null,
      originTeamName: null,
      isIncomplete: false,
      seasons,
    });
    const lastSeason = (...teams: SquadHistoryTeam[]) => ({ seasonId: 21, seasonName: "2025-2026", teams });
    getMock.mockResolvedValue(
      report({
        players: [
          player("INFANTIL B", [
            { seasonId: 22, seasonName: "2026-2027", teams: [] },
            lastSeason(team({ competitionName: "Segunda Infantil", teamName: "Club B", callUps: 12 })),
          ]),
          player("CADETE A SEGUNDO", [
            lastSeason(
              team({ competitionName: "Segunda Infantil", teamName: "Club B", callUps: 3 }),
              team({ competitionName: "Primera Cadete", teamName: "Club A", callUps: 20 }),
            ),
          ]),
          player("CADETE A PRIMERO", [lastSeason(team({ competitionName: "Primera Cadete", teamName: "Club A", callUps: 18 }))]),
          player("ACTUAL", [{ seasonId: 22, seasonName: "2026-2027", teams: [team({ competitionName: "Tercera Cadete" })] }]),
        ],
      }),
    );
    renderPage();

    await screen.findByRole("article", { name: "ACTUAL" });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
      "ACTUAL",
      "CADETE A PRIMERO",
      "CADETE A SEGUNDO",
      "INFANTIL B",
    ]);
  });

  it("dentro de una temporada muestra primero el equipo con más convocatorias", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    const player = await screen.findByRole("article", { name: "LUCAS PEREZ" });
    const regions = within(player).getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions.indexOf("CF Sur C · 2025-2026")).toBeLessThan(regions.indexOf("AD Norte B · 2025-2026"));
  });

  it("marca el origen desde actas y muestra un guion cuando falta un dato", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    const teamCard = await screen.findByRole("region", { name: "AD Norte B · 2025-2026" });
    expect(within(teamCard).getByText("Desde actas")).toBeInTheDocument();
    expect(within(teamCard).getByLabelText("Titularidades: —")).toBeInTheDocument();
  });

  it("avisa de los datos que no se pudieron obtener", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    const player = await screen.findByRole("article", { name: "MARIO GOMEZ" });
    expect(within(player).getByText(/no se pudieron obtener los datos de esta temporada/i)).toBeInTheDocument();
    expect(within(player).getByText(/datos incompletos/i)).toBeInTheDocument();
  });

  it("filtra los jugadores por nombre", async () => {
    getMock.mockResolvedValue(report());
    renderPage();
    await screen.findByText("LUCAS PEREZ");

    await userEvent.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "mario");

    expect(screen.queryByText("LUCAS PEREZ")).not.toBeInTheDocument();
    expect(screen.getByText("MARIO GOMEZ")).toBeInTheDocument();
  });

  it("sin historial ofrece generarlo", async () => {
    getMock.mockResolvedValueOnce(null).mockResolvedValue(report({ status: "Pending", players: [], processedPlayers: 0 }));
    requestMock.mockResolvedValue({ reportId: "r1", status: "Pending" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /generar historial/i }));

    expect(requestMock).toHaveBeenCalledWith("555", { seasonId: 22, teamName: "", refresh: false });
    expect(await screen.findByText(/recopilando el historial/i)).toBeInTheDocument();
  });

  it("mientras se genera muestra el progreso y los datos anteriores", async () => {
    getMock.mockResolvedValue(report({ status: "Running", processedPlayers: 1, totalPlayers: 2 }));
    renderPage();

    expect(await screen.findByText(/1 de 2 jugadores/i)).toBeInTheDocument();
    expect(screen.getByText("LUCAS PEREZ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /actualizar/i })).toBeDisabled();
  });

  it("actualizar vuelve a generar el historial", async () => {
    getMock
      .mockResolvedValueOnce(report())
      .mockResolvedValue(report({ status: "Pending", processedPlayers: 0 }));
    requestMock.mockResolvedValue({ reportId: "r1", status: "Pending" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /actualizar/i }));

    expect(requestMock).toHaveBeenCalledWith("555", { seasonId: 22, teamName: "CD Ejemplo A", refresh: true });
    expect(await screen.findByText(/recopilando el historial/i)).toBeInTheDocument();
    expect(screen.getByText("LUCAS PEREZ")).toBeInTheDocument();
  });

  it("muestra el error si la última generación falló", async () => {
    getMock.mockResolvedValue(report({ status: "Failed", errorMessage: "No se pudo obtener la plantilla del equipo." }));
    renderPage();

    expect(await screen.findByText(/no se pudo obtener la plantilla del equipo/i)).toBeInTheDocument();
  });

  it("muestra un error si no se puede cargar el historial", async () => {
    getMock.mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
  });

  it("mientras se genera consulta de nuevo el progreso periódicamente", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMock
      .mockResolvedValueOnce(report({ status: "Running", processedPlayers: 1 }))
      .mockResolvedValue(report());
    renderPage();
    await screen.findByText(/1 de 2 jugadores/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/1 de 2 jugadores/i)).not.toBeInTheDocument());
  });
  it("muestra el año de nacimiento del jugador", async () => {
    getMock.mockResolvedValue(report());
    renderPage();

    const player = await screen.findByRole("article", { name: "LUCAS PEREZ" });
    expect(within(player).getByText("Nacido en 2011")).toBeInTheDocument();
    const withoutYear = screen.getByRole("article", { name: "MARIO GOMEZ" });
    expect(within(withoutYear).queryByText(/nacido en/i)).not.toBeInTheDocument();
  });

  it("con la plantilla vacía avisa de que son posibles jugadores e indica su procedencia", async () => {
    const base = report();
    getMock.mockResolvedValue(
      report({
        isCandidateSquad: true,
        candidateSearchNote: "Los equipos del club se obtuvieron de las competiciones.",
        players: [{ ...base.players[0], originTeamName: "CD Ejemplo Infantil A" }],
      }),
    );
    renderPage();

    expect(await screen.findByText(/el equipo todavía no tiene jugadores/i)).toBeInTheDocument();
    expect(screen.getByText(/se obtuvieron de las competiciones/i)).toBeInTheDocument();
    const player = screen.getByRole("article", { name: "LUCAS PEREZ" });
    expect(within(player).getByText("Procede de CD Ejemplo Infantil A")).toBeInTheDocument();
  });

  it("con la plantilla vacía y sin candidatos lo indica", async () => {
    getMock.mockResolvedValue(report({ isCandidateSquad: true, players: [] }));
    renderPage();

    expect(await screen.findByText(/no se encontraron posibles jugadores/i)).toBeInTheDocument();
  });
});
