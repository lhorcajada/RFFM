import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SessionsList from "../SessionsList";
import type { TrainingSession } from "../../../../types/training";

function session(overrides: Partial<TrainingSession> & { id: string }): TrainingSession {
  return {
    name: `Sesión ${overrides.id}`,
    description: "",
    date: null,
    startTime: null,
    isAssociatedToPlan: false,
    exerciseCount: 0,
    targets: [],
    ...overrides,
  };
}

function plannedSession(id: string, date: string): TrainingSession {
  return session({
    id,
    date,
    isAssociatedToPlan: true,
    microcicloId: "mi1",
    microcicloWeekLabel: "Semana 1",
    microcicloOrder: 1,
    mesocicloId: "me1",
    mesocicloName: "Mesociclo 1.1",
    mesocicloOrder: 1,
    macrocicloId: "ma1",
    macrocicloName: "Macrociclo 1",
    macrocicloOrder: 1,
  });
}

const handlers = {
  onToggleSelected: vi.fn(),
  onView: vi.fn(),
  onPrint: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

function renderList(sessions: TrainingSession[]) {
  return render(<SessionsList sessions={sessions} selectedIds={[]} {...handlers} />);
}

describe("SessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las sesiones del plan bajo su macrociclo, mesociclo y microciclo", () => {
    renderList([plannedSession("a", "2026-09-02"), plannedSession("b", "2026-09-05")]);

    expect(screen.getByText("Macrociclo 1")).toBeInTheDocument();
    expect(screen.getByText("Mesociclo 1.1")).toBeInTheDocument();
    expect(screen.getByText("Semana 1 · 2 sesiones")).toBeInTheDocument();
  });

  it("lista las sesiones de un microciclo de la más reciente a la más antigua", () => {
    renderList([plannedSession("a", "2026-09-02"), plannedSession("b", "2026-09-05")]);

    const names = screen.getAllByText(/^Sesión [ab]$/).map((n) => n.textContent);
    expect(names).toEqual(["Sesión b", "Sesión a"]);
  });

  it("agrupa las sesiones sin microciclo en Sesiones libres, primero las sin fecha", () => {
    renderList([session({ id: "dated", date: "2026-09-01" }), session({ id: "unscheduled", date: null })]);

    expect(screen.getByText("Sesiones libres · 2 sesiones")).toBeInTheDocument();
    const names = screen.getAllByText(/^Sesión (dated|unscheduled)$/).map((n) => n.textContent);
    expect(names).toEqual(["Sesión unscheduled", "Sesión dated"]);
  });

  it("muestra 10 sesiones libres y el resto al pulsar Ver más", async () => {
    const free = Array.from({ length: 12 }, (_, i) =>
      session({ id: `f${i}`, date: `2026-09-${String(i + 1).padStart(2, "0")}` }),
    );
    const user = userEvent.setup();
    renderList(free);

    expect(screen.getAllByText(/^Sesión f\d+$/)).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Ver más" }));

    expect(screen.getAllByText(/^Sesión f\d+$/)).toHaveLength(12);
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("llama a onEdit con la sesión al pulsar Editar", async () => {
    const user = userEvent.setup();
    renderList([session({ id: "x", date: "2026-09-01" })]);

    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(handlers.onEdit).toHaveBeenCalledWith("x");
  });
});
