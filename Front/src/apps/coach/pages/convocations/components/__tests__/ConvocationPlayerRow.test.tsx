import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConvocationPlayerRow from "../ConvocationPlayerRow";

const rating = (v: number) => ({ technical: v, tactical: v, physical: v, competitiveness: v });

describe("ConvocationPlayerRow", () => {
  it("muestra el nombre, el dorsal y la posición", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" dorsal={9} position="Delantero" />);

    expect(screen.getByText("Ana Uno")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Delantero")).toBeInTheDocument();
  });

  it("da prioridad al alias sobre el nombre completo", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" alias="Anita" />);

    expect(screen.getByText("Anita")).toBeInTheDocument();
    expect(screen.queryByText("Ana Uno")).not.toBeInTheDocument();
  });

  it("muestra la valoración media redondeada con el color de su tramo", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" rating={rating(7)} />);

    expect(screen.getByLabelText("Valoración media: 7")).toHaveStyle({ color: "#66bb6a" });
  });

  it("pinta en ámbar una media entre 5 y 7 y en rojo por debajo de 5", () => {
    const { rerender } = render(<ConvocationPlayerRow displayName="Ana Uno" rating={rating(6)} />);
    expect(screen.getByLabelText("Valoración media: 6")).toHaveStyle({ color: "#ffb300" });

    rerender(<ConvocationPlayerRow displayName="Ana Uno" rating={rating(4)} />);
    expect(screen.getByLabelText("Valoración media: 4")).toHaveStyle({ color: "#ef5350" });
  });

  it("no muestra valoración cuando el jugador no tiene", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" rating={null} />);

    expect(screen.queryByLabelText(/Valoración media/)).not.toBeInTheDocument();
  });

  it("muestra la racha desde la última decisión técnica", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" streakCount={4} />);

    expect(screen.getByLabelText("Jornadas desde la última decisión técnica: 4")).toHaveTextContent("4");
  });

  it("no muestra racha si no hay dato", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" streakCount={null} />);

    expect(screen.queryByLabelText(/Jornadas desde la última decisión técnica/)).not.toBeInTheDocument();
  });

  it("muestra la etiqueta Lesionado", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" injured />);

    expect(screen.getByText("Lesionado")).toBeInTheDocument();
  });

  it("muestra En recuperación solo si no está lesionado", () => {
    const { rerender } = render(<ConvocationPlayerRow displayName="Ana Uno" recovering />);
    expect(screen.getByText("En recuperación")).toBeInTheDocument();

    rerender(<ConvocationPlayerRow displayName="Ana Uno" injured recovering />);
    expect(screen.queryByText("En recuperación")).not.toBeInTheDocument();
  });

  it("muestra las barras de forma Ef/R/C cuando hay rodaje o cansancio", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" readiness={65} fatigue={22} />);

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("58%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("65%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("22%");
  });

  it("usa el formStatus del backend en Ef cuando se indica", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" readiness={65} fatigue={22} formStatus={33} />);

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("33%");
  });

  it("no pinta barras de forma sin datos", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" />);

    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
  });

  it("muestra la foto del jugador cuando existe", () => {
    render(<ConvocationPlayerRow displayName="Ana Uno" photoSrc="https://example.test/ana.png" />);

    expect(screen.getByRole("img", { name: "Ana Uno" })).toHaveAttribute("src", "https://example.test/ana.png");
  });

  it("muestra las acciones recibidas", () => {
    render(
      <ConvocationPlayerRow
        displayName="Ana Uno"
        actions={<button type="button">Desconvocar a Ana Uno</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Desconvocar a Ana Uno" })).toBeInTheDocument();
  });
});
