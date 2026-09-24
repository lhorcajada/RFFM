import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DailyLoadBreakdownView from "../DailyLoadBreakdownView";
import { buildActivityStep, buildDailyLoadBreakdown } from "./breakdownFixtures";

describe("DailyLoadBreakdownView", () => {
  it("explica la regla con los días de gracia y la pérdida máxima del desglose", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown()} />);
    expect(
      screen.getByText(
        "Cada entreno o partido suma. Tras 4 días seguidos sin actividad empieza a bajar, cada día un poco más (hasta 3 puntos al día).",
      ),
    ).toBeInTheDocument();
  });

  it("indica cuántos días faltan para empezar a bajar dentro de la gracia", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown({ currentRestStreakDays: 2 })} />);
    expect(screen.getByText("Lleva 2 días sin actividad: empieza a bajar en 3 días.")).toBeInTheDocument();
  });

  it("indica desde cuándo está bajando pasada la gracia", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown({ currentRestStreakDays: 7 })} />);
    expect(screen.getByText("Lleva 7 días sin actividad: bajando desde hace 3 días.")).toBeInTheDocument();
  });

  it("sin racha de descanso indica que no lleva días sin actividad (hoy no cuenta hasta que acaba)", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown({ currentRestStreakDays: 0 })} />);
    expect(screen.getByText("No lleva ningún día sin actividad.")).toBeInTheDocument();
  });

  it("resume entrenos, partidos y minutos del periodo reproducido", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown()} />);
    expect(screen.getByText("9 entrenos y 2 partidos (125') en los últimos 84 días.")).toBeInTheDocument();
  });

  it("lista cada día con actividad con sus eventos y cuánto sumó", () => {
    render(
      <DailyLoadBreakdownView
        breakdown={buildDailyLoadBreakdown({
          steps: [
            buildActivityStep({
              date: "2026-09-21T00:00:00Z",
              load: 2.5,
              valueBefore: 66,
              valueAfter: 72.5,
              events: [
                { eventId: "t2", eventTypeId: 2, trainingTypes: ["Tactico"], minutesPlayed: 0, typeWeight: 0.5, load: 0.5 },
                { eventId: "m1", eventTypeId: 4, trainingTypes: [], minutesPlayed: 60, typeWeight: 1, load: 1.29 },
              ],
            }),
          ],
        })}
      />,
    );
    const item = screen.getByTestId("daily-load-step");
    expect(item).toHaveTextContent("21/09");
    expect(item).toHaveTextContent("Táctico + Amistoso 60'");
    expect(item).toHaveTextContent("+6,5 (66 → 72,5)");
  });

  it("lista las rachas de descanso con pérdida con su rango de fechas", () => {
    render(
      <DailyLoadBreakdownView
        breakdown={buildDailyLoadBreakdown({
          steps: [
            {
              date: "2026-09-15T00:00:00Z",
              endDate: "2026-09-18T00:00:00Z",
              kind: "Decay",
              load: 0,
              valueBefore: 80,
              valueAfter: 75.5,
              events: [],
            },
          ],
        })}
      />,
    );
    const item = screen.getByTestId("daily-load-step");
    expect(item).toHaveTextContent("15/09 – 18/09");
    expect(item).toHaveTextContent("Sin actividad");
    expect(item).toHaveTextContent("−4,5 (80 → 75,5)");
  });

  it("muestra los eventos sin actividad con su motivo", () => {
    render(
      <DailyLoadBreakdownView
        breakdown={buildDailyLoadBreakdown({
          missedEvents: [
            { eventId: "t9", date: "2026-09-18T00:00:00Z", eventTypeId: 2, reason: "Lesión" },
            { eventId: "m9", date: "2026-09-14T00:00:00Z", eventTypeId: 1, reason: "Convocado sin jugar" },
          ],
        })}
      />,
    );
    const section = screen.getByRole("region", { name: "Días sin actividad" });
    const items = within(section).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("18/09");
    expect(items[0]).toHaveTextContent("Entreno");
    expect(items[0]).toHaveTextContent("Lesión");
    expect(items[1]).toHaveTextContent("Liga");
    expect(items[1]).toHaveTextContent("Convocado sin jugar");
  });

  it("no muestra la sección de días sin actividad si no hay ninguno", () => {
    render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown({ missedEvents: [] })} />);
    expect(screen.queryByRole("region", { name: "Días sin actividad" })).not.toBeInTheDocument();
  });

  it("no usa tablas", () => {
    const { container } = render(<DailyLoadBreakdownView breakdown={buildDailyLoadBreakdown()} />);
    expect(container.querySelector("table")).toBeNull();
  });
});
