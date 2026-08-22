import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SeasonPlanEditor from "../SeasonPlanEditor";
import type { SeasonPlan } from "../../../../types/seasonPlan";

const zones = [
  { id: 1, name: "Iniciación", order: 1 },
  { id: 2, name: "Creación Propia", order: 2 },
  { id: 3, name: "Creación Rival", order: 3 },
  { id: 4, name: "Finalización", order: 4 },
];

function emptyDraft(): SeasonPlan {
  return { id: "", teamId: "team-1", seasonId: "season-1", macrociclos: [] };
}

function draftWithOneMacrociclo(): SeasonPlan {
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
        mesociclos: [],
      },
    ],
  };
}

function draftWithMicrociclo(): SeasonPlan {
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
            name: "Mesociclo 1.1",
            startDate: "2026-09-01",
            endDate: "2026-09-21",
            gameZoneId: 2,
            microciclos: [
              {
                id: 3,
                apiId: "micro-1",
                order: 1,
                weekLabel: "Semana 1",
                startDate: "2026-09-01",
                endDate: "2026-09-07",
                sessions: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("SeasonPlanEditor — añadir / eliminar macrociclos", () => {
  it("empieza sin macrociclos y añade uno al pulsar 'Añadir macrociclo'", async () => {
    render(<SeasonPlanEditor draft={emptyDraft()} zones={zones} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/nombre del macrociclo/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /añadir macrociclo/i }));

    expect(screen.getByLabelText(/nombre del macrociclo/i)).toBeInTheDocument();
  });

  it("elimina un macrociclo existente al pulsar 'Eliminar macrociclo'", async () => {
    render(
      <SeasonPlanEditor draft={draftWithOneMacrociclo()} zones={zones} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByDisplayValue("Macrociclo 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /eliminar macrociclo/i }));

    expect(screen.queryByDisplayValue("Macrociclo 1")).not.toBeInTheDocument();
  });

  it("permite editar el nombre de un macrociclo", async () => {
    render(
      <SeasonPlanEditor draft={draftWithOneMacrociclo()} zones={zones} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );

    const input = screen.getByDisplayValue("Macrociclo 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Macrociclo renombrado");

    expect(screen.getByDisplayValue("Macrociclo renombrado")).toBeInTheDocument();
  });
});

describe("SeasonPlanEditor — guardar", () => {
  it("llama a onSave con el draft actual al pulsar 'Guardar'", async () => {
    const onSave = vi.fn();
    render(
      <SeasonPlanEditor draft={draftWithOneMacrociclo()} zones={zones} saving={false} onSave={onSave} onCancel={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "plan-1", teamId: "team-1", seasonId: "season-1" })
    );
  });

  it('llama a onCancel al pulsar "Cancelar"', async () => {
    const onCancel = vi.fn();
    render(
      <SeasonPlanEditor draft={draftWithOneMacrociclo()} zones={zones} saving={false} onSave={vi.fn()} onCancel={onCancel} />
    );

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe("SeasonPlanEditor — microciclo simplificado", () => {
  it("edita Semana/Inicio/Fin de un microciclo y los persiste al guardar (sin campos ADN)", async () => {
    const onSave = vi.fn();
    render(
      <SeasonPlanEditor draft={draftWithMicrociclo()} zones={zones} saving={false} onSave={onSave} onCancel={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: /mesociclo 1\.1/i }));

    const weekInput = screen.getByDisplayValue("Semana 1");
    await userEvent.clear(weekInput);
    await userEvent.type(weekInput, "Semana renombrada");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macrociclos: [
          expect.objectContaining({
            mesociclos: [
              expect.objectContaining({
                microciclos: [expect.objectContaining({ weekLabel: "Semana renombrada" })],
              }),
            ],
          }),
        ],
      })
    );
  });

  it("no renderiza ningún selector de SubSubPrincipio/Habilidad ni las secciones Sesión A/B (eliminadas)", async () => {
    render(
      <SeasonPlanEditor draft={draftWithMicrociclo()} zones={zones} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: /mesociclo 1\.1/i }));

    expect(screen.queryByText(/sesión a/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sesión b/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /subsubprincipio|habilidad/i })).not.toBeInTheDocument();
  });
});
