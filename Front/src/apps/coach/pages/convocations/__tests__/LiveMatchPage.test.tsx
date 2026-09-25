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

vi.mock("../../../../../shared/components/ui/AppHeader/AppHeader", () => ({
  default: () => <div data-testid="app-header" />,
}));

vi.mock("../../../../../shared/components/ui/Footer/Footer", () => ({
  default: () => <div data-testid="app-footer" />,
}));

type LiveTabProps = {
  eventId: string | null;
  teamId: string;
  localTeamName: string;
  visitorTeamName: string;
  isHomeTeam?: boolean;
  isFriendly?: boolean;
  lineupPlayers: unknown[];
};

vi.mock("../components/PartidoEnDirectoTab", () => ({
  default: (props: LiveTabProps) => (
    <div
      data-testid="partido-en-directo"
      data-event={props.eventId ?? ""}
      data-team={props.teamId}
      data-local={props.localTeamName}
      data-visitor={props.visitorTeamName}
      data-home={String(!!props.isHomeTeam)}
      data-friendly={String(!!props.isFriendly)}
      data-players={props.lineupPlayers.length}
    />
  ),
}));

import LiveMatchPage from "../LiveMatchPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/coach/convocations/live?teamId=team-1&eventId=event-1"]}>
      <Routes>
        <Route path="/coach/convocations/live" element={<LiveMatchPage />} />
        <Route path="/coach/convocations/match" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const leagueEvent = {
  id: "event-1",
  teamId: "team-1",
  isHomeMatch: false,
  eveDateTime: "2026-09-10T00:00:00Z",
  teamName: "Mi Equipo",
  rivalName: "Rival FC",
  matchCategory: "League",
};

describe("LiveMatchPage - pantalla completa de partido en directo", () => {
  beforeEach(() => {
    getSportEventByIdMock.mockReset();
  });

  it("carga el partido desde la URL y se lo pasa al partido en directo", async () => {
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
    renderPage();

    const live = await screen.findByTestId("partido-en-directo");
    expect(getSportEventByIdMock).toHaveBeenCalledWith("event-1");
    expect(live).toHaveAttribute("data-event", "event-1");
    expect(live).toHaveAttribute("data-team", "team-1");
    expect(live).toHaveAttribute("data-local", "Rival FC");
    expect(live).toHaveAttribute("data-visitor", "Mi Equipo");
    expect(live).toHaveAttribute("data-home", "false");
    expect(live).toHaveAttribute("data-players", "1");
  });

  it("marca el partido como amistoso cuando la categoría es Friendly", async () => {
    getSportEventByIdMock.mockResolvedValue({ ...leagueEvent, matchCategory: "Friendly" });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("partido-en-directo")).toHaveAttribute("data-friendly", "true"),
    );
  });

  it("no muestra la cabecera ni el pie de la app", async () => {
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
    renderPage();

    await screen.findByTestId("partido-en-directo");
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-footer")).not.toBeInTheDocument();
  });

  it("'Volver' regresa a la ficha del partido con el equipo y el evento", async () => {
    const user = userEvent.setup();
    getSportEventByIdMock.mockResolvedValue(leagueEvent);
    renderPage();

    await screen.findByTestId("partido-en-directo");
    await user.click(screen.getByRole("button", { name: /volver/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/coach/convocations/match?teamId=team-1&eventId=event-1",
    );
  });

  it("muestra un aviso si el partido no se encuentra", async () => {
    getSportEventByIdMock.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText(/no se encontró el partido/i)).toBeInTheDocument();
    expect(screen.queryByTestId("partido-en-directo")).not.toBeInTheDocument();
  });
});
