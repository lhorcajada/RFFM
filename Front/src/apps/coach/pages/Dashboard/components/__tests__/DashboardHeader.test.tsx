import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardHeader from "../DashboardHeader";

describe("DashboardHeader", () => {
  it("saluda al usuario por su nombre", () => {
    render(<DashboardHeader name="Lucía" />);

    expect(screen.getByRole("heading", { level: 1, name: "Hola, Lucía" })).toBeInTheDocument();
  });

  it("muestra «Panel de control» como título cuando no hay nombre", () => {
    render(<DashboardHeader name={null} />);

    expect(screen.getByRole("heading", { level: 1, name: "Panel de control" })).toBeInTheDocument();
  });

  it("muestra la acción recibida junto al título", () => {
    render(<DashboardHeader name="Lucía" action={<button type="button">Volver al inicio</button>} />);

    expect(screen.getByRole("button", { name: "Volver al inicio" })).toBeInTheDocument();
  });
});
