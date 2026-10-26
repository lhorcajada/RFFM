process.env.TZ = "Europe/Madrid";

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Partido vs Rival",
    teamId: "team-1",
    ...overrides,
  };
}

describe("EventCard - hora del partido", () => {
  it("no ofrece un botón «Ir al partido» a jugadores o familiares", () => {
    render(
      <MemoryRouter initialEntries={["/coach/attendance?teamId=team-1"]}>
        <EventCard event={baseEvent()} eventTypeName="Partido" isPlayer />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /ir al partido/i })).not.toBeInTheDocument();
  });

  it("muestra la hora del partido convertida a la hora local (Europe/Madrid, CEST +2)", () => {
    // 2026-08-31T18:00:00Z en UTC corresponde a las 20:00 en Europe/Madrid (CEST, verano, +2h)
    const event = baseEvent({ eveDateTime: "2026-08-31T18:00:00Z", startTime: "2026-08-31T18:00:00Z" });

    render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Partido" />
      </MemoryRouter>
    );

    expect(screen.getByText("20:00")).toBeInTheDocument();
  });
});
