import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseGoalSectorsComparison = vi.fn();

vi.mock("../hooks/useGoalSectorsComparison", () => ({
  useGoalSectorsComparison: () => mockUseGoalSectorsComparison(),
}));

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../Components/GoalSectorsComparisonFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../Components/GoalSectorsComparisonFilters")>()),
  default: () => <div>Filtro</div>,
}));

import GoalSectorsComparison from "../GoalSectorsComparison";

const completeSelection = {
  team1: { competitionId: "100", groupId: "200", teamCode: "11" },
  team2: { competitionId: "300", groupId: "400", teamCode: "21" },
};

function hookState(overrides: Record<string, unknown> = {}) {
  return {
    comparison: { rows: [] },
    loading: false,
    error: null,
    selection: completeSelection,
    setSelection: vi.fn(),
    handleCompare: vi.fn(),
    sectorPopup: { open: false, loading: false, error: null, title: "", subtitle: "", matches: [] },
    closePopup: vi.fn(),
    handleGoalsAgainstClick: vi.fn(),
    ...overrides,
  };
}

function team(code: string, matchTime: number) {
  return {
    teamCode: code,
    teamName: `Equipo ${code}`,
    matchTime,
    matchesProcessed: 1,
    totalGoalsFor: 1,
    totalGoalsAgainst: 0,
    sectors: [],
  };
}

describe("GoalSectorsComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deshabilita Comparar si falta el equipo de un panel", () => {
    mockUseGoalSectorsComparison.mockReturnValue(
      hookState({
        selection: { ...completeSelection, team2: { ...completeSelection.team2, teamCode: "" } },
      }),
    );

    render(<GoalSectorsComparison />);

    expect(screen.getByRole("button", { name: "Comparar" })).toBeDisabled();
  });

  it("muestra ambos rangos cuando los equipos tienen distinta duración", () => {
    mockUseGoalSectorsComparison.mockReturnValue(
      hookState({
        comparison: {
          teamA: team("11", 80),
          teamB: team("21", 90),
          rows: [
            { index: 0, aStart: 1, aEnd: 14, bStart: 1, bEnd: 15, aGoals: 1, aAgainst: 0, bGoals: 1, bAgainst: 0 },
          ],
        },
      }),
    );

    render(<GoalSectorsComparison />);

    expect(screen.getAllByText("1-14' / 1-15'").length).toBeGreaterThan(0);
  });
});
