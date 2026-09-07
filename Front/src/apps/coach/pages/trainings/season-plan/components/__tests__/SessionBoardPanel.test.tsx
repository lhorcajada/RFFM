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

describe("SessionBoardPanel — solo sesiones sin fecha", () => {
  it("renderiza únicamente las sesiones con date === null", () => {
    renderPanel({
      sessions: [
        buildSession({ id: "sess-1", name: "Sin programar", date: null }),
        buildSession({ id: "sess-2", name: "Programada", date: "2026-09-10" }),
      ],
    });

    expect(screen.getByDisplayValue("Sin programar")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Programada")).not.toBeInTheDocument();
  });

  it('muestra un mensaje vacío cuando no hay sesiones sin programar', () => {
    renderPanel({ sessions: [] });

    expect(screen.getByText(/no hay sesiones sin programar/i)).toBeInTheDocument();
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
