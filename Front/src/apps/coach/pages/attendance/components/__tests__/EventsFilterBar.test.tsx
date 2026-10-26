import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventsFilterBar from "../EventsFilterBar";

const onSegmentChange = vi.fn();
const onToggleType = vi.fn();
const onApplyRange = vi.fn();

function renderBar(overrides: Partial<React.ComponentProps<typeof EventsFilterBar>> = {}) {
  return render(
    <EventsFilterBar
      segment="upcoming"
      activeTypes={[]}
      startDate="2026-10-26"
      endDate="2026-11-30"
      onSegmentChange={onSegmentChange}
      onToggleType={onToggleType}
      onApplyRange={onApplyRange}
      {...overrides}
    />
  );
}

describe("EventsFilterBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marca como pulsado el segmento activo", () => {
    renderBar({ segment: "past" });
    expect(screen.getByRole("button", { name: "Pasados" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Próximos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("no marca ningún segmento cuando el rango es personalizado", () => {
    renderBar({ segment: null });
    for (const name of ["Próximos", "Pasados", "Toda la temporada"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("avisa del segmento elegido", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Toda la temporada" }));
    expect(onSegmentChange).toHaveBeenCalledWith("season");
  });

  it("marca como pulsados los chips de tipo activos", () => {
    renderBar({ activeTypes: ["match"] });
    expect(screen.getByRole("button", { name: "Partidos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Torneos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("avisa del tipo alternado", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Entrenamientos" }));
    expect(onToggleType).toHaveBeenCalledWith("training");
  });

  it("muestra los campos Desde y Hasta solo al abrir el desplegable de fechas", async () => {
    renderBar();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /fechas/i }));
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-10-26");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-11-30");
  });

  it("aplica el rango editado al pulsar «Aplicar»", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /fechas/i }));
    const from = screen.getByLabelText("Desde");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-11-02");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onApplyRange).toHaveBeenCalledWith("2026-11-02", "2026-11-30");
  });
});
