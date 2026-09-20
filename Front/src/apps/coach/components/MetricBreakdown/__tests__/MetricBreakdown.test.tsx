import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormStatusBreakdownView from "../FormStatusBreakdownView";
import FatigueBreakdownView from "../FatigueBreakdownView";
import ReadinessBreakdownView from "../ReadinessBreakdownView";
import {
  buildFatigueBreakdown,
  buildFormStatusBreakdown,
  buildReadinessBreakdown,
} from "./breakdownFixtures";

const training = (over = {}) => ({
  eventId: "t1",
  eventDate: "2026-08-12T18:00:00Z",
  trainingTypes: ["Fisico"],
  daysAgo: 3,
  recencyWeight: 1,
  typeWeight: 1,
  offeredLoad: 1,
  attended: true,
  receivedLoad: 1,
  absenceReason: null,
  ...over,
});

const match = (over = {}) => ({
  eventId: "m1",
  eventDate: "2026-08-15T11:00:00Z",
  eventTypeId: 1,
  daysAgo: 1,
  recencyWeight: 1,
  minutesPlayed: 60,
  fullMatchMinutes: 70,
  ratio: 0.86,
  contribution: 0.86,
  status: "Played" as const,
  ...over,
});

describe("FormStatusBreakdownView", () => {
  it("muestra los cuatro pasos en orden: Entrenos, Partidos, Cansancio y Resultado", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringMatching(/^Entrenos \(55%\)/),
      expect.stringMatching(/^Partidos \(45%\)/),
      expect.stringMatching(/^Cansancio 20%/),
      expect.stringMatching(/^Resultado/),
    ]);
  });

  it("explica la carga recibida sobre la ofrecida y el porcentaje de entrenos", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    expect(
      screen.getByText("Recibiste 2 de 4 de carga ofrecida (2 de 4 sesiones) → 50%"),
    ).toBeInTheDocument();
  });

  it("lista cada sesión con fecha dd/mm, tipo, peso, recencia y asistencia", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({
          consideredTrainings: [
            training(),
            training({
              eventId: "t2",
              eventDate: "2026-08-05T18:00:00Z",
              trainingTypes: ["Tactico", "Tecnico"],
              recencyWeight: 0.5,
              attended: false,
              receivedLoad: 0,
              absenceReason: "Lesión",
            }),
          ],
        })}
        value={65}
      />,
    );
    const items = screen.getAllByTestId("form-training-item");
    expect(items[0]).toHaveTextContent("12/08");
    expect(items[0]).toHaveTextContent("Físico");
    expect(items[0]).toHaveTextContent("cuenta completo");
    expect(items[0]).toHaveTextContent("asistió");
    expect(items[1]).toHaveTextContent("05/08");
    expect(items[1]).toHaveTextContent("Táctico, Técnico");
    expect(items[1]).toHaveTextContent("cuenta a la mitad");
    expect(items[1]).toHaveTextContent("faltó: Lesión");
  });

  it("explica los minutos jugados sobre los minutos completos de la categoría", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    expect(
      screen.getByText(/minutos jugados sobre 70' de partido completo \(categoría de 80'\)/),
    ).toBeInTheDocument();
  });

  it("lista los partidos con tipo, minutos y estado", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({
          consideredMatches: [
            match(),
            match({ eventId: "m2", eventTypeId: 4, minutesPlayed: 0, ratio: 0, status: "NotPlayed" }),
            match({ eventId: "m3", eventTypeId: 6, minutesPlayed: 0, ratio: 0, status: "Absent" }),
          ],
        })}
        value={65}
      />,
    );
    const items = screen.getAllByTestId("form-match-item");
    expect(items[0]).toHaveTextContent("15/08");
    expect(items[0]).toHaveTextContent("Liga");
    expect(items[0]).toHaveTextContent("60'");
    expect(items[0]).toHaveTextContent("jugó");
    expect(items[1]).toHaveTextContent("Amistoso");
    expect(items[1]).toHaveTextContent("convocado, no jugó");
    expect(items[2]).toHaveTextContent("Torneo");
    expect(items[2]).toHaveTextContent("no estuvo");
  });

  it("muestra el cansancio y su factor", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    expect(screen.getByText(/factor 0,9 \(1 − 20 \/ 200\)/)).toBeInTheDocument();
  });

  it("muestra la fórmula final con el resultado", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    expect(screen.getByText("(0,55 × 50% + 0,45 × 100%) × 0,9 = 65%")).toBeInTheDocument();
  });

  it("sin partidos en la ventana avisa y usa los pesos aplicados", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({
          matchComponent: null,
          matchesConsidered: 0,
          trainingWeightApplied: 1,
          matchWeightApplied: 0,
        })}
        value={45}
      />,
    );
    expect(
      screen.getByText(/No hay partidos en la ventana; el resultado se calcula solo con entrenos/),
    ).toBeInTheDocument();
    expect(screen.getByText("(1 × 50%) × 0,9 = 45%")).toBeInTheDocument();
  });

  it("sin entrenos en la ventana avisa que se calcula solo con partidos", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({
          trainingComponent: null,
          trainingWeightApplied: 0,
          matchWeightApplied: 1,
        })}
        value={90}
      />,
    );
    expect(
      screen.getByText(/No hay entrenos en la ventana; el resultado se calcula solo con partidos/),
    ).toBeInTheDocument();
  });

  it("avisa cuando se usó el peso de tipo por defecto", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({ trainingTypeWeightFallbackUsed: true })}
        value={65}
      />,
    );
    expect(screen.getByText(/Las sesiones Técnicas puras se cuentan con peso 1/)).toBeInTheDocument();
  });

  it("indica la regla de recencia y los eventos excluidos", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({ excludedTrainings: 1, excludedMatches: 1 })}
        value={65}
      />,
    );
    expect(screen.getByText(/últimos 7 días cuentan completos/)).toBeInTheDocument();
    expect(screen.getByText(/2 eventos excluidos por decisión técnica o sin resultado/)).toBeInTheDocument();
  });

  it("muestra el porcentaje de cada partido sobre el partido completo", () => {
    render(
      <FormStatusBreakdownView
        breakdown={buildFormStatusBreakdown({ consideredMatches: [match()] })}
        value={65}
      />,
    );
    expect(screen.getByTestId("form-match-item")).toHaveTextContent("86% del partido completo");
  });

  it("no muestra el aviso de tipos cuando no se usó el peso por defecto", () => {
    render(<FormStatusBreakdownView breakdown={buildFormStatusBreakdown()} value={65} />);
    expect(screen.queryByText(/Técnicas puras/)).not.toBeInTheDocument();
  });
});

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

describe("ReadinessBreakdownView", () => {
  it("muestra el motivo, la fecha y el impacto de las ausencias recientes", () => {
    render(
      <ReadinessBreakdownView
        value={40}
        breakdown={buildReadinessBreakdown({
          recentAbsences: [{ eventId: "e1", date: "2026-08-01T00:00:00Z", reason: "Lesión", pointsImpact: -90 }],
        })}
      />,
    );
    const item = screen.getByTestId("readiness-absence-item");
    expect(item).toHaveTextContent("01/08");
    expect(item).toHaveTextContent("Lesión");
    expect(item).toHaveTextContent("-90");
  });

  it("lista los entrenos considerados y la línea de cálculo", () => {
    render(
      <ReadinessBreakdownView
        value={39}
        breakdown={buildReadinessBreakdown({
          consideredTrainings: [
            {
              eventId: "t1",
              eventDate: "2026-08-12T18:00:00Z",
              trainingTypes: ["Tecnico"],
              countsTowardScore: true,
              points: 10,
              typeWeight: 1,
              contribution: 10,
              reason: "",
            },
          ],
        })}
      />,
    );
    const list = screen.getByTestId("readiness-training-list");
    expect(within(list).getByText(/12\/08/)).toBeInTheDocument();
    expect(screen.getByText("0,7 × 30% + 0,3 × 60% = 39%")).toBeInTheDocument();
  });
});
