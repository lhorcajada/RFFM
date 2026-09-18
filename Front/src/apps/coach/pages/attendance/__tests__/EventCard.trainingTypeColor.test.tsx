import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";
import styles from "../EventCard.module.css";

vi.mock("../../../services/sportEventService", () => ({
  deleteSportEvent: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("../components/SportEventDialog", () => ({
  default: () => null,
}));

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

describe("EventCard — color de cabecera y etiqueta por tipo de entrenamiento", () => {
  it("muestra la etiqueta 'Físico' y un fondo distinto al de 'Técnico'", () => {
    const { container: fisicoContainer } = renderCard(["Fisico"]);
    const { container: tecnicoContainer } = renderCard(["Tecnico"]);

    expect(screen.getAllByText("Físico")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Técnico")[0]).toBeInTheDocument();

    const fisicoHeader = fisicoContainer.querySelector(`.${styles.header}`) as HTMLElement;
    const tecnicoHeader = tecnicoContainer.querySelector(`.${styles.header}`) as HTMLElement;
    expect(fisicoHeader.style.background).not.toBe(tecnicoHeader.style.background);
  });

  it("da un fondo distinto a cada combinación de tres tipos frente a los tipos individuales y pares", () => {
    const combos: string[][] = [
      ["Fisico"],
      ["Tecnico"],
      ["Tactico"],
      ["Fisico", "Tecnico"],
      ["Fisico", "Tactico"],
      ["Tactico", "Tecnico"],
      ["Fisico", "Tactico", "Tecnico"],
    ];
    const backgrounds = combos.map((combo) => {
      const { container } = renderCard(combo);
      const header = container.querySelector(`.${styles.header}`) as HTMLElement;
      return header.style.background;
    });

    const uniqueBackgrounds = new Set(backgrounds);
    expect(uniqueBackgrounds.size).toBe(combos.length);
  });

  it("no muestra la etiqueta ni cambia el fondo por defecto cuando no hay tipos de entrenamiento", () => {
    const { container } = renderCard(undefined);
    expect(container.querySelector(`.${styles.headerTrainingTag}`)).toBeNull();
  });

  it("no muestra la etiqueta cuando trainingTypes está vacío", () => {
    const { container } = renderCard([]);
    expect(container.querySelector(`.${styles.headerTrainingTag}`)).toBeNull();
  });

  it("no muestra nunca la etiqueta para eventos que no son entrenamiento aunque tengan trainingTypes", () => {
    const { container } = renderCard(["Fisico"], "Partido");
    expect(container.querySelector(`.${styles.headerTrainingTag}`)).toBeNull();
  });
});
