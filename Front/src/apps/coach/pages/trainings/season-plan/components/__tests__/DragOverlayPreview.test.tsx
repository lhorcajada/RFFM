import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DragOverlayPreview from "../DragOverlayPreview";

describe("DragOverlayPreview", () => {
  it("renderiza cada segmento del breadcrumb como texto legible mientras se arrastra", () => {
    render(
      <DragOverlayPreview segments={["Fase defensiva", "Defensa organizada", "Presión alta", "Delantero (1.1.1)"]} />
    );

    expect(screen.getByText("Fase defensiva")).toBeInTheDocument();
    expect(screen.getByText("Defensa organizada")).toBeInTheDocument();
    expect(screen.getByText("Presión alta")).toBeInTheDocument();
    expect(screen.getByText("Delantero (1.1.1)")).toBeInTheDocument();
  });

  it("no renderiza nada cuando no hay segmentos", () => {
    const { container } = render(<DragOverlayPreview segments={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
