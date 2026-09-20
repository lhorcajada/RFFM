import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormStatusBreakdownView from "../FormStatusBreakdownView";
import { buildFormStatusBreakdown } from "./breakdownFixtures";

describe("FormStatusBreakdownView factor de volumen", () => {
  it("muestra la línea de sesiones de referencia cuando el factor de entrenos es menor que 1", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({
          trainingVolumeFactor: 0.58,
          trainingSessionsAttended: 7,
          referenceTrainingSessions: 12,
        })}
        value={65}
      />,
    );
    expect(
      screen.getByText(/Llevas 7 de 12 sesiones de referencia \(factor 0,58\)/),
    ).toBeInTheDocument();
  });

  it("muestra los minutos jugados sobre los posibles en el resumen de partidos", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({ matchMinutesPlayedTotal: 134, matchMinutesPossibleTotal: 160 })}
        value={65}
      />,
    );
    expect(screen.getByText(/Jugaste 134' de 160' posibles/)).toBeInTheDocument();
  });

  it("no muestra la línea de referencia si el factor de entrenos es 1", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({ trainingVolumeFactor: 1 })}
        value={65}
      />,
    );
    expect(screen.queryByText(/de referencia/)).not.toBeInTheDocument();
  });
});
