import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FatigueBreakdownView from "../FatigueBreakdownView";
import { buildFatigueBreakdown } from "./breakdownFixtures";

describe("FatigueBreakdownView", () => {
  it("lista entrenos y partidos con fecha, tipo, peso y aportación", () => {
    render(
      <FatigueBreakdownView
        value={20}
        breakdown={buildFatigueBreakdown({
          consideredTrainings: [
            {
              eventId: "t1",
              eventDate: "2026-08-12T18:00:00Z",
              trainingTypes: ["Fisico"],
              daysAgo: 2,
              decay: 0.9,
              typeWeight: 1.2,
              contribution: 1.08,
            },
          ],
          consideredMatches: [
            {
              eventId: "m1",
              eventDate: "2026-08-15T11:00:00Z",
              eventTypeId: 4,
              minutesPlayed: 45,
              daysAgo: 1,
              decay: 1,
              typeWeight: 0.8,
              effectiveMinutes: 36,
            },
          ],
        })}
      />,
    );
    const t = screen.getByTestId("fatigue-training-item");
    expect(t).toHaveTextContent("12/08");
    expect(t).toHaveTextContent("Físico");
    expect(t).toHaveTextContent("peso 1,2");
    const m = screen.getByTestId("fatigue-match-item");
    expect(m).toHaveTextContent("15/08");
    expect(m).toHaveTextContent("Amistoso");
    expect(m).toHaveTextContent("45'");
  });

  it("muestra la línea de cálculo con los pesos del DTO", () => {
    render(<FatigueBreakdownView value={20} breakdown={buildFatigueBreakdown()} />);
    expect(screen.getByText("0,4 × 15% + 0,6 × 25% = 20%")).toBeInTheDocument();
  });

  it("indica que no hay eventos recientes cuando las listas están vacías", () => {
    render(<FatigueBreakdownView value={0} breakdown={buildFatigueBreakdown()} />);
    expect(screen.getByText(/No hay entrenos ni partidos recientes/)).toBeInTheDocument();
  });
});
