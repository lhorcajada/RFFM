import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoundRail, { type RailRound } from "../RoundRail";

const rounds: RailRound[] = [
  { number: 1, outcome: "V", dateLabel: "13/9" },
  { number: 2, outcome: "E", dateLabel: "20/9" },
  { number: 3, outcome: "D", dateLabel: "27/9" },
  { number: 4, outcome: null, dateLabel: "4/10" },
  { number: 5, outcome: null, dateLabel: "11/10" },
  { number: 6, outcome: null, dateLabel: "18/10", suspended: true },
];

const onSelect = vi.fn();

function renderRail(selectedIndex: number, currentIndex = 3) {
  return render(
    <RoundRail rounds={rounds} selectedIndex={selectedIndex} currentIndex={currentIndex} selectedDateLabel="Dom 4 oct" onSelect={onSelect} />,
  );
}

describe("RoundRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra una navegación «Jornadas» con la jornada seleccionada y el total", () => {
    renderRail(3);

    const nav = screen.getByRole("navigation", { name: "Jornadas" });
    expect(within(nav).getByText("Jornada 4")).toBeInTheDocument();
    expect(within(nav).getByText("/ 6")).toBeInTheDocument();
    expect(within(nav).getByText("Dom 4 oct")).toBeInTheDocument();
  });

  it("marca como pulsada la ficha de la jornada seleccionada", () => {
    renderRail(1);

    expect(screen.getByRole("button", { name: "Jornada 2, empate" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Jornada 1, victoria" })).toHaveAttribute("aria-pressed", "false");
  });

  it("nombra cada ficha con el resultado propio, la jornada actual o «por jugar»", () => {
    renderRail(0);

    expect(screen.getByRole("button", { name: "Jornada 3, derrota" })).toHaveTextContent("D");
    expect(screen.getByRole("button", { name: "Jornada 4, jornada actual" })).toHaveTextContent("4/10");
    expect(screen.getByRole("button", { name: "Jornada 5, por jugar" })).toHaveTextContent("11/10");
  });

  it("marca como suspendida la ficha de una jornada con el partido propio suspendido", () => {
    renderRail(0);

    expect(screen.getByRole("button", { name: "Jornada 6, suspendido" })).toHaveTextContent("Susp.");
  });

  it("selecciona la jornada de una ficha al pulsarla", () => {
    renderRail(0);

    fireEvent.click(screen.getByRole("button", { name: "Jornada 5, por jugar" }));

    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("navega a la jornada anterior y siguiente", () => {
    renderRail(2);

    fireEvent.click(screen.getByRole("button", { name: "Jornada anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Jornada siguiente" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 1);
    expect(onSelect).toHaveBeenNthCalledWith(2, 3);
  });

  it("deshabilita «Jornada anterior» en la primera y «Jornada siguiente» en la última", () => {
    const { unmount } = renderRail(0);
    expect(screen.getByRole("button", { name: "Jornada anterior" })).toBeDisabled();
    unmount();

    renderRail(5);
    expect(screen.getByRole("button", { name: "Jornada siguiente" })).toBeDisabled();
  });

  it("vuelve a la jornada actual y se deshabilita cuando ya está seleccionada", () => {
    const { unmount } = renderRail(0);
    fireEvent.click(screen.getByRole("button", { name: "Jornada actual" }));
    expect(onSelect).toHaveBeenCalledWith(3);
    unmount();

    renderRail(3);
    expect(screen.getByRole("button", { name: "Jornada actual" })).toBeDisabled();
  });
});
