import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: vi.fn().mockResolvedValue({
    id: "event-1",
    teamId: "team-1",
    isHomeMatch: true,
    eveDateTime: "2026-09-10T00:00:00Z",
    teamName: "Mi Equipo",
    rivalName: "Rival FC",
    matchCategory: "League",
  }),
}));

vi.mock("../../../hooks/useIsPlayerRole", () => ({
  useIsPlayerRole: () => true,
  default: () => true,
}));

vi.mock("../hooks/useLiveMatchLineupPlayers", () => ({
  useLiveMatchLineupPlayers: () => ({ lineupPlayers: [] }),
}));

vi.mock("../../../../../shared/components/ui/AppHeader/AppHeader", () => ({ default: () => null }));
vi.mock("../../../../../shared/components/ui/Footer/Footer", () => ({ default: () => null }));

vi.mock("../components/PartidoEnDirectoTab", () => ({
  default: () => <div data-testid="partido-en-directo" />,
}));

vi.mock("../components/LiveMatchViewer", () => ({
  default: (props: { eventId: string; localTeamName: string; visitorTeamName: string }) => (
    <div data-testid="live-match-viewer" data-event={props.eventId} data-local={props.localTeamName} data-visitor={props.visitorTeamName} />
  ),
}));

import LiveMatchPage from "../LiveMatchPage";

describe("LiveMatchPage - jugador/familiar", () => {
  it("muestra el visor de solo lectura en lugar del partido en directo del coach", async () => {
    render(
      <MemoryRouter initialEntries={["/coach/convocations/live?teamId=team-1&eventId=event-1"]}>
        <Routes>
          <Route path="/coach/convocations/live" element={<LiveMatchPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const viewer = await screen.findByTestId("live-match-viewer");
    expect(viewer).toHaveAttribute("data-event", "event-1");
    expect(viewer).toHaveAttribute("data-local", "Mi Equipo");
    expect(screen.queryByTestId("partido-en-directo")).not.toBeInTheDocument();
  });
});
