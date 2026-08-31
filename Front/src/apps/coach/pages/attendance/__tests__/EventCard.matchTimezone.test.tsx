process.env.TZ = "Europe/Madrid";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import EventCard from "../EventCard";
import type { SportEventResponse } from "../../../services/sportEventService";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
    title: "Partido vs Rival",
    teamId: "team-1",
    ...overrides,
  };
}

describe("EventCard - toMatchState convierte la hora UTC a hora local", () => {
  it("no permite al jugador o familiar abrir el detalle del partido desde el calendario", () => {
    render(
      <MemoryRouter initialEntries={["/coach/attendance?teamId=team-1"]}>
        <EventCard event={baseEvent()} eventTypeName="Partido" isPlayer />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /ir al partido/i })).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navega con la hora del partido convertida a la hora local (Europe/Madrid, CEST +2)", () => {
    // 2026-08-31T18:00:00Z en UTC corresponde a las 20:00 en Europe/Madrid (CEST, verano, +2h)
    const event = baseEvent({ eveDateTime: "2026-08-31T18:00:00Z", startTime: "2026-08-31T18:00:00Z" });

    render(
      <MemoryRouter>
        <EventCard event={event} eventTypeName="Partido" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /ir al partido/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const [, options] = navigateMock.mock.calls[0];
    expect(options.state.match.time).toBe("20:00");
  });
});
