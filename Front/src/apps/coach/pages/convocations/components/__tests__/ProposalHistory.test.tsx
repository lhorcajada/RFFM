import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GridCell, MatchColumn } from "../convocationMatchDetail.types";
import ProposalHistory from "../ProposalHistory";

const TECHNICAL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const INJURY: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };

const columns: MatchColumn[] = [
  { eventId: "j2", label: "J2 · 11 oct", date: "2026-10-11", rival: null, isLeague: true },
  { eventId: "j1", label: "J1 · 4 oct", date: "2026-10-04", rival: null, isLeague: true },
];

const grid = new Map([
  ["j2", new Map([["p1", TECHNICAL]])],
  ["j1", new Map([["p1", INJURY]])],
]);

function renderHistory(playerId = "p1") {
  render(<ProposalHistory playerId={playerId} playerName="Sergio" columns={columns} grid={grid} />);
}

describe("ProposalHistory", () => {
  it("resume las cifras y la última desconvocatoria", () => {
    renderHistory();
    const summary = screen.getByRole("group", { name: "Historial de Sergio" });

    expect(summary).toHaveTextContent("2desconv.");
    expect(summary).toHaveTextContent("1técnica");
    expect(summary).toHaveTextContent("0jorn. sin técnica");
    expect(summary).toHaveTextContent("Última: J2 · 11 oct · Decisión técnica");
    expect(within(summary).getByRole("img", { name: "Temporada de Sergio: 2 desconvocatorias en 2 partidos de liga" })).toBeInTheDocument();
  });

  it("cada casilla de la tira indica su jornada, también en temporadas largas", () => {
    const season: MatchColumn[] = Array.from({ length: 30 }, (_, i) => ({
      eventId: `m${30 - i}`,
      label: `J${30 - i} · 4 oct`,
      date: "2026-10-04",
      rival: null,
      isLeague: true,
    }));
    render(<ProposalHistory playerId="p1" playerName="Sergio" columns={season} grid={new Map()} />);

    const strip = screen.getByRole("img", { name: /Temporada de Sergio/ });

    expect(Array.from(strip.children, (cell) => cell.textContent)).toEqual(
      Array.from({ length: 30 }, (_, i) => `J${i + 1}`),
    );
  });

  it("muestra los motivos solo al abrir el desplegable", () => {
    renderHistory();
    expect(screen.queryByRole("list", { name: "Motivos de desconvocatoria de Sergio" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Motivos de Sergio" }));

    const list = screen.getByRole("list", { name: "Motivos de desconvocatoria de Sergio" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Decisión técnica1", "Lesión1"]);
  });

  it("cierra el desplegable con Escape", async () => {
    renderHistory();
    fireEvent.click(screen.getByRole("button", { name: "Motivos de Sergio" }));

    fireEvent.keyDown(screen.getByRole("list", { name: "Motivos de desconvocatoria de Sergio" }), { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Motivos de desconvocatoria de Sergio" })).not.toBeInTheDocument(),
    );
  });

  it("sin desconvocatorias lo indica y no ofrece motivos", () => {
    renderHistory("p9");

    expect(screen.getByText("Sin desconvocatorias esta temporada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Motivos de Sergio" })).not.toBeInTheDocument();
  });
});
