import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SeasonPlanView from "../SeasonPlanView";
import type { SeasonPlan } from "../../../../types/seasonPlan";

function emptyAdnLinks() {
  return {
    sesionASubprincipioIds: [],
    sesionASubSubPrincipioIds: [],
    sesionAHabilidades: [],
    sesionASubprincipios: [],
    sesionASubSubPrincipios: [],
    sesionBSubprincipioIds: [],
    sesionBSubSubPrincipioIds: [],
    sesionBHabilidades: [],
    sesionBSubprincipios: [],
    sesionBSubSubPrincipios: [],
  };
}

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
                objetivoSesionA: "Objetivo A",
                objetivoSesionB: "Objetivo B",
                exerciseCount: 0,
                ...emptyAdnLinks(),
              },
              {
                id: 4,
                apiId: "micro-2",
                order: 2,
                weekLabel: "Semana 2 — Situacional",
                startDate: "2026-09-08",
                endDate: "2026-09-14",
                objetivoSesionA: "Objetivo A2",
                objetivoSesionB: "Objetivo B2",
                exerciseCount: 3,
                ...emptyAdnLinks(),
                sesionASubprincipios: [
                  { id: "sub-1", numero: "1.1", titulo: "Defensa organizada", gameMomentName: "Fase defensiva" },
                ],
                sesionASubprincipioIds: ["sub-1"],
                sesionASubSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central" }],
                sesionASubSubPrincipioIds: ["ssp-1"],
                sesionAHabilidades: ["Perfilamiento"],
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
    render(<SeasonPlanView plan={null} loading={false} onCreatePlan={onCreatePlan} onCreateExercise={vi.fn()} />);

    expect(screen.getByText(/no hay planificación de temporada/i)).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: /crear planificación/i });
    expect(cta).toBeInTheDocument();
  });

  it("el CTA invoca onCreatePlan al hacer click", async () => {
    const onCreatePlan = vi.fn();
    render(<SeasonPlanView plan={null} loading={false} onCreatePlan={onCreatePlan} onCreateExercise={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /crear planificación/i }));

    expect(onCreatePlan).toHaveBeenCalled();
  });
});

describe("SeasonPlanView — árbol con badges de cobertura", () => {
  it("muestra un chip de advertencia para la semana con 0 ejercicios y un chip de cuenta para la que tiene 3", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateExercise={vi.fn()} />
    );

    expect(screen.getByText("Sin ejercicios")).toBeInTheDocument();
    expect(screen.getByText("3 ejercicios")).toBeInTheDocument();
  });

  it('llama a onCreateExercise con el id del microciclo al pulsar "Crear ejercicio"', async () => {
    const onCreateExercise = vi.fn();
    render(
      <SeasonPlanView
        plan={buildPlan()}
        loading={false}
        onCreatePlan={vi.fn()}
        onCreateExercise={onCreateExercise}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /crear ejercicio/i });
    await userEvent.click(buttons[0]);

    expect(onCreateExercise).toHaveBeenCalledWith("micro-1");
  });
});

describe("SeasonPlanView — enlaces ADN por sesión", () => {
  it("muestra chips de Subprincipio, SubSubPrincipio y Habilidad para la semana que tiene enlaces", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateExercise={vi.fn()} />
    );

    expect(screen.getByText("Defensa organizada 1.1")).toBeInTheDocument();
    expect(screen.getByText("1.1.1 · Central")).toBeInTheDocument();
    expect(screen.getByText("Perfilamiento")).toBeInTheDocument();
  });

  it("no renderiza chips ADN para la semana sin enlaces", () => {
    render(
      <SeasonPlanView plan={buildPlan()} loading={false} onCreatePlan={vi.fn()} onCreateExercise={vi.fn()} />
    );

    // "Semana 1" (microciclo id 3) tiene 0 enlaces — su fila no debe incluir ningún chip ADN
    const weekOneRow = screen.getByTestId("microciclo-row-3");
    expect(within(weekOneRow).queryByText(/1\.1\.1/)).not.toBeInTheDocument();
    expect(within(weekOneRow).queryByText("Perfilamiento")).not.toBeInTheDocument();
  });
});

describe("SeasonPlanView — loading", () => {
  it("muestra un indicador de carga cuando loading es true", () => {
    render(<SeasonPlanView plan={null} loading onCreatePlan={vi.fn()} onCreateExercise={vi.fn()} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
