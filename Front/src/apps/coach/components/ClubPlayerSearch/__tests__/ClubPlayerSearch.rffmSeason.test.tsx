import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseRffmSeason = vi.fn();

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => mockUseRffmSeason(),
}));

vi.mock("../../../services/clubService", () => ({
  getClubById: vi.fn().mockResolvedValue({ id: "club-1", name: "Real Madrid" }),
}));

vi.mock("../../../services/seasonService", () => ({
  getSeasons: vi.fn().mockResolvedValue([{ id: "s1", name: "2025/2026" }]),
}));

vi.mock("../../../../federation/services/Federation/ClubService", () => ({
  clubService: {
    searchClubs: vi.fn().mockResolvedValue([
      { clubCode: "C1", name: "Real Madrid", teamsCount: 1 },
    ]),
    getClubTeams: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../TeamPlayersList/TeamPlayersList", () => ({
  default: () => <div data-testid="team-players-list" />,
}));

import { clubService as federationClubService } from "../../../../federation/services/Federation/ClubService";
import ClubPlayerSearch from "../ClubPlayerSearch";

describe("ClubPlayerSearch — RFFM season selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [{ id: 22, label: "2026-2027" }],
      setSeasonId: vi.fn(),
    });
  });

  it("renders the RFFM season selector alongside the Coach season selector", async () => {
    render(<ClubPlayerSearch clubId="club-1" defaultSeasonId="s1" />);

    await screen.findByText("Real Madrid");
    expect(screen.getByLabelText("Temporada RFFM")).toBeInTheDocument();
    expect(screen.getByLabelText("Temporada")).toBeInTheDocument();
  });

  it("passes the RFFM seasonId to federationClubService.getClubTeams once a category is selected", async () => {
    render(<ClubPlayerSearch clubId="club-1" defaultSeasonId="s1" />);

    await screen.findByText("Real Madrid");

    fireEvent.mouseDown(screen.getByLabelText("Categoría"));
    fireEvent.click(await screen.findByRole("option", { name: "Alevines" }));

    await waitFor(() =>
      expect(federationClubService.getClubTeams).toHaveBeenCalledWith(
        "C1",
        22,
      ),
    );
  });
});
