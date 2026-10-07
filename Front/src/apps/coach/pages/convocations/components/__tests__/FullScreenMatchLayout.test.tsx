import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@mui/material";
import FullScreenMatchLayout from "../FullScreenMatchLayout";

describe("FullScreenMatchLayout - pantalla completa compartida (alineación, simulación, partido)", () => {
  it("muestra el contenido de la pantalla", () => {
    render(
      <FullScreenMatchLayout onBack={vi.fn()}>
        <div data-testid="contenido" />
      </FullScreenMatchLayout>,
    );

    expect(screen.getByTestId("contenido")).toBeInTheDocument();
  });

  it("coloca 'Volver' a la derecha, después de las acciones de la barra", () => {
    render(
      <FullScreenMatchLayout onBack={vi.fn()} actions={<Button>Guardar</Button>}>
        <div />
      </FullScreenMatchLayout>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Guardar", "Volver"]);
  });

  it("'Volver' invoca onBack", async () => {
    const onBack = vi.fn();
    render(
      <FullScreenMatchLayout onBack={onBack}>
        <div />
      </FullScreenMatchLayout>,
    );

    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
