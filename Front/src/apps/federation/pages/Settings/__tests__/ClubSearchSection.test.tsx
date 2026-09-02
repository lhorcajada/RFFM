import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseRffmSeason = vi.fn();

vi.mock("../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => mockUseRffmSeason(),
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

describe("ClubSearchSection — RFFM season wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [{ id: 22, label: "2026-2027" }],
      setSeasonId: vi.fn(),
    });
  });

  it("passes the current RFFM seasonId to searchClubs", async () => {
    vi.mocked(clubService.searchClubs).mockResolvedValue([]);

    render(<ClubSearchSection onTeamResolved={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nombre del club"), {
      target: { value: "Real Madrid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() =>
      expect(clubService.searchClubs).toHaveBeenCalledWith(
        "Real Madrid",
        undefined,
        22,
      ),
    );
  });

  it("passes the current RFFM seasonId to getClubTeams when a club is selected", async () => {
    vi.mocked(clubService.searchClubs).mockResolvedValue([
      { clubCode: "C1", name: "Real Madrid", teamsCount: 3 },
    ]);
    vi.mocked(clubService.getClubTeams).mockResolvedValue([]);

    render(<ClubSearchSection onTeamResolved={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nombre del club"), {
      target: { value: "Real Madrid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const clubItem = await screen.findByText(/Real Madrid/);
    fireEvent.click(clubItem);

    await waitFor(() =>
      expect(clubService.getClubTeams).toHaveBeenCalledWith("C1", 22),
    );
  });
});
