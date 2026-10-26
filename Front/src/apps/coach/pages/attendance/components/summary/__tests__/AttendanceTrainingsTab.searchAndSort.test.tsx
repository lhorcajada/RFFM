import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
  },
}));

import AttendanceTrainingsTab from "../AttendanceTrainingsTab";
import type { PlayerTrainingSummary } from "../types";

function makeRow(overrides: Partial<PlayerTrainingSummary>): PlayerTrainingSummary {
  return {
    playerId: "player-1",
    teamPlayerId: "tp-1",
    playerName: "Jugador Uno",
    photoUrl: null,
    totalTrainings: 4,
    attendedTrainings: 3,
    absentTrainings: 1,
    absences: [],
    ...overrides,
  };
}

const rows: PlayerTrainingSummary[] = [
  makeRow({ playerId: "p-1", teamPlayerId: "tp-1", playerName: "Marcos Gil", totalTrainings: 4, attendedTrainings: 4, absentTrainings: 0 }),
  makeRow({
    playerId: "p-2",
    teamPlayerId: "tp-2",
    playerName: "Iker Ruiz",
    totalTrainings: 4,
    attendedTrainings: 2,
    absentTrainings: 2,
    absences: [
      { eventId: "e-1", eventTitle: "Entrenamiento martes", date: "2026-10-14T12:00:00", reason: "Lesión" },
      { eventId: "e-2", eventTitle: "Entrenamiento jueves", date: "2026-10-09T12:00:00", reason: "Enfermedad" },
    ],
  }),
  makeRow({ playerId: "p-3", teamPlayerId: "tp-3", playerName: "Hugo Martín", totalTrainings: 4, attendedTrainings: 3, absentTrainings: 1 }),
];

function visibleNames(): string[] {
  return screen
    .getAllByText(/^(Marcos Gil|Iker Ruiz|Hugo Martín)$/)
    .map((el) => el.textContent ?? "");
}

describe("AttendanceTrainingsTab — buscador, orden y tarjeta de jugador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra los jugadores cuyo nombre contiene el texto buscado", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={rows} />);

    await user.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "hug");

    expect(visibleNames()).toEqual(["Hugo Martín"]);
  });

  it("avisa cuando la búsqueda no encuentra jugadores", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={rows} />);

    await user.type(screen.getByRole("textbox", { name: /buscar jugador/i }), "zzz");

    expect(screen.getByText(/ningún jugador coincide/i)).toBeInTheDocument();
  });

  it("ordena de menor a mayor asistencia al pulsar «Menor asistencia»", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Menor asistencia" }));

    expect(visibleNames()).toEqual(["Iker Ruiz", "Hugo Martín", "Marcos Gil"]);
    expect(screen.getByRole("button", { name: "Menor asistencia" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ordena alfabéticamente al pulsar «Nombre»", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Nombre" }));

    expect(visibleNames()).toEqual(["Hugo Martín", "Iker Ruiz", "Marcos Gil"]);
  });

  it("mantiene el orden recibido mientras no se elija un criterio", () => {
    render(<AttendanceTrainingsTab rows={rows} />);

    expect(visibleNames()).toEqual(["Marcos Gil", "Iker Ruiz", "Hugo Martín"]);
  });

  it("muestra el porcentaje como texto y una barra de progreso accesible", () => {
    render(<AttendanceTrainingsTab rows={[rows[1]]} />);

    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByText("2 de 4 sesiones")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /asistencia de iker ruiz/i })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
  });

  it("resume jugadores, entrenamientos posibles y media del equipo", () => {
    const { container } = render(<AttendanceTrainingsTab rows={rows} />);

    expect(container.textContent).toMatch(/3\s*jugadores/);
    expect(container.textContent).toMatch(/4\s*entrenamientos posibles/);
    expect(container.textContent).toMatch(/Media del equipo\s*75%/);
  });

  it("despliega las faltas con fecha, motivo y evento", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={[rows[1]]} />);

    expect(screen.queryByText("Lesión")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver faltas/i }));

    const list = screen.getByRole("list", { name: /no asistencias/i });
    const first = within(list).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("14");
    expect(first).toHaveTextContent("Lesión");
    expect(first).toHaveTextContent("Entrenamiento martes");
  });

  it("muestra «Sin ausencias registradas» para un jugador sin faltas", async () => {
    const user = userEvent.setup();
    render(<AttendanceTrainingsTab rows={[rows[0]]} />);

    await user.click(screen.getByRole("button", { name: /ver faltas/i }));

    expect(screen.getByText("Sin ausencias registradas")).toBeInTheDocument();
  });
});
