import { describe, expect, it } from "vitest";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import { leagueTechnicalTotals } from "../technicalTotals";

const TECHNICAL: GridCell = { statusId: 3, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const INJURY: GridCell = { statusId: 3, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };

const columns: MatchColumn[] = [
  { eventId: "league", label: "J2", date: "2026-10-04", rival: null, isLeague: true },
  { eventId: "friendly", label: "Amist.", date: "2026-09-27", rival: null, isLeague: false },
  { eventId: "old", label: "J1", date: "2026-09-20", rival: null },
];

function grid(cells: Record<string, GridCell>) {
  return new Map(Object.entries(cells).map(([eventId, cell]) => [eventId, new Map([["p1", cell]])]));
}

describe("leagueTechnicalTotals", () => {
  it("cuenta las desconvocatorias técnicas de partidos de liga", () => {
    const totals = leagueTechnicalTotals(["p1"], columns, grid({ league: TECHNICAL, friendly: CALLED, old: TECHNICAL }));

    expect(totals.get("p1")).toBe(2);
  });

  it("no cuenta las de amistosos ni torneos", () => {
    const totals = leagueTechnicalTotals(["p1"], columns, grid({ league: CALLED, friendly: TECHNICAL, old: CALLED }));

    expect(totals.get("p1")).toBe(0);
  });

  it("no cuenta las ausencias por lesión como técnicas", () => {
    expect(leagueTechnicalTotals(["p1"], columns, grid({ league: INJURY })).get("p1")).toBe(0);
  });

  it("da 0 al jugador sin datos", () => {
    expect(leagueTechnicalTotals(["p2"], columns, grid({ league: TECHNICAL })).get("p2")).toBe(0);
  });
});
