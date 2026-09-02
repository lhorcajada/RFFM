import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchZoneGrid from "../PitchZoneGrid";

describe("PitchZoneGrid", () => {
  it("renders 5x10 = 50 cells with no visible text", () => {
    render(<PitchZoneGrid value={null} onChange={vi.fn()} />);
    const cells = screen.getAllByRole("button");
    expect(cells).toHaveLength(50);
    for (const cell of cells) {
      expect(cell.textContent).toBe("");
    }
  });

  it("calls onChange with the right coordinates when a cell is clicked", async () => {
    const onChange = vi.fn();
    render(<PitchZoneGrid value={null} onChange={onChange} />);
    const cells = screen.getAllByRole("button");
    // 5 columns per row -> index 2*5 + 7 = 17 is col=2, row=7
    await userEvent.click(cells[7 * 5 + 2]);
    expect(onChange).toHaveBeenCalledWith({ col: 2, row: 7 });
  });
});
