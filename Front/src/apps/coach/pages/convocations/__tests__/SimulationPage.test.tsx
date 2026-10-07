import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const getSportEventByIdMock = vi.fn();

vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
}));

vi.mock("../hooks/useLiveMatchLineupPlayers", () => ({
  useLiveMatchLineupPlayers: () => ({
    lineupPlayers: [{ id: "p1", displayName: "Jugador Uno" }],
  }),
}));

type SimTabProps = {
  eventId: string | null;
  teamId: string;
  isFriendly?: boolean;
  lineupPlayers: unknown[];
};

vi.mock("../components/SimulacionTab", () => ({
  default: (props: SimTabProps) => (
    <div
      data-testid="simulacion"
      data-event={props.eventId ?? ""}
      data-team={props.teamId}
      data-friendly={String(!!props.isFriendly)}
      data-players={props.lineupPlayers.length}
    />
  ),
}));

import SimulationPage from "../SimulationPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/coach/convocations/simulation?teamId=team-1&eventId=event-1"]}>
      <Routes>
        <Route path="/coach/convocations/simulation" element={<SimulationPage />} />
        <Route path="/coach/convocations/match" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const leagueEvent = {
  id: "event-1",
  teamId: "team-1",
  isHomeMatch: true,
  eveDateTime: "2026-10-10T00:00:00Z",
  teamName: "Mi Equipo",
  rivalName: "Rival FC",
  matchCategory: "League",
};

describe("SimulationPage - simulación a pantalla completa", () => {
  beforeEach(() => {
    getSportEventByIdMock.mockReset();
  });

  it("carga el partido desde la URL y se lo pasa a la simulación", async () => {
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
    renderPage();

    const sim = await screen.findByTestId("simulacion");
    expect(sim).toHaveAttribute("data-event", "event-1");
    expect(sim).toHaveAttribute("data-team", "team-1");
    expect(sim).toHaveAttribute("data-players", "1");
    expect(sim).toHaveAttribute("data-friendly", "false");
  });

  it("marca el partido como amistoso cuando la categoría es Friendly", async () => {
    getSportEventByIdMock.mockResolvedValue({ ...leagueEvent, matchCategory: "Friendly" });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("simulacion")).toHaveAttribute("data-friendly", "true"),
    );
  });

  it("'Volver' regresa a la ficha del partido con el equipo y el evento", async () => {
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
    renderPage();
    await screen.findByTestId("simulacion");

    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/coach/convocations/match?teamId=team-1&eventId=event-1",
    );
  });

  it("muestra un aviso si el partido no se encuentra", async () => {
    getSportEventByIdMock.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText(/no se encontró el partido/i)).toBeInTheDocument();
    expect(screen.queryByTestId("simulacion")).not.toBeInTheDocument();
  });
});
