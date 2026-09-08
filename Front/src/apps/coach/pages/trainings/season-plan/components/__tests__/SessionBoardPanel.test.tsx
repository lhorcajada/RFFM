import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
import SessionBoardPanel from "../SessionBoardPanel";
import type { TrainingSession } from "../../../../types/training";

function buildSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "sess-1",
    name: "Sesión 1",
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

function renderPanel(props: Partial<React.ComponentProps<typeof SessionBoardPanel>> = {}) {
  return render(
    <DndContext>
      <SessionBoardPanel
        sessions={[]}
        textoMap={new Map()}
        onCreateSession={vi.fn()}
        onRemoveTarget={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAssignDate={vi.fn()}
        {...props}
      />
    </DndContext>
  );
}

describe("SessionBoardPanel — secciones Sin programar / Programadas", () => {
  it("muestra las sesiones sin fecha en la sección «Sin programar» y las programadas en «Programadas»", () => {
    renderPanel({
      sessions: [
        buildSession({ id: "sess-1", name: "Sin programar", date: null }),
        buildSession({ id: "sess-2", name: "Programada", date: "2026-09-10" }),
      ],
    });

    expect(screen.getByText("Sin programar", { selector: "h3,h2,h4,p,span" })).toBeInTheDocument();
    expect(screen.getByText("Programadas", { selector: "h3,h2,h4,p,span" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sin programar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Programada")).toBeInTheDocument();
  });

  it("ambas secciones son droppable (cada tarjeta expone su propio drop target)", () => {
    renderPanel({
      sessions: [
        buildSession({ id: "sess-1", name: "Sin programar", date: null }),
        buildSession({ id: "sess-2", name: "Programada", date: "2026-09-10" }),
      ],
    });

    expect(screen.getByTestId("session-card-sess-1")).toBeInTheDocument();
    expect(screen.getByTestId("session-card-sess-2")).toBeInTheDocument();
  });

  it('muestra un mensaje vacío en "Sin programar" cuando solo hay sesiones programadas', () => {
    renderPanel({ sessions: [buildSession({ id: "sess-2", name: "Programada", date: "2026-09-10" })] });

    expect(screen.getByText(/no hay sesiones sin programar/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay sesiones programadas/i)).not.toBeInTheDocument();
  });

  it('muestra un mensaje vacío en "Programadas" cuando solo hay sesiones sin programar', () => {
    renderPanel({ sessions: [buildSession({ id: "sess-1", name: "Sin programar", date: null })] });

    expect(screen.getByText(/no hay sesiones programadas/i)).toBeInTheDocument();
  });

  it("muestra ambos mensajes vacíos cuando no hay ninguna sesión", () => {
    renderPanel({ sessions: [] });

    expect(screen.getByText(/no hay sesiones sin programar/i)).toBeInTheDocument();
    expect(screen.getByText(/no hay sesiones programadas/i)).toBeInTheDocument();
  });
});

describe("SessionBoardPanel — crear sesión", () => {
  it('el botón "+ Nueva sesión" llama a onCreateSession', async () => {
    const onCreateSession = vi.fn();
    renderPanel({ onCreateSession });

    await userEvent.click(screen.getByRole("button", { name: /nueva sesión/i }));

    expect(onCreateSession).toHaveBeenCalled();
  });
});
