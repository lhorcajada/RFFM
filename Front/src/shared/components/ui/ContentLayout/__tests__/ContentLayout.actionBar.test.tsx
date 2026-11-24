import React, { useState } from "react";
import { createPortal } from "react-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContentLayout from "../ContentLayout";

function ContentWithPortal() {
  const [slot, setSlot] = useState<HTMLSpanElement | null>(null);
  return (
    <ContentLayout
      title="Asistencia"
      actionBar={<span data-testid="slot" ref={setSlot} />}
    >
      {slot && createPortal(<button type="button">Exportar</button>, slot)}
    </ContentLayout>
  );
}

describe("ContentLayout con barra de acciones", () => {
  it("no muestra la barra cuando no recibe actionBar", () => {
    const { container } = render(
      <ContentLayout title="Plantilla">
        <p>contenido</p>
      </ContentLayout>,
    );

    expect(container.querySelector("[class*='actionBar']")).toBeNull();
  });

  it("muestra la barra cuando recibe actionBar", () => {
    const { container } = render(
      <ContentLayout
        title="Plantilla"
        actionBar={<button type="button">Guardar</button>}
      />,
    );

    expect(container.querySelector("[class*='actionBar']")).not.toBeNull();
  });

  it("mantiene montado un portal dentro de la barra", () => {
    render(<ContentWithPortal />);

    expect(
      within(screen.getByTestId("slot")).getByRole("button", { name: "Exportar" }),
    ).toBeInTheDocument();
  });
});
