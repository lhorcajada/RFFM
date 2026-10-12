import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerCardBadge from "../PlayerCardBadge";

describe("PlayerCardBadge", () => {
  it("no muestra nada para un jugador sin tarjetas", () => {
    const { container } = render(<PlayerCardBadge status="none" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra una amarilla para un jugador amonestado", () => {
    render(<PlayerCardBadge status="yellow" />);

    expect(screen.getByRole("img", { name: "Tarjeta amarilla" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Tarjeta roja" })).not.toBeInTheDocument();
  });

  it("muestra solo una roja para una roja directa", () => {
    render(<PlayerCardBadge status="red" />);

    expect(screen.getByRole("img", { name: "Tarjeta roja" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Tarjeta amarilla" })).not.toBeInTheDocument();
  });

  it("muestra amarilla y roja para una expulsión por doble amarilla", () => {
    render(<PlayerCardBadge status="doubleYellow" />);

    expect(screen.getByRole("img", { name: "Tarjeta amarilla" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tarjeta roja" })).toBeInTheDocument();
  });
});
