import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardActionBar from "../DashboardActionBar";

function renderActionBar(isPlayer: boolean) {
  return render(
    <MemoryRouter>
      <DashboardActionBar isPlayer={isPlayer} />
    </MemoryRouter>
  );
}

describe("DashboardActionBar", () => {
  it("muestra el botón 'Volver al inicio' a un entrenador", () => {
    renderActionBar(false);

    expect(screen.getByRole("button", { name: /volver al inicio/i })).toBeInTheDocument();
  });

  it("no muestra el botón 'Volver al inicio' a un jugador o familiar", () => {
    renderActionBar(true);

    expect(screen.queryByRole("button", { name: /volver al inicio/i })).not.toBeInTheDocument();
  });
});
