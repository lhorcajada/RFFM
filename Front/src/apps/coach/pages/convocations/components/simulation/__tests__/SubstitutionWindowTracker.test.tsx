import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SubstitutionWindowTracker from "../SubstitutionWindowTracker";

const baseProps = {
  windowsTotal: 5,
  windowsInSecondHalf: 1,
  canOpenWindow: true,
  half: 1 as const,
  prepareMode: false,
  onPrepare: vi.fn(),
  onCancel: vi.fn(),
  onCommit: vi.fn(),
};

describe("SubstitutionWindowTracker - unlimited dot-counter branch", () => {
  it("renders the raw count with no /MAX denominator when unlimitedWindows and showCounters=true", () => {
    render(<SubstitutionWindowTracker {...baseProps} unlimitedWindows showCounters />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText(/\/4/)).not.toBeInTheDocument();
  });

  it("keeps the existing showCounters=false 'Infinitos' behavior unchanged (regression)", () => {
    render(<SubstitutionWindowTracker {...baseProps} unlimitedWindows showCounters={false} />);
    expect(screen.getByText("Infinitos")).toBeInTheDocument();
  });

  it("keeps the normal /MAX denominator when unlimitedWindows is false", () => {
    render(<SubstitutionWindowTracker {...baseProps} windowsTotal={2} showCounters />);
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });
});
