import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonPanel, { type SeasonRound } from "../SeasonPanel";
import { calendarMatch } from "../../__tests__/fixtures";

const rounds: SeasonRound[] = [
  { number: 1, entry: calendarMatch({ localGoals: "3", visitorGoals: "1", date: "13-09-2026", visitorTeamImageUrl: "/escudos/rival.png" }) },
  { number: 2, entry: calendarMatch({ localTeamCode: "300", localTeamName: "Lejos CF", visitorTeamCode: "100", visitorTeamName: "Mi Equipo", localGoals: "2", visitorGoals: "2", date: "20-09-2026" }) },
  { number: 3, entry: "bye" },
  { number: 4, entry: calendarMatch({ date: "04-10-2026", time: "12:15" }) },
  { number: 5, entry: undefined },
  { number: 6, entry: calendarMatch({ status: "3", date: "18-10-2026" }) },
];

const onSelect = vi.fn();

function renderPanel(props: Partial<React.ComponentProps<typeof SeasonPanel>> = {}) {
  return render(
    <SeasonPanel rounds={rounds} teamCode="100" selectedNumber={4} currentNumber={4} loading={false} error={false} onSelect={onSelect} {...props} />,
  );
}

describe("SeasonPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el balance de la temporada", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Tu temporada" })).toBeInTheDocument();
    expect(screen.getByText("1 V · 1 E · 0 D")).toBeInTheDocument();
    expect(screen.getByText("5 GF · 3 GC")).toBeInTheDocument();
  });

  it("muestra una fila por jornada con rival, campo y resultado", () => {
    renderPanel();

    const first = screen.getByRole("button", { name: "Jornada 1, Rival UD, casa, 3–1, victoria" });
    expect(first).toHaveTextContent("Rival UD");
    expect(first).toHaveTextContent("Casa · Dom 13 sep");
    expect(first).toHaveTextContent("3–1");
    expect(first).toHaveTextContent("V");
    expect(screen.getByRole("button", { name: /^Jornada 2,/ })).toHaveTextContent("Fuera · Dom 20 sep");
    expect(screen.getByRole("button", { name: /^Jornada 3,/ })).toHaveTextContent("Descansa");
    expect(screen.getByRole("button", { name: /^Jornada 4,/ })).toHaveTextContent("12:15");
  });

  it("marca «Suspendido» la jornada con el partido suspendido", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Jornada 6, Rival UD, casa, suspendido" })).toHaveTextContent("Suspendido");
  });

  it("muestra el escudo del rival en cada fila", () => {
    renderPanel();

    expect(screen.getByRole("img", { name: "Escudo de Rival UD" })).toHaveAttribute("src", "https://www.rffm.es/escudos/rival.png");
  });

  it("marca la jornada seleccionada y selecciona otra al pulsarla", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: /^Jornada 4,/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Jornada 2,/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("muestra un aviso si no se pudo cargar la temporada", () => {
    renderPanel({ error: true });

    expect(screen.getByText("No se ha podido cargar la temporada del equipo.")).toBeInTheDocument();
  });

  it("muestra un indicador mientras carga", () => {
    renderPanel({ loading: true });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
