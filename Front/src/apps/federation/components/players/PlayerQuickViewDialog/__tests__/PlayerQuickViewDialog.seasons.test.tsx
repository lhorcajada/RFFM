import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 22, seasons: [], setSeasonId: vi.fn() }),
}));

vi.mock("../../../../services/api", () => ({
  getPlayer: vi.fn(),
}));

vi.mock("../../../../services/playerSeasonSummaryService", () => ({
  getPlayerSeasonSummary: vi.fn(),
}));

vi.mock("../../../../../../shared/services/imageService", () => ({
  fetchImage: vi.fn().mockResolvedValue(null),
}));

import { getPlayer } from "../../../../services/api";
import { getPlayerSeasonSummary, type PlayerSeasonSummary } from "../../../../services/playerSeasonSummaryService";
import PlayerQuickViewDialog from "../PlayerQuickViewDialog";

function seasonSummary(seasonId: number, seasonName: string, goals: number): PlayerSeasonSummary {
  return {
    seasonId,
    seasonName,
    stats: { called: 10, starter: 8, substitute: 2, played: 9, goals, yellow: 1, red: 0, doubleYellow: 0 },
    teams: [
      {
        competitionName: "Liga Infantil",
        groupName: "Grupo 2",
        teamName: `CD Ajeno ${seasonName}`,
        teamPoints: 30,
        teamPosition: 2,
        teamShieldUrl: null,
      },
    ],
  };
}

describe("PlayerQuickViewDialog - estadísticas por temporada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlayer).mockResolvedValue({ playerId: "P1", name: "Leo Ajeno" });
    vi.mocked(getPlayerSeasonSummary).mockResolvedValue([
      seasonSummary(22, "2026-2027", 4),
      seasonSummary(21, "2025-2026", 11),
    ]);
  });

  it("muestra las estadísticas de la temporada actual y de la pasada", async () => {
    render(<PlayerQuickViewDialog open playerCode="P1" onClose={() => {}} />);

    const current = await screen.findByRole("region", { name: "Temporada 2026-2027" });
    const previous = screen.getByRole("region", { name: "Temporada 2025-2026" });
    expect(within(current).getByLabelText("Goles")).toHaveTextContent("4");
    expect(within(previous).getByLabelText("Goles")).toHaveTextContent("11");
  });

  it("pide el resumen de temporadas del jugador a partir de la temporada indicada", async () => {
    render(<PlayerQuickViewDialog open playerCode="P1" seasonId="21" onClose={() => {}} />);

    await screen.findByRole("region", { name: "Temporada 2026-2027" });
    expect(getPlayerSeasonSummary).toHaveBeenCalledWith("P1", "21");
  });

  it("si la ficha del jugador no se puede cargar sigue mostrando sus estadísticas por temporada", async () => {
    vi.mocked(getPlayer).mockRejectedValue(new Error("rffm caída"));

    render(<PlayerQuickViewDialog open playerCode="P1" playerName="Leo Ajeno" onClose={() => {}} />);

    expect(await screen.findByRole("region", { name: "Temporada 2026-2027" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Leo Ajeno" })).toBeInTheDocument();
    expect(screen.queryByText("No se ha podido cargar la ficha del jugador")).not.toBeInTheDocument();
  });
});
