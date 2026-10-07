import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { RefObject } from "react";
import type { IdealLineupHandle, SquadPlayer } from "../../squad/components/IdealLineup";

const getSportEventByIdMock = vi.fn();
const saveLineupMock = vi.fn().mockResolvedValue(undefined);
const moveToNotCalledMock = vi.fn().mockResolvedValue(undefined);
const saveMinutesReasonMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../services/sportEventService", () => ({
  getSportEventById: (...args: unknown[]) => getSportEventByIdMock(...args),
}));

vi.mock("../hooks/useMatchSquad", () => ({
  useMatchSquad: () => ({
    convocation: {
      excuseTypes: [{ id: 7, name: "Decisión técnica", justified: false }],
      mgmtMinutesReasonMap: { p1: "Vuelta de lesión" },
      moveToNotCalled: (...args: unknown[]) => moveToNotCalledMock(...args),
      moveToAvailable: vi.fn(),
      acceptPending: vi.fn(),
      saveMinutesReason: (...args: unknown[]) => saveMinutesReasonMock(...args),
    },
    lineupPlayers: [
      { id: "p1", displayName: "Jugador Uno" },
      { id: "p2", displayName: "Jugador Ausente", assistanceTypeId: 2 },
    ],
    notCalledPlayers: [{ id: "p3", displayName: "Jugador Desconvocado" }],
    pendingPlayers: [],
    notAttendingPlayers: [{ id: "p2", displayName: "Jugador Ausente", assistanceTypeId: 2 }],
  }),
}));

type TabProps = {
  mgmtEventId: string | null;
  teamId: string;
  lineupPlayers: SquadPlayer[];
  notCalledPlayers?: SquadPlayer[];
  notAttendingPlayers?: SquadPlayer[];
  lineupRef: RefObject<IdealLineupHandle | null>;
  onDeconvoke?: (playerId: string) => void;
};

vi.mock("../components/AlineacionTab", () => ({
  default: (props: TabProps) => {
    (props.lineupRef as { current: IdealLineupHandle | null }).current = { save: saveLineupMock };
    return (
      <div
        data-testid="alineacion"
        data-event={props.mgmtEventId ?? ""}
        data-team={props.teamId}
        data-players={props.lineupPlayers.map((p) => p.id).join(",")}
        data-not-called={(props.notCalledPlayers ?? []).map((p) => p.id).join(",")}
        data-not-attending={(props.notAttendingPlayers ?? []).map((p) => p.id).join(",")}
      >
        <button type="button" onClick={() => props.onDeconvoke?.("p1")}>
          desconvocar p1
        </button>
      </div>
    );
  },
}));

vi.mock("../components/ConvocationDeconvokeDialog", () => ({
  default: (props: { open: boolean; onChange: (v: number) => void; onConfirm: () => void }) =>
    props.open ? (
      <div data-testid="deconvoke-dialog">
        <button type="button" onClick={() => props.onChange(7)}>motivo</button>
        <button type="button" onClick={props.onConfirm}>confirmar</button>
      </div>
    ) : null,
}));

import LineupPage from "../LineupPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/coach/convocations/lineup?teamId=team-1&eventId=event-1"]}>
      <Routes>
        <Route path="/coach/convocations/lineup" element={<LineupPage />} />
        <Route path="/coach/convocations/match" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LineupPage - alineación a pantalla completa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSportEventByIdMock.mockResolvedValue({
      id: "event-1",
      teamId: "team-1",
      isHomeMatch: true,
      eveDateTime: "2026-10-10T00:00:00Z",
      teamName: "Mi Equipo",
      rivalName: "Rival FC",
      matchCategory: "League",
    });
  });

  it("muestra la alineación del partido con el equipo y el evento de la URL", async () => {
    renderPage();

    const tab = await screen.findByTestId("alineacion");
    expect(tab).toHaveAttribute("data-event", "event-1");
    expect(tab).toHaveAttribute("data-team", "team-1");
    expect(tab).toHaveAttribute("data-not-called", "p3");
    expect(tab).toHaveAttribute("data-not-attending", "p2");
  });

  it("excluye del campo y banquillo a los jugadores que no asisten", async () => {
    renderPage();

    expect(await screen.findByTestId("alineacion")).toHaveAttribute("data-players", "p1");
  });

  it("'Guardar' guarda la alineación", async () => {
    renderPage();
    await screen.findByTestId("alineacion");

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(saveLineupMock).toHaveBeenCalledTimes(1);
  });

  it("muestra el botón de motivos de minutos en la barra", async () => {
    renderPage();
    await screen.findByTestId("alineacion");

    expect(screen.getByRole("button", { name: /motivos de minutos/i })).toBeInTheDocument();
  });

  it("desconvocar pide el motivo y lo guarda", async () => {
    renderPage();
    await screen.findByTestId("alineacion");

    await userEvent.click(screen.getByRole("button", { name: "desconvocar p1" }));
    await userEvent.click(screen.getByRole("button", { name: "motivo" }));
    await userEvent.click(screen.getByRole("button", { name: "confirmar" }));

    await waitFor(() => expect(moveToNotCalledMock).toHaveBeenCalledWith("p1", 7));
  });

  it("'Volver' regresa a la ficha del partido con el equipo y el evento", async () => {
    renderPage();
    await screen.findByTestId("alineacion");

    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/coach/convocations/match?teamId=team-1&eventId=event-1",
    );
  });
});
