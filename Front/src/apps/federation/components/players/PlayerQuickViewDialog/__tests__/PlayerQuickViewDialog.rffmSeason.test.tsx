import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseRffmSeason = vi.fn();

vi.mock("../../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => mockUseRffmSeason(),
}));

vi.mock("../../../../services/api", () => ({
  getPlayer: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../../../shared/services/imageService", () => ({
  fetchImage: vi.fn().mockResolvedValue(null),
}));

import { getPlayer } from "../../../../services/api";
import PlayerQuickViewDialog from "../PlayerQuickViewDialog";

describe("PlayerQuickViewDialog — RFFM season fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [{ id: 22, label: "2026-2027" }],
      setSeasonId: vi.fn(),
    });
  });

  it("uses the explicit seasonId prop when provided, ignoring the RFFM context", async () => {
    render(
      <PlayerQuickViewDialog
        open
        playerCode="P1"
        seasonId="21"
        onClose={() => {}}
      />,
    );

    await waitFor(() =>
      expect(getPlayer).toHaveBeenCalledWith("P1", { seasonId: "21" }),
    );
  });

  it("falls back to the RFFM context season when no seasonId prop is passed", async () => {
    render(
      <PlayerQuickViewDialog open playerCode="P1" onClose={() => {}} />,
    );

    await waitFor(() =>
      expect(getPlayer).toHaveBeenCalledWith("P1", { seasonId: "22" }),
    );
  });
});
