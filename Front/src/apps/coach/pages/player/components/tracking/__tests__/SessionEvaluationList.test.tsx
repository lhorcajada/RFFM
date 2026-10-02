import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionEvaluationList from "../SessionEvaluationList";
import type { PlayerSessionListItem } from "../../../../../services/playerTrackingService";

function item(overrides: Partial<PlayerSessionListItem> = {}): PlayerSessionListItem {
  return {
    sessionId: "ses-1",
    name: "10. Desorganizar rival",
    date: "2026-10-01",
    isHeld: true,
    hasCalendarEvent: true,
    assistanceTypeId: 1,
    evaluation: null,
    ...overrides,
  };
}

function renderList(items: PlayerSessionListItem[], handlers = { onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }) {
  render(<SessionEvaluationList items={items} loading={false} error={null} onRetry={vi.fn()} {...handlers} />);
  return handlers;
}

function card(label: string) {
  return screen.getByRole("listitem", { name: label });
}

describe("SessionEvaluationList", () => {
  it("muestra cada sesión en una tarjeta con fecha, nombre y asistencia", () => {
    renderList([item(), item({ sessionId: "ses-2", name: "9. Pressing", date: "2026-09-28", assistanceTypeId: 3 })]);

    expect(within(card("01/10/2026 · 10. Desorganizar rival")).getByText("Asistió")).toBeInTheDocument();
    expect(within(card("28/09/2026 · 9. Pressing")).getByText("No asistió (sin excusa)")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("una sesión sin valorar ofrece Crear", async () => {
    const { onCreate } = renderList([item()]);
    const sessionCard = card("01/10/2026 · 10. Desorganizar rival");

    expect(within(sessionCard).getByText("Sin valorar")).toBeInTheDocument();
    await userEvent.click(within(sessionCard).getByRole("button", { name: "Crear" }));

    expect(onCreate).toHaveBeenCalledWith("ses-1");
  });

  it("una sesión valorada muestra los conteos y ofrece Editar y Eliminar", async () => {
    const evaluated = item({ evaluation: { achieved: 1, partial: 1, notAchieved: 2, updatedAt: "2026-10-01T20:00:00Z" } });
    const { onEdit, onDelete } = renderList([evaluated]);
    const sessionCard = card("01/10/2026 · 10. Desorganizar rival");

    expect(within(sessionCard).getByText("Valorado")).toBeInTheDocument();
    expect(within(sessionCard).getByLabelText("Lo hace: 1")).toBeInTheDocument();
    expect(within(sessionCard).getByLabelText("A veces: 1")).toBeInTheDocument();
    expect(within(sessionCard).getByLabelText("No lo hace: 2")).toBeInTheDocument();
    expect(within(sessionCard).queryByRole("button", { name: "Crear" })).not.toBeInTheDocument();

    await userEvent.click(within(sessionCard).getByRole("button", { name: "Editar" }));
    await userEvent.click(within(sessionCard).getByRole("button", { name: "Eliminar" }));

    expect(onEdit).toHaveBeenCalledWith("ses-1");
    expect(onDelete).toHaveBeenCalledWith(evaluated);
  });

  it("una sesión futura indica que aún no se ha celebrado y no tiene acciones", () => {
    renderList([item({ isHeld: false, hasCalendarEvent: false, assistanceTypeId: null })]);
    const sessionCard = card("01/10/2026 · 10. Desorganizar rival");

    expect(within(sessionCard).getByText("Aún no se ha celebrado")).toBeInTheDocument();
    expect(within(sessionCard).queryByRole("button")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío, la carga y el error con reintento", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <SessionEvaluationList items={[]} loading={false} error={null} onRetry={onRetry} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("No hay sesiones con fecha en esta temporada")).toBeInTheDocument();

    rerender(<SessionEvaluationList items={[]} loading error={null} onRetry={onRetry} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    rerender(
      <SessionEvaluationList
        items={[]}
        loading={false}
        error="No se pudieron cargar las sesiones"
        onRetry={onRetry}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
