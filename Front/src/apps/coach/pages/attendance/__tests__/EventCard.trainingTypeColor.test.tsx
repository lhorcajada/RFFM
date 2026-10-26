import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";
import styles from "../EventCard.module.css";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Entreno semanal",
    startTime: "2026-09-01T18:00:00",
    teamId: "team-1",
    ...overrides,
  };
}

function renderCard(trainingTypes?: string[] | null, eventTypeName = "Entrenamiento") {
  return render(
    <MemoryRouter>
      <EventCard event={baseEvent({ trainingTypes })} eventTypeName={eventTypeName} />
    </MemoryRouter>
  );
}

describe("EventCard — etiqueta por tipo de entrenamiento", () => {
  it.each([
    [["Fisico"], "Físico"],
    [["Tecnico"], "Técnico"],
    [["Tactico"], "Táctico"],
  ])("muestra la etiqueta de un único tipo %j", (types, label) => {
    renderCard(types);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("une varios tipos con «+» en un orden fijo", () => {
    renderCard(["Tecnico", "Fisico", "Tactico"]);
    expect(screen.getByText("Físico + Táctico + Técnico")).toBeInTheDocument();
  });

  it("no muestra etiqueta cuando no hay tipos de entrenamiento", () => {
    renderCard(undefined);
    expect(screen.queryByText(/Físico|Técnico|Táctico/)).not.toBeInTheDocument();
  });

  it("no muestra etiqueta cuando trainingTypes está vacío", () => {
    renderCard([]);
    expect(screen.queryByText(/Físico|Técnico|Táctico/)).not.toBeInTheDocument();
  });

  it("no muestra nunca la etiqueta para eventos que no son entrenamiento aunque tengan trainingTypes", () => {
    renderCard(["Fisico"], "Partido");
    expect(screen.queryByText("Físico")).not.toBeInTheDocument();
  });

  it("usa la franja de entrenamiento para entrenamientos", () => {
    const { container } = renderCard(["Fisico"]);
    expect(container.querySelector(`.${styles.stripe}`)).toHaveClass(styles.stripeTraining);
  });
});
