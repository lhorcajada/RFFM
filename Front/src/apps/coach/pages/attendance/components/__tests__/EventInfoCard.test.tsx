import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import EventInfoCard from "../EventInfoCard";

const base = {
  name: "Jornada 5",
  typeName: "Partidos",
  date: new Date(2026, 10, 1, 10, 30),
  start: new Date(2026, 10, 1, 10, 30),
  end: new Date(2026, 10, 1, 12, 0),
  arrival: new Date(2026, 10, 1, 10, 0),
};

describe("EventInfoCard", () => {
  it("muestra el nombre, el tipo y el horario en una sola línea", () => {
    render(<EventInfoCard {...base} />);

    expect(screen.getByRole("heading", { name: "Jornada 5" })).toBeInTheDocument();
    expect(screen.getByText("Partidos")).toBeInTheDocument();
    expect(screen.getByText(/10:30–12:00/)).toBeInTheDocument();
    expect(screen.getByText("Llegada 10:00")).toBeInTheDocument();
  });

  it("indica «Por confirmar» si no hay fecha ni hora", () => {
    render(<EventInfoCard {...base} date={null} start={null} end={null} arrival={null} />);

    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
    expect(screen.queryByText(/Llegada/)).not.toBeInTheDocument();
  });

  it("enlaza el lugar a su mapa cuando hay URL", () => {
    render(<EventInfoCard {...base} location="Campo Norte" locationMapUrl="https://maps.example/x" />);

    expect(screen.getByRole("link", { name: /Campo Norte/ })).toHaveAttribute("href", "https://maps.example/x");
  });

  it("muestra el rival", () => {
    render(<EventInfoCard {...base} rivalName="CD Rival" />);

    expect(screen.getByText("vs CD Rival")).toBeInTheDocument();
  });

  it("recorta una descripción larga y la despliega con «Ver más»", async () => {
    const description = "Detalle ".repeat(40).trim();
    render(<EventInfoCard {...base} description={description} />);

    const toggle = screen.getByRole("button", { name: "Ver más" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("no ofrece «Ver más» para una descripción corta", () => {
    render(<EventInfoCard {...base} description="Traer peto" />);

    expect(screen.getByText("Traer peto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });
});
