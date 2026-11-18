import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConductFilters from "../ConductFilters";
import { EMPTY_CONDUCT_FILTERS } from "../../utils/conductFilter";
import type { EffectiveTrait } from "../../rating/ratingCatalog";

const traits = [
  { key: "traitPressing", label: "Presión" },
  { key: "traitDuels", label: "Duelos" },
] as EffectiveTrait[];

function renderFilters(filters = EMPTY_CONDUCT_FILTERS, onChange = vi.fn()) {
  render(<ConductFilters traits={traits} filters={filters} onChange={onChange} />);
  return onChange;
}

describe("ConductFilters", () => {
  it("lista solo los rasgos recibidos en el selector de rasgo", () => {
    renderFilters();

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(expect.arrayContaining(["Presión", "Duelos"]));
  });

  it("elegir un rasgo avisa del cambio", async () => {
    const onChange = renderFilters();

    await userEvent.selectOptions(screen.getByLabelText("Rasgo"), "traitPressing");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing" });
  });

  it("los niveles están desactivados hasta elegir un rasgo", () => {
    renderFilters();

    expect(screen.getByLabelText("Nivel mín.")).toBeDisabled();
    expect(screen.getByLabelText("Nivel máx.")).toBeDisabled();
  });

  it("con un rasgo elegido se puede cambiar el nivel máximo", async () => {
    const onChange = renderFilters({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing" });

    await userEvent.selectOptions(screen.getByLabelText("Nivel máx."), "2");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing", maxLevel: 2 });
  });

  it("el nivel mínimo no puede superar al máximo", async () => {
    const onChange = renderFilters({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing", maxLevel: 3 });

    await userEvent.selectOptions(screen.getByLabelText("Nivel mín."), "5");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CONDUCT_FILTERS, traitKey: "traitPressing", minLevel: 5, maxLevel: 5 });
  });

  it("los chips de tendencia marcan el activo con aria-pressed", () => {
    renderFilters({ ...EMPTY_CONDUCT_FILTERS, trend: "down" });

    expect(screen.getByRole("button", { name: "Bajando" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Subiendo" })).toHaveAttribute("aria-pressed", "false");
  });

  it("pulsar el chip activo quita la tendencia", async () => {
    const onChange = renderFilters({ ...EMPTY_CONDUCT_FILTERS, trend: "down" });

    await userEvent.click(screen.getByRole("button", { name: "Bajando" }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CONDUCT_FILTERS, trend: null });
  });

  it("pulsar otro chip cambia la tendencia", async () => {
    const onChange = renderFilters();

    await userEvent.click(screen.getByRole("button", { name: "Subiendo" }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CONDUCT_FILTERS, trend: "up" });
  });

  it("«Quitar filtros» solo aparece con filtros activos y los limpia", async () => {
    const { unmount } = render(<ConductFilters traits={traits} filters={EMPTY_CONDUCT_FILTERS} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).not.toBeInTheDocument();
    unmount();

    const onChange = renderFilters({ ...EMPTY_CONDUCT_FILTERS, trend: "up" });
    await userEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_CONDUCT_FILTERS);
  });
});
