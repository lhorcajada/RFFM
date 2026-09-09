import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PlayerFormBars from "../PlayerFormBars";

describe("PlayerFormBars — variant compact", () => {
  it("muestra las letras Ef, R y C siempre visibles (no en tooltip)", () => {
    render(<PlayerFormBars variant="compact" readiness={80} fatigue={30} />);
    expect(screen.getByText("Ef")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("muestra los valores numéricos siempre visibles como texto", () => {
    render(<PlayerFormBars variant="compact" readiness={80} fatigue={30} />);
    // Ef = 80 * (1 - 30/200) = 68
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("68");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("80");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("30");
  });

  it("muestra '—' en Ef y R cuando readiness es null, pero Cansancio sigue mostrando su valor", () => {
    render(<PlayerFormBars variant="compact" readiness={null} fatigue={45} />);
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("—");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("—");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("45");
  });

  it("no renderiza nada cuando ni readiness ni fatigue tienen datos", () => {
    const { container } = render(<PlayerFormBars variant="compact" readiness={null} fatigue={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("colorea Ef/R en verde (tono high) cuando >= 80 y Cansancio en verde cuando < 40", () => {
    render(<PlayerFormBars variant="compact" readiness={90} fatigue={10} />);
    expect(screen.getByTestId("player-form-bar-ef")).toHaveAttribute("data-tone", "high");
    expect(screen.getByTestId("player-form-bar-r")).toHaveAttribute("data-tone", "high");
    expect(screen.getByTestId("player-form-bar-c")).toHaveAttribute("data-tone", "high");
  });

  it("colorea Cansancio en rojo (tono low) cuando >= 70, criterio invertido respecto a Ef/R", () => {
    render(<PlayerFormBars variant="compact" readiness={90} fatigue={80} />);
    expect(screen.getByTestId("player-form-bar-c")).toHaveAttribute("data-tone", "low");
  });

  it("con fullWidth, el contenedor usa la clase de ancho completo en vez del ancho fijo mínimo", () => {
    const { container } = render(
      <PlayerFormBars variant="compact" readiness={80} fatigue={30} fullWidth />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/compactFullWidth/i);
  });

  it("sin fullWidth, el contenedor no usa la clase de ancho completo", () => {
    const { container } = render(<PlayerFormBars variant="compact" readiness={80} fatigue={30} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toMatch(/compactFullWidth/i);
  });
});

describe("PlayerFormBars — variant full", () => {
  it("muestra jerarquía padre-hijo: Ef destacado y Rodaje/Cansancio con etiqueta de texto completa", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} />);
    expect(screen.getByText("Ef")).toBeInTheDocument();
    expect(screen.getByText("Rodaje")).toBeInTheDocument();
    expect(screen.getByText("Cansancio")).toBeInTheDocument();
    // Ef = 70 * (1 - 20/200) = 63
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("63%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("70%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("20%");
  });

  it("acepta un tooltip opcional para Rodaje sin ocultar el valor visible", () => {
    render(
      <PlayerFormBars
        variant="full"
        readiness={70}
        fatigue={20}
        readinessTooltip={<span>Entreno: 60% · Partidos: 40%</span>}
      />,
    );
    // El valor sigue visible como texto, el tooltip es un extra, no un sustituto
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("70%");
  });
});
