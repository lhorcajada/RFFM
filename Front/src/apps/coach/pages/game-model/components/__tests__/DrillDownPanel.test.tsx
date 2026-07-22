import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material/useMediaQuery", () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}));

import DrillDownPanel from "../DrillDownPanel";

interface Item {
  id: number;
  label: string;
}

const items: Item[] = [
  { id: 1, label: "Uno" },
  { id: 2, label: "Dos" },
];

function renderPanel(overrides: Partial<ComponentProps<typeof DrillDownPanel<Item>>> = {}) {
  const onSelect = vi.fn();
  const onBack = vi.fn();
  render(
    <DrillDownPanel<Item>
      items={items}
      getKey={(item) => item.id}
      selectedIndex={null}
      onSelect={onSelect}
      onBack={onBack}
      renderListItem={(item) => <span>{item.label}</span>}
      renderDetail={(item) => <div>Detalle de {item.label}</div>}
      listAriaLabel="Lista de items"
      emptyMessage="Sin elementos"
      {...overrides}
    />
  );
  return { onSelect, onBack };
}

describe("DrillDownPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("en móvil sin selección muestra la lista y no el detalle", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderPanel({ selectedIndex: null });
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.queryByText(/Detalle de/)).not.toBeInTheDocument();
  });

  it("en móvil con selección muestra el detalle, oculta la lista y expone el botón Volver", () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderPanel({ selectedIndex: 0 });
    expect(screen.getByText("Detalle de Uno")).toBeInTheDocument();
    expect(screen.queryByText("Dos")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("el botón Volver invoca onBack", async () => {
    mockUseMediaQuery.mockReturnValue(true);
    const { onBack } = renderPanel({ selectedIndex: 0 });
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("en escritorio muestra lista y detalle simultáneamente", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: 0 });
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.getByText("Dos")).toBeInTheDocument();
    expect(screen.getByText("Detalle de Uno")).toBeInTheDocument();
  });

  it("el elemento seleccionado expone aria-current", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: 1 });
    const selected = screen.getByText("Dos").closest('[role="button"]');
    expect(selected).toHaveAttribute("aria-current", "true");
  });

  it("selecciona un item al hacer click", async () => {
    mockUseMediaQuery.mockReturnValue(false);
    const { onSelect } = renderPanel({ selectedIndex: null });
    await userEvent.click(screen.getByText("Uno"));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("sin selección en escritorio muestra el emptyMessage", () => {
    mockUseMediaQuery.mockReturnValue(false);
    renderPanel({ selectedIndex: null });
    expect(screen.getByText("Sin elementos")).toBeInTheDocument();
  });
});
