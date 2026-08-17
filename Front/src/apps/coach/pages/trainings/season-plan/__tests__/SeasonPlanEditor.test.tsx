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
                objetivoSesionA: "A",
                objetivoSesionB: "B",
                exerciseCount: 0,
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
              },
            ],
          },
        ],
      },
    ],
  };
}

const emptyAdnOptions = { subprincipios: [], subSubPrincipios: [] };

const adnOptionsWithData = {
  subprincipios: [{ id: "sub-1", numero: "1.1", titulo: "Presión alta", gameMomentName: "Fase defensiva" }],
  subSubPrincipios: [{ id: "ssp-1", numero: "1.1.1", rol: "Central", subprincipioId: "sub-1" }],
};

describe("SeasonPlanEditor — añadir / eliminar macrociclos", () => {
  it("empieza sin macrociclos y añade uno al pulsar 'Añadir macrociclo'", async () => {
    render(
      <SeasonPlanEditor
        draft={emptyDraft()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByLabelText(/nombre del macrociclo/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /añadir macrociclo/i }));

    expect(screen.getByLabelText(/nombre del macrociclo/i)).toBeInTheDocument();
  });

  it("elimina un macrociclo existente al pulsar 'Eliminar macrociclo'", async () => {
    render(
      <SeasonPlanEditor
        draft={draftWithOneMacrociclo()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Macrociclo 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /eliminar macrociclo/i }));

    expect(screen.queryByDisplayValue("Macrociclo 1")).not.toBeInTheDocument();
  });

  it("permite editar el nombre de un macrociclo", async () => {
    render(
      <SeasonPlanEditor
        draft={draftWithOneMacrociclo()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
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
      <SeasonPlanEditor
        draft={draftWithOneMacrociclo()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "plan-1", teamId: "team-1", seasonId: "season-1" })
    );
  });

  it('llama a onCancel al pulsar "Cancelar"', async () => {
    const onCancel = vi.fn();
    render(
      <SeasonPlanEditor
        draft={draftWithOneMacrociclo()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe("SeasonPlanEditor — enlaces ADN por sesión", () => {
  it("selecciona un Subprincipio para la Sesión A y lo persiste en el payload de guardado", async () => {
    const onSave = vi.fn();
    render(
      <SeasonPlanEditor
        draft={draftWithMicrociclo()}
        zones={zones}
        adnOptions={adnOptionsWithData}
        saving={false}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /mesociclo 1\.1/i }));

    const subprincipioInput = screen.getByRole("combobox", { name: "Subprincipio — Sesión A" });
    await userEvent.click(subprincipioInput);
    await userEvent.click(await screen.findByText("1.1 · Presión alta"));

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macrociclos: [
          expect.objectContaining({
            mesociclos: [
              expect.objectContaining({
                microciclos: [expect.objectContaining({ sesionASubprincipioIds: ["sub-1"] })],
              }),
            ],
          }),
        ],
      })
    );
  });

  it("muestra el mensaje de guía y deshabilita los selectores de Subprincipio/SubSubPrincipio cuando el equipo no tiene GameModel, sin bloquear Habilidad", async () => {
    render(
      <SeasonPlanEditor
        draft={draftWithMicrociclo()}
        zones={zones}
        adnOptions={emptyAdnOptions}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /mesociclo 1\.1/i }));

    expect(screen.getByText(/añade primero el modelo adn del equipo/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Subprincipio — Sesión A" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "SubSubPrincipio — Sesión A" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Habilidad — Sesión A" })).not.toBeDisabled();
  });
});
