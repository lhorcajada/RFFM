import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 22, seasons: [], setSeasonId: vi.fn() }),
}));

vi.mock("../../../services/Federation/ClubService", () => ({
  clubService: {
    searchClubs: vi.fn(),
    getClubTeams: vi.fn(),
    resolveTeamGroup: vi.fn(),
  },
}));

import { clubService } from "../../../services/Federation/ClubService";
import ClubSearchSection from "../ClubSearchSection";

async function selectTeam(onTeamResolved: () => void) {
  vi.mocked(clubService.searchClubs).mockResolvedValue([
    { clubCode: "C1", name: "Club Uno", teamsCount: 1 },
  ] as never);
  vi.mocked(clubService.getClubTeams).mockResolvedValue([
    {
      teamCode: "T1",
      teamName: "Equipo Uno",
      categoryDescription: "Alevín",
      inCompetition: true,
      competitionId: 10,
      competitionName: "Liga Alevín",
    },
  ]);
  render(<ClubSearchSection onTeamResolved={onTeamResolved} />);
  fireEvent.change(screen.getByLabelText("Nombre del club"), {
    target: { value: "uno" },
  });
  fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
  fireEvent.click(await screen.findByText(/Club Uno/));
  fireEvent.mouseDown(await screen.findByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: /Equipo Uno/ }));
}

describe("ClubSearchSection — grupo no resuelto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propaga el equipo y la competición aunque el grupo no se pueda resolver", async () => {
    vi.mocked(clubService.resolveTeamGroup).mockRejectedValue(new Error("404"));
    const onTeamResolved = vi.fn();
    await selectTeam(onTeamResolved);
    await waitFor(() =>
      expect(onTeamResolved).toHaveBeenCalledWith({
        competition: { id: "10", name: "Liga Alevín" },
        group: undefined,
        team: { id: "T1", name: "Equipo Uno" },
      }),
    );
  });

  it("avisa de que el grupo hay que elegirlo a mano sin bloquear la selección", async () => {
    vi.mocked(clubService.resolveTeamGroup).mockRejectedValue(new Error("404"));
    await selectTeam(vi.fn());
    expect(
      await screen.findByText(/selecciona el grupo manualmente/i),
    ).toBeInTheDocument();
  });

  it("usa el nombre del equipo de la lista si el backend no lo devuelve", async () => {
    vi.mocked(clubService.resolveTeamGroup).mockResolvedValue({
      teamCode: "T1",
      teamName: "",
      groupCode: "g1",
      groupName: "Grupo 1",
      competitionCode: "10",
      competitionName: "Liga Alevín",
    });
    const onTeamResolved = vi.fn();
    await selectTeam(onTeamResolved);
    await waitFor(() =>
      expect(onTeamResolved).toHaveBeenCalledWith(
        expect.objectContaining({ team: { id: "T1", name: "Equipo Uno" } }),
      ),
    );
  });
});
