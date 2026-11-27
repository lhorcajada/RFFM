import { describe, expect, it } from "vitest";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import { buildProposalHistory } from "../proposalHistory";

const TECHNICAL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const INJURY: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const CALLED: GridCell = { statusId: 2, excuseTypeId: null, statusName: "Convocado", excuseName: null };

// Newest first, as the grid hook returns them.
const columns: MatchColumn[] = [
  { eventId: "j4", label: "J4 · 25 oct", date: "2026-10-25", rival: null, isLeague: true },
  { eventId: "j3", label: "J3 · 18 oct", date: "2026-10-18", rival: null, isLeague: true },
  { eventId: "fr", label: "Amist. · 14 oct", date: "2026-10-14", rival: null, isLeague: false },
  { eventId: "j2", label: "J2 · 11 oct", date: "2026-10-11", rival: null, isLeague: true },
  { eventId: "j1", label: "J1 · 4 oct", date: "2026-10-04", rival: null, isLeague: true },
];

function grid(cells: Record<string, GridCell>) {
  return new Map(Object.entries(cells).map(([eventId, cell]) => [eventId, new Map([["p1", cell]])]));
}

const history = () =>
  buildProposalHistory("p1", columns, grid({ j4: CALLED, j3: TECHNICAL, fr: TECHNICAL, j2: INJURY, j1: INJURY }));

describe("buildProposalHistory", () => {
  it("cuenta solo partidos de liga", () => {
    const result = history();

    expect(result.total).toBe(3);
    expect(result.technical).toBe(1);
    expect(result.streak).toBe(1);
  });

  it("la tira de la temporada va del más antiguo al más reciente y sin amistosos", () => {
    expect(history().season.map((cell) => cell.eventId)).toEqual(["j1", "j2", "j3", "j4"]);
  });

  it("agrupa los motivos de más a menos frecuente", () => {
    expect(history().causes.map((c) => [c.cause.label, c.count])).toEqual([
      ["Lesión", 2],
      ["Decisión técnica", 1],
    ]);
  });

  it("da la última desconvocatoria de liga", () => {
    expect(history().last).toMatchObject({ label: "J3 · 18 oct", cause: { label: "Decisión técnica" } });
  });

  it("sin desconvocatorias no hay última ni motivos", () => {
    const result = buildProposalHistory("p2", columns, grid({ j3: TECHNICAL }));

    expect(result.total).toBe(0);
    expect(result.streak).toBe(4);
    expect(result.causes).toEqual([]);
    expect(result.last).toBeNull();
  });
});
