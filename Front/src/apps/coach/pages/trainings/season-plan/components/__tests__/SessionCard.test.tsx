import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SessionCard from "../SessionCard";
import type { TrainingSession, SessionTargetDetail } from "../../../../types/training";

function buildTarget(overrides: Partial<SessionTargetDetail> = {}): SessionTargetDetail {
  return {
    subSubPrincipioId: "ssp-1",
    rol: "Central",
    numero: "1.1.1",
    subprincipioId: "sub-1",
    subprincipioTitulo: "Presión alta",
    zonaId: null,
    zonaLabel: null,
    principioId: "principle-1",
    principioTitulo: "Defensa organizada",
    gameMomentId: 1,
    gameMomentName: "Fase defensiva",
    ...overrides,
  };
}

function buildSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "sess-1",
    name: "Sesión sin programar",
    description: "",
    date: null,
    startTime: null,
    endTime: null,
    location: null,
    sportEventId: null,
    sportEventName: null,
    microcicloId: null,
    microcicloWeekLabel: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof SessionCard>> = {}) {
  return render(
    <DndContext>
      <SessionCard
        session={buildSession()}
        textoMap={new Map()}
        onRemoveTarget={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAssignDate={vi.fn()}
        {...props}
      />
    </DndContext>
  );
}

describe("SessionCard — árbol de objetivos", () => {
  it("renderiza el árbol con la Zona como rama cuando el target la tiene", () => {
    renderCard({
      session: buildSession({
        targets: [buildTarget({ zonaId: "zona-1", zonaLabel: "Ataque del centro" })],
      }),
    });

    expect(screen.getByText("Ataque del centro")).toBeInTheDocument();
    expect(screen.getByText(/1\.1\.1/)).toBeInTheDocument();
  });

  it("omite la rama de Zona cuando el target no tiene Zona", () => {
    renderCard({ session: buildSession({ targets: [buildTarget()] }) });

    expect(screen.queryByText("Ataque del centro")).not.toBeInTheDocument();
    expect(screen.getByText(/1\.1\.1/)).toBeInTheDocument();
  });

  it("muestra la descripción del sub-subprincipio resuelta desde textoMap", () => {
    renderCard({
      session: buildSession({ targets: [buildTarget()] }),
      textoMap: new Map([["ssp-1", "Cierra el pasillo interior."]]),
    });

    expect(screen.getByText("Cierra el pasillo interior.")).toBeInTheDocument();
  });

  it("pulsar el botón de eliminar de una hoja llama a onRemoveTarget con el id correcto", async () => {
    const onRemoveTarget = vi.fn();
    renderCard({ session: buildSession({ targets: [buildTarget()] }), onRemoveTarget });

    await userEvent.click(screen.getByRole("button", { name: /eliminar objetivo/i }));

    expect(onRemoveTarget).toHaveBeenCalledWith("sess-1", "ssp-1");
  });
});

describe("SessionCard — Asignar fecha / eliminar / renombrar", () => {
  it('el botón "Asignar fecha" llama a onAssignDate con el id de la sesión', async () => {
    const onAssignDate = vi.fn();
    renderCard({ onAssignDate });

    await userEvent.click(screen.getByRole("button", { name: /asignar fecha/i }));

    expect(onAssignDate).toHaveBeenCalledWith("sess-1");
  });

  it("el botón de eliminar sesión llama a onDelete con el id de la sesión", async () => {
    const onDelete = vi.fn();
    renderCard({ onDelete });

    await userEvent.click(screen.getByRole("button", { name: /eliminar sesión/i }));

    expect(onDelete).toHaveBeenCalledWith("sess-1");
  });

  it("editar el nombre y perder el foco (blur) llama a onRename con el nuevo nombre", async () => {
    const onRename = vi.fn();
    renderCard({ onRename });

    const nameField = screen.getByDisplayValue("Sesión sin programar");
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Nuevo nombre");
    await userEvent.tab();

    expect(onRename).toHaveBeenCalledWith("sess-1", "Nuevo nombre");
  });
});
