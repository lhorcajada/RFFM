import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import DesconvocatoriasTab from "../DesconvocatoriasTab";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "../convocationMatchDetail.types";

const player = (id: string, alias: string) =>
  ({ id, name: alias, lastName: "", alias, dorsal: null, isInjured: false }) as unknown as PlayerResponse;

const players = [player("p1", "Ana Uno"), player("p2", "Bea Dos")];

// Index 0 is the most recent match.
const matchColumns: MatchColumn[] = [
  { eventId: "e6", label: "J6", date: "2026-03-14", rival: "Rival F" },
  { eventId: "e5", label: "J5", date: "2026-03-07", rival: "Rival E" },
  { eventId: "e4", label: "J4", date: "2026-02-28", rival: "Rival D" },
  { eventId: "e3", label: "J3", date: "2026-02-21", rival: "Rival C" },
  { eventId: "e2", label: "J2", date: "2026-02-14", rival: "Rival B" },
  { eventId: "e1", label: "J1", date: "2026-02-07", rival: "Rival A" },
];

const technical: GridCell = { statusId: 5, excuseTypeId: 7, statusName: "Deconvoke", excuseName: "Decisión técnica" };
const injury: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const study: GridCell = { statusId: 5, excuseTypeId: 2, statusName: "Deconvoke", excuseName: "Estudios" };
const called: GridCell = { statusId: 2, excuseTypeId: null, statusName: "Accepted", excuseName: null };

// Ana: deconvoked in J6 (injury), J5 (technical), J3 (injury), J2 (study), J1 (injury); called in J4.
// Bea: deconvoked in J6 (technical) and J5 (study) only.
const enrichedGrid = new Map<string, Map<string, GridCell>>([
  ["e6", new Map([["p1", injury], ["p2", technical]])],
  ["e5", new Map([["p1", technical], ["p2", study]])],
  ["e4", new Map([["p1", called], ["p2", called]])],
  ["e3", new Map([["p1", injury], ["p2", called]])],
  ["e2", new Map([["p1", study], ["p2", called]])],
  ["e1", new Map([["p1", injury], ["p2", called]])],
]);

function renderTab() {
  return render(
    <DesconvocatoriasTab
      players={players}
      matchColumns={matchColumns}
      enrichedGrid={enrichedGrid}
      isLoading={false}
      teamId="team-1"
    />,
  );
}

const cardOf = (name: string) => within(screen.getByRole("listitem", { name }));
const rowsOf = (name: string) => within(screen.getByRole("list", { name: `Partidos de ${name}` })).getAllByRole("listitem");

describe("DesconvocatoriasTab - historial por jugador", () => {
  it("muestra el número de partidos de la temporada sobre la tira", () => {
    renderTab();

    expect(cardOf("Ana Uno").getByText("Temporada · 6 partidos")).toBeInTheDocument();
  });

  it("pinta en la tira una celda por partido con su causa en el título", () => {
    renderTab();

    const card = cardOf("Ana Uno");
    expect(card.getByTitle("J6 · Lesión")).toBeInTheDocument();
    expect(card.getByTitle("J5 · Decisión técnica")).toBeInTheDocument();
    expect(card.getByTitle("J1 · Lesión")).toBeInTheDocument();
  });

  it("deja sin causa la celda del partido en que estuvo convocado", () => {
    renderTab();

    expect(cardOf("Ana Uno").getByTitle("J4")).toBeInTheDocument();
  });

  it("lista solo las 3 últimas desconvocatorias, de la más reciente a la más antigua", () => {
    renderTab();

    const rows = rowsOf("Ana Uno");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("J6");
    expect(rows[0]).toHaveTextContent("Lesión");
    expect(rows[1]).toHaveTextContent("J5");
    expect(rows[2]).toHaveTextContent("J3");
  });

  it("ofrece «Ver las 2 restantes» cuando hay más de 3 desconvocatorias", () => {
    renderTab();

    const toggle = cardOf("Ana Uno").getByRole("button", { name: "Ver las 2 restantes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("revela el resto de desconvocatorias al pulsar «Ver las 2 restantes»", () => {
    renderTab();

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Ver las 2 restantes" }));

    const rows = rowsOf("Ana Uno");
    expect(rows).toHaveLength(5);
    expect(rows[4]).toHaveTextContent("J1");
  });

  it("vuelve a plegar el resto con «Ver menos»", () => {
    renderTab();
    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Ver las 2 restantes" }));

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Ver menos" }));

    expect(rowsOf("Ana Uno")).toHaveLength(3);
  });

  it("no ofrece «Ver las N restantes» a quien tiene 3 desconvocatorias o menos", () => {
    renderTab();

    expect(cardOf("Bea Dos").queryByRole("button", { name: /Ver las/ })).not.toBeInTheDocument();
    expect(rowsOf("Bea Dos")).toHaveLength(2);
  });

  it("muestra un botón por causa con su contador, sin pulsar", () => {
    renderTab();

    const button = cardOf("Ana Uno").getByRole("button", { name: "Lesión 3" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("filtra la lista por la causa pulsada y muestra cuántas de cuántas", () => {
    renderTab();

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" }));

    const rows = rowsOf("Ana Uno");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("J2");
    expect(cardOf("Ana Uno").getByText("Mostrando 1 de 5")).toBeInTheDocument();
    expect(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("con filtro activo lista todas las coincidencias sin plegar nada", () => {
    renderTab();

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Lesión 3" }));

    expect(rowsOf("Ana Uno")).toHaveLength(3);
    expect(cardOf("Ana Uno").queryByRole("button", { name: /Ver las/ })).not.toBeInTheDocument();
  });

  it("quita el filtro con «Quitar filtro»", () => {
    renderTab();
    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" }));

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Quitar filtro" }));

    expect(rowsOf("Ana Uno")).toHaveLength(3);
    expect(cardOf("Ana Uno").queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("pulsar de nuevo la causa activa quita el filtro", () => {
    renderTab();
    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" }));

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" }));

    expect(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("el filtro de una tarjeta no afecta a las demás", () => {
    renderTab();

    fireEvent.click(cardOf("Ana Uno").getByRole("button", { name: "Estudios 1" }));

    expect(rowsOf("Bea Dos")).toHaveLength(2);
  });
});
