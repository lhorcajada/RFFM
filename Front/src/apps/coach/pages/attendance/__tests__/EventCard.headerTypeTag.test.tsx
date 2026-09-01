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

function renderCard(compact: boolean, eventTypeName: string | null = "Entrenamiento") {
  return render(
    <MemoryRouter>
      <EventCard event={baseEvent()} eventTypeName={eventTypeName} compact={compact} />
    </MemoryRouter>
  );
}

describe("EventCard — tipo de evento lateralizado como franja vertical", () => {
  it("renders the event type as a vertical sidebar strip on the card, not inside the header, in the non-compact card", () => {
    const { container } = renderCard(false);
    const sidebar = container.querySelector(`.${styles.typeSidebar}`);
    expect(sidebar).not.toBeNull();
    expect(sidebar).toHaveTextContent("Entrenamiento");
    // Must live directly on the card (sibling of the header), not nested in it.
    expect(container.querySelector(`.${styles.header}`)).not.toContainElement(sidebar as HTMLElement);
    expect(container.querySelector(`.${styles.card}`)).toContainElement(sidebar as HTMLElement);
  });

  it("renders the same vertical sidebar in the compact card (dashboard widget)", () => {
    const { container } = renderCard(true);
    const sidebar = container.querySelector(`.${styles.typeSidebar}`);
    expect(sidebar).not.toBeNull();
    expect(sidebar).toHaveTextContent("Entrenamiento");
  });

  it("also renders the vertical sidebar for match cards, outside the pitch header, alongside the Home/Away badge staying in the header", () => {
    const { container } = render(
      <MemoryRouter>
        <EventCard event={baseEvent({ isHomeMatch: true })} eventTypeName="Partido" />
      </MemoryRouter>
    );
    const sidebar = container.querySelector(`.${styles.typeSidebar}`);
    expect(sidebar).not.toBeNull();
    expect(sidebar).toHaveTextContent("Partido");
    expect(container.querySelector(`.${styles.matchHeader}`)).not.toContainElement(sidebar as HTMLElement);
    expect(screen.getByText(/Local/)).toBeInTheDocument();
  });

  it("does not render a sidebar strip when there is no event type name", () => {
    const { container } = renderCard(false, null);
    expect(container.querySelector(`.${styles.typeSidebar}`)).toBeNull();
  });

  it("gives training, match and other event types visually distinct sidebar colors via modifier classes", () => {
    const { container: trainingContainer } = renderCard(false, "Entrenamiento");
    const { container: matchContainer } = render(
      <MemoryRouter>
        <EventCard event={baseEvent()} eventTypeName="Partido" />
      </MemoryRouter>
    );
    const { container: friendlyContainer } = renderCard(false, "Amistoso");

    const trainingSidebar = trainingContainer.querySelector(`.${styles.typeSidebar}`);
    const matchSidebar = matchContainer.querySelector(`.${styles.typeSidebar}`);
    const friendlySidebar = friendlyContainer.querySelector(`.${styles.typeSidebar}`);

    expect(trainingSidebar).toHaveClass(styles.typeSidebarTraining);
    expect(matchSidebar).toHaveClass(styles.typeSidebarMatch);
    expect(friendlySidebar).toHaveClass(styles.typeSidebarDefault);
  });
});
