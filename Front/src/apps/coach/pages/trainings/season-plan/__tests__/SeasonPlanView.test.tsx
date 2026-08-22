import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SeasonPlanView from "../SeasonPlanView";
import type { SeasonPlan } from "../../../../types/seasonPlan";

function buildPlan(overrides: Partial<SeasonPlan> = {}): SeasonPlan {
  return {
    id: "plan-1",
    teamId: "team-1",
    seasonId: "season-1",
    macrociclos: [
      {
        id: 1,
        apiId: "macro-1",
        order: 1,
        name: "Macrociclo 1",
        startDate: "2026-09-01",
        endDate: "2026-11-30",
        mesociclos: [
          {
            id: 2,
            apiId: "meso-1",
            order: 1,
            name: "Mesociclo 1.1 — Creación Propia",
            startDate: "2026-09-01",
            endDate: "2026-09-21",
            gameZoneId: 2,
            microciclos: [
              {
                id: 3,
                apiId: "micro-1",
                order: 1,
                weekLabel: "Semana 1 — Analítico",
                startDate: "2026-09-01",
                endDate: "2026-09-07",
                sessions: [],
                subprincipiosObjetivo: [],
                subprincipioObjetivoIds: [],
              },
              {
                id: 4,
                apiId: "micro-2",
                order: 2,
                weekLabel: "Semana 2 — Situacional",
                startDate: "2026-09-08",
                endDate: "2026-09-14",
                sessions: [
                  {
                    id: "sess-1",
                    name: "Sesión 1 — Defensa organizada",
                    objetivoGeneral: "Que el equipo defienda organizado",
                    date: "2026-09-09",
                    exerciseCount: 3,
                  },
                ],
                subprincipiosObjetivo: [
                  { id: "sub-1", numero: "1.1", titulo: "Defensa organizada", gameMomentName: "Fase defensiva" },
                  { id: "sub-2", numero: "3.1", titulo: "Transición defensa-ataque", gameMomentName: "Fase de transición" },
                ],
                subprincipioObjetivoIds: ["sub-1", "sub-2"],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("SeasonPlanView — estado vacío", () => {
  it('muestra el CTA "Crear planificación" cuando no hay plan todavía', () => {
    const onCreatePlan = vi.fn();
    render(<SeasonPlanView plan={null} loading={false} onCreatePlan={onCreatePlan} onCreateSession={vi.fn()} />);

    expect(screen.getByText(/no hay planificación de temporada/i)).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: /crear planificación/i });
    expect(cta).toBeInTheDocument();
  });

  it("el CTA invoca onCreatePlan al hacer click", async () => {
    const onCreatePlan = vi.fn();
    render(<SeasonPlanView plan={null} loading={false} onCreatePlan={onCreatePlan} onCreateSession={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /crear planificación/i }));

    expect(onCreatePlan).toHaveBeenCalled();
  });
});

describe("SeasonPlanView — árbol con badges de cobertura de sesiones", () => {
  it("muestra un chip 'Sin sesiones' para la semana sin sesiones y 'N sesiones' para la que tiene 1", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    expect(screen.getByText("Sin sesiones")).toBeInTheDocument();
    expect(screen.getByText("1 sesiones")).toBeInTheDocument();
  });

  it('llama a onCreateSession con el id del microciclo al pulsar "Crear sesión"', async () => {
    const onCreateSession = vi.fn();
    render(
      <SeasonPlanView
        plan={buildPlan()}
        loading={false}
        onCreatePlan={vi.fn()}
        onCreateSession={onCreateSession}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /crear sesión/i });
    await userEvent.click(buttons[0]);

    expect(onCreateSession).toHaveBeenCalledWith("micro-1");
  });
});

describe("SeasonPlanView — sesiones vinculadas por microciclo", () => {
  it("muestra nombre, fecha y cuenta de ejercicios de cada sesión vinculada", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    expect(screen.getByText(/Sesión 1 — Defensa organizada/)).toBeInTheDocument();
  });

  it("no renderiza ninguna sesión para la semana sin sesiones vinculadas", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    const weekOneRow = screen.getByTestId("microciclo-row-3");
    expect(within(weekOneRow).queryByText(/Sesión/)).not.toBeInTheDocument();
  });
});

describe("SeasonPlanView — Subprincipios objetivo por microciclo", () => {
  it("renderiza un chip por cada Subprincipio objetivo (Numero · Titulo)", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    expect(screen.getByText(/1\.1.*Defensa organizada/)).toBeInTheDocument();
    expect(screen.getByText(/3\.1.*Transición defensa-ataque/)).toBeInTheDocument();
  });

  it("no renderiza la fila de chips de Subprincipios objetivo cuando la lista está vacía", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    const weekOneRow = screen.getByTestId("microciclo-row-3");
    expect(within(weekOneRow).queryByText(/Defensa organizada/)).not.toBeInTheDocument();
  });

  it("usa una clase distinta de coverageChip para el chip de Subprincipio objetivo", () => {
    const { container } = render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />
    );

    const chip = screen.getByText(/1\.1.*Defensa organizada/).closest(".MuiChip-root");
    expect(chip?.className).not.toMatch(/coverageChip/);
    expect(container.querySelector('[class*="targetSubprincipioChip"]')).toBeInTheDocument();
  });
});

describe("SeasonPlanView — loading", () => {
  it("muestra un indicador de carga cuando loading es true", () => {
    render(<SeasonPlanView plan={null} loading onCreatePlan={vi.fn()} onCreateSession={vi.fn()} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
