import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseRffmSeason = vi.fn();

vi.mock("../../../../context/RffmSeasonContext", () => ({
  useRffmSeason: () => mockUseRffmSeason(),
}));

import RffmSeasonSelector from "../RffmSeasonSelector";

describe("RffmSeasonSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the seasons list from the context", () => {
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [
        { id: 22, label: "2026-2027" },
        { id: 21, label: "2025-2026" },
      ],
      setSeasonId: vi.fn(),
    });

    render(<RffmSeasonSelector />);

    fireEvent.mouseDown(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "2026-2027" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2025-2026" })).toBeInTheDocument();
  });

  it("calls setSeasonId with the numeric id when the user selects a season", () => {
    const setSeasonId = vi.fn();
    mockUseRffmSeason.mockReturnValue({
      seasonId: 22,
      seasons: [
        { id: 22, label: "2026-2027" },
        { id: 21, label: "2025-2026" },
      ],
      setSeasonId,
    });

    render(<RffmSeasonSelector />);

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "2025-2026" }));

    expect(setSeasonId).toHaveBeenCalledWith(21);
  });

  it("shows an empty selection while seasonId is still loading", () => {
    mockUseRffmSeason.mockReturnValue({
      seasonId: null,
      seasons: [],
      setSeasonId: vi.fn(),
    });

    render(<RffmSeasonSelector />);

    // MUI renders a zero-width space placeholder for an empty Select value.
    expect(screen.getByRole("combobox").textContent).toBe("​");
  });
});
