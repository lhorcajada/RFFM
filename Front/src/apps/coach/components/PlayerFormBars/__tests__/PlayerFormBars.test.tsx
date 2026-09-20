import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("usa formStatus del backend como valor de Ef cuando se pasa, en vez de calcularlo localmente", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} formStatus={55} />);
    // Sin formStatus, Ef local sería 70 * (1 - 20/200) = 63; con formStatus=55 debe mostrar 55%
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("55%");
  });

  it("sin formStatus, sigue calculando Ef localmente como antes (compatibilidad con otros consumidores)", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} />);
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("63%");
  });

  it("muestra '—' en Ef cuando formStatus es null explícito, sin caer al cálculo local", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} formStatus={null} />);
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("—");
  });

  it("no muestra botón de información en ninguna fila si no se pasan handlers", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} />);
    expect(screen.queryByTestId("player-form-bar-r-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-c-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-ef-toggle")).not.toBeInTheDocument();
  });

  it("muestra un botón '¿Cómo se calcula?' por fila con handler y lo invoca al pulsarlo", () => {
    const onFormStatusInfo = vi.fn();
    const onReadinessInfo = vi.fn();
    const onFatigueInfo = vi.fn();
    render(
      <PlayerFormBars
        variant="full"
        readiness={70}
        fatigue={20}
        formStatus={55}
        onFormStatusInfo={onFormStatusInfo}
        onReadinessInfo={onReadinessInfo}
        onFatigueInfo={onFatigueInfo}
      />,
    );
    expect(screen.getAllByRole("button", { name: /cómo se calcula/i })).toHaveLength(3);
    fireEvent.click(screen.getByTestId("player-form-bar-r-toggle"));
    fireEvent.click(screen.getByTestId("player-form-bar-c-toggle"));
    fireEvent.click(screen.getByTestId("player-form-bar-ef-toggle"));
    expect(onReadinessInfo).toHaveBeenCalledTimes(1);
    expect(onFatigueInfo).toHaveBeenCalledTimes(1);
    expect(onFormStatusInfo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("70%");
  });

  it("solo muestra el botón en las filas que tienen handler", () => {
    render(<PlayerFormBars variant="full" readiness={70} fatigue={20} onFatigueInfo={() => {}} />);
    expect(screen.getByTestId("player-form-bar-c-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-r-toggle")).not.toBeInTheDocument();
  });
});
