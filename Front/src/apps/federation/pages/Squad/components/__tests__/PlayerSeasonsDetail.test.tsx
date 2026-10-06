import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/playerSeasonSummaryService", () => ({
  getPlayerSeasonSummary: vi.fn(),
}));

import PlayerSeasonsDetail from "../PlayerSeasonsDetail";
import {
  getPlayerSeasonSummary,
  type PlayerSeasonSummary,
} from "../../../../services/playerSeasonSummaryService";

const getMock = vi.mocked(getPlayerSeasonSummary);

const stats = { called: 8, starter: 6, substitute: 2, played: 8, goals: 3, yellow: 1, red: 0, doubleYellow: 0 };

const summary: PlayerSeasonSummary[] = [
  {
    seasonId: 22,
    seasonName: "2026-2027",
    stats,
    teams: [
      { competitionName: "SEGUNDA CADETE", groupName: "Grupo 34", teamName: "FEPE D", teamPoints: 7, teamPosition: 4, teamShieldUrl: null },
    ],
  },
  {
    seasonId: 21,
    seasonName: "2025-2026",
    stats: { ...stats, goals: 11 },
    teams: [
      { competitionName: "PRIMERA INFANTIL", groupName: "Grupo 2", teamName: "FEPE B", teamPoints: 41, teamPosition: 2, teamShieldUrl: null },
    ],
  },
];

describe("PlayerSeasonsDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agrupa por temporada las estadísticas y los equipos en los que jugó", async () => {
    getMock.mockResolvedValue(summary);
    render(<PlayerSeasonsDetail playerId="1001" season="22" />);

    const current = await screen.findByRole("region", { name: "Temporada 2026-2027" });
    const previous = screen.getByRole("region", { name: "Temporada 2025-2026" });
    expect(within(current).getByText("FEPE D")).toBeInTheDocument();
    expect(within(current).getByText(/SEGUNDA CADETE/)).toBeInTheDocument();
    expect(within(current).getByText("7 pts")).toBeInTheDocument();
    expect(within(previous).getByText("FEPE B")).toBeInTheDocument();
    expect(within(previous).getByLabelText("Goles")).toHaveTextContent("11");
    expect(getMock).toHaveBeenCalledWith("1001", "22");
  });

  it("muestra las convocatorias y titularidades de cada temporada", async () => {
    getMock.mockResolvedValue([summary[0]]);
    render(<PlayerSeasonsDetail playerId="1001" season="22" />);

    expect(await screen.findByLabelText("Convocatorias")).toHaveTextContent("8");
    expect(screen.getByLabelText("Titularidades")).toHaveTextContent("6");
  });

  it("sin temporadas muestra que no hay datos", async () => {
    getMock.mockResolvedValue([]);
    render(<PlayerSeasonsDetail playerId="1001" season="22" />);

    expect(await screen.findByText(/no hay estadísticas/i)).toBeInTheDocument();
  });

  it("si falla la carga muestra un error", async () => {
    getMock.mockRejectedValue(new Error("boom"));
    render(<PlayerSeasonsDetail playerId="1001" season="22" />);

    expect(await screen.findByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });
});
