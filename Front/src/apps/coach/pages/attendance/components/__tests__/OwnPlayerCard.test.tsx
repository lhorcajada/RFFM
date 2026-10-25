import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import OwnPlayerCard from "../OwnPlayerCard";

function renderCard(props: Partial<React.ComponentProps<typeof OwnPlayerCard>> = {}) {
  return render(
    <MemoryRouter>
      <OwnPlayerCard name="Hugo Martín" status={{ label: "Pendiente", tone: "pending" }} {...props} />
    </MemoryRouter>
  );
}

describe("OwnPlayerCard", () => {
  it("muestra al jugador propio en la sección «Tu jugador» con su estado", () => {
    renderCard({ dorsal: 9, position: "Delantero" });

    const section = screen.getByRole("region", { name: "Tu jugador" });
    expect(within(section).getByText("Hugo Martín")).toBeInTheDocument();
    expect(within(section).getByText("9")).toBeInTheDocument();
    expect(within(section).getByText("Delantero")).toBeInTheDocument();
    expect(within(section).getByText("Pendiente")).toBeInTheDocument();
  });

  it("muestra el detalle (motivo) cuando lo hay", () => {
    renderCard({ status: { label: "No va", tone: "declined" }, detail: "Enfermedad" });

    expect(screen.getByText("Enfermedad")).toBeInTheDocument();
  });

  it("pinta las acciones recibidas", () => {
    renderCard({ actions: <button type="button">Aceptar</button> });

    expect(within(screen.getByRole("region", { name: "Tu jugador" })).getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });
});
