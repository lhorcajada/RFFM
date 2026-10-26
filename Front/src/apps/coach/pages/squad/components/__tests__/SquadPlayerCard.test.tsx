import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SquadPlayerCard from "../SquadPlayerCard";

const league = {
  teamPlayerId: "tp-1",
  goals: 4,
  callUps: 10,
  starts: 8,
  yellowCards: 2,
  redCards: 0,
  minutesPlayed: 640,
};

function renderCard(props: Partial<React.ComponentProps<typeof SquadPlayerCard>> = {}) {
  return render(
    <MemoryRouter>
      <SquadPlayerCard displayName="Juan Pérez" dorsal={9} position="Delantero" {...props} />
    </MemoryRouter>
  );
}

describe("SquadPlayerCard", () => {
  it("muestra el alias en lugar del nombre completo cuando existe", () => {
    renderCard({ alias: "Juanito" });

    expect(screen.getByText("Juanito")).toBeInTheDocument();
    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
  });

  it("muestra el dorsal y la posición", () => {
    renderCard();

    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Delantero")).toBeInTheDocument();
  });

  it("muestra el bloque «Solo liga» cuando hay datos de liga", () => {
    renderCard({ leagueStats: league });

    expect(screen.getByText("Solo liga")).toBeInTheDocument();
  });

  it("oculta los minutos del bloque de liga cuando se pide", () => {
    renderCard({ leagueStats: league, hideMinutes: true });

    expect(screen.getByText("Solo liga")).toBeInTheDocument();
    expect(screen.queryByText("Minutos")).not.toBeInTheDocument();
  });

  it("no muestra el bloque de liga sin datos", () => {
    renderCard({ leagueStats: null });

    expect(screen.queryByText("Solo liga")).not.toBeInTheDocument();
  });

  it("muestra las barras Ef/R/C con los valores recibidos", () => {
    renderCard({ readiness: 70, fatigue: 20, formStatus: 55 });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("55%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("70%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("20%");
  });

  it("muestra el chip «Lesionado» cuando el jugador está lesionado", () => {
    renderCard({ injured: true });

    expect(screen.getByText("Lesionado")).toBeInTheDocument();
  });

  it("no muestra «Lesionado» si el jugador no lo está", () => {
    renderCard({ injured: false });

    expect(screen.queryByText("Lesionado")).not.toBeInTheDocument();
  });

  it("permite dar de alta una lesión cuando se facilita la acción", async () => {
    const onClearInjury = vi.fn();
    renderCard({ injured: true, onClearInjury });

    await userEvent.click(screen.getByRole("button", { name: /dar de alta/i }));

    expect(onClearInjury).toHaveBeenCalledTimes(1);
  });

  it("no ofrece dar de alta sin la acción", () => {
    renderCard({ injured: true });

    expect(screen.queryByRole("button", { name: /dar de alta/i })).not.toBeInTheDocument();
  });

  it("enlaza a la ficha del jugador cuando se facilita la ruta", () => {
    renderCard({ alias: "Juanito", to: "/coach/player/tp-1" });

    expect(screen.getByRole("link", { name: /ficha de juanito/i })).toHaveAttribute("href", "/coach/player/tp-1");
  });

  it("no es un enlace sin ruta", () => {
    renderCard();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
