import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import DesconvocatoriasTab from "../DesconvocatoriasTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "../convocationMatchDetail.types";

const player = (id: string, alias: string, extra: Partial<PlayerResponse> = {}) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, isInjured: false, ...extra }) as unknown as PlayerResponse;

const players = [
  player("p1", "Ana Uno"),
  player("p2", "Bea Dos"),
  player("p3", "Cris Tres"),
];

// Index 0 is the most recent match.
const matchColumns: MatchColumn[] = [
  { eventId: "e3", label: "J3", date: "2026-03-01", rival: "Rival C" },
  { eventId: "e2", label: "J2", date: "2026-02-01", rival: "Rival B" },
  { eventId: "e1", label: "J1", date: "2026-01-01", rival: "Rival A" },
];

const technical: GridCell = { statusId: 5, excuseTypeId: 7, statusName: "Deconvoke", excuseName: "Decisión técnica" };
const injury: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const study: GridCell = { statusId: 5, excuseTypeId: 2, statusName: "Deconvoke", excuseName: "Estudios" };
const called: GridCell = { statusId: 2, excuseTypeId: null, statusName: "Accepted", excuseName: null };

const enrichedGrid = new Map<string, Map<string, GridCell>>([
  ["e3", new Map([["p1", technical], ["p2", injury], ["p3", called]])],
  ["e2", new Map([["p1", technical], ["p2", injury], ["p3", called]])],
  ["e1", new Map([["p1", study], ["p2", called], ["p3", called]])],
]);

function renderTab(props: Partial<React.ComponentProps<typeof DesconvocatoriasTab>> = {}) {
  return render(
    <DesconvocatoriasTab
      players={players}
      matchColumns={matchColumns}
      enrichedGrid={enrichedGrid}
      isLoading={false}
      teamId="team-1"
      {...props}
    />,
  );
}

const cardOf = (name: string) => screen.getByRole("listitem", { name });

describe("DesconvocatoriasTab - tarjetas por jugador", () => {
  it("no usa tabla", () => {
    renderTab();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el total de desconvocatorias y de partidos", () => {
    renderTab();

    expect(screen.getByText("5 desconvocatorias en 3 partidos")).toBeInTheDocument();
  });

  it("muestra un chip por causa con su contador", () => {
    renderTab();

    expect(screen.getByLabelText("Decisión técnica: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Lesión: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Estudios: 1")).toBeInTheDocument();
  });

  it("muestra una tarjeta por cada jugador con alguna desconvocatoria, y ninguna para el resto", () => {
    renderTab();

    expect(cardOf("Ana Uno")).toBeInTheDocument();
    expect(cardOf("Bea Dos")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Cris Tres" })).not.toBeInTheDocument();
  });

  it("ordena las tarjetas por total de desconvocatorias descendente", () => {
    renderTab({ players: [players[1], players[0], players[2]] });

    const names = screen
      .getAllByRole("listitem")
      .map((li) => li.getAttribute("aria-label"))
      .filter((n): n is string => n === "Ana Uno" || n === "Bea Dos");
    expect(names).toEqual(["Ana Uno", "Bea Dos"]);
  });

  it("rotula las tres cifras de cada jugador", () => {
    renderTab();

    const card = within(cardOf("Ana Uno"));
    expect(card.getByText("Desconvocatorias").closest("div")).toHaveTextContent("3");
    expect(card.getByText("Decisión técnica", { selector: "dt" }).closest("div")).toHaveTextContent("2");
    expect(card.getByText("Jornadas sin técnica").closest("div")).toHaveTextContent("0");
  });

  it("cuenta las jornadas sin decisión técnica desde el último partido", () => {
    renderTab();

    const card = within(cardOf("Bea Dos"));
    expect(card.getByText("Jornadas sin técnica").closest("div")).toHaveTextContent("3");
  });

  it("muestra una fila por partido desconvocado con su etiqueta y su causa", () => {
    renderTab();

    const history = within(screen.getByRole("list", { name: "Partidos de Ana Uno" })).getAllByRole("listitem");
    expect(history).toHaveLength(3);
    expect(history[0]).toHaveTextContent("J3");
    expect(history[0]).toHaveTextContent("Decisión técnica");
    expect(history[2]).toHaveTextContent("J1");
    expect(history[2]).toHaveTextContent("Estudios");
  });

  it("no muestra fila del partido en el que el jugador estuvo convocado", () => {
    renderTab();

    const history = within(screen.getByRole("list", { name: "Partidos de Bea Dos" })).getAllByRole("listitem");
    expect(history).toHaveLength(2);
  });

  it("ofrece «Desconvocar» a quien no está desconvocado en este partido", () => {
    const onDeconvokePlayer = vi.fn();
    renderTab({ onDeconvokePlayer });

    fireEvent.click(within(cardOf("Ana Uno")).getByRole("button", { name: "Desconvocar a Ana Uno" }));

    expect(onDeconvokePlayer).toHaveBeenCalledWith("p1");
  });

  it("muestra «Desconvocado» en lugar del botón cuando ya está desconvocado en este partido", () => {
    renderTab({ onDeconvokePlayer: vi.fn(), currentNotCalled: ["p1"] });

    const card = within(cardOf("Ana Uno"));
    expect(card.getByText("Desconvocado")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: /Desconvocar/ })).not.toBeInTheDocument();
  });

  it("muestra «Desconvocado» a un jugador lesionado", () => {
    renderTab({
      players: [player("p1", "Ana Uno", { isInjured: true }), players[1]],
      onDeconvokePlayer: vi.fn(),
    });

    const card = within(cardOf("Ana Uno"));
    expect(card.getByText("Desconvocado")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: /Desconvocar/ })).not.toBeInTheDocument();
  });

  it("no ofrece acciones de desconvocar si la pantalla no las pasa", () => {
    renderTab();

    expect(screen.queryByRole("button", { name: /Desconvocar a/ })).not.toBeInTheDocument();
  });

  it("ofrece imprimir el resumen", () => {
    renderTab();

    expect(screen.getByRole("button", { name: "Imprimir resumen" })).toBeInTheDocument();
  });

  it("muestra un indicador de carga mientras carga", () => {
    renderTab({ isLoading: true });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("avisa cuando aún no hay partidos con asistencias", () => {
    renderTab({ matchColumns: [] });

    expect(screen.getByText(/Aún no hay partidos registrados con asistencias/)).toBeInTheDocument();
  });

  it("avisa cuando no hay desconvocatorias", () => {
    renderTab({ enrichedGrid: new Map([["e1", new Map([["p1", called]])]]) });

    expect(screen.getByText("No hay desconvocatorias registradas en ningún partido.")).toBeInTheDocument();
  });
});
