import { describe, expect, it } from "vitest";
import recentDeconvocationRule from "../recentDeconvocationRule";
import type { RuleContext } from "../types";
import type { GridCell, MatchColumn } from "../../../components/convocationMatchDetail.types";

const CALLED: GridCell = { statusId: 1, excuseTypeId: null, statusName: "Convocado", excuseName: null };
const DECONVOKED: GridCell = { statusId: 3, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const INJURED: GridCell = { statusId: 3, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const UNAVAILABLE: GridCell = { statusId: 4, excuseTypeId: null, statusName: "No disponible", excuseName: null };

/** cells[0] es la jornada más reciente (como seasonColumns). */
function ctx(cells: Array<GridCell | undefined>): RuleContext {
  const seasonColumns = cells.map((_, i) => ({ eventId: `e${i}` }) as MatchColumn);
  const enrichedGrid = new Map<string, Map<string, GridCell>>();
  cells.forEach((cell, i) => {
    if (cell) enrichedGrid.set(`e${i}`, new Map([["p1", cell]]));
  });
  return { playerId: "p1", seasonColumns, enrichedGrid } as unknown as RuleContext;
}

describe("recentDeconvocationRule", () => {
  it.each([
    [1, 15],
    [2, 10],
    [3, 5],
  ])("desconvocado hace %i jornada(s) da %i puntos", (jornadasAgo, points) => {
    const cells = Array.from({ length: 6 }, (_, i) => (i === jornadasAgo - 1 ? DECONVOKED : CALLED));

    const result = recentDeconvocationRule(ctx(cells), {});

    expect(result.delta).toBe(points);
    expect(result.factors[0]).toMatchObject({ key: "recentDeconvocation", value: jornadasAgo, impact: points });
    expect(result.forced).toBeUndefined();
  });

  it.each([4, 5, 6])("no da puntos si la última desconvocatoria fue hace %i jornadas", (jornadasAgo) => {
    const cells = Array.from({ length: 7 }, (_, i) => (i === jornadasAgo - 1 ? DECONVOKED : CALLED));

    expect(recentDeconvocationRule(ctx(cells), {})).toEqual({ factors: [], delta: 0 });
  });

  it("no da puntos si nunca ha sido desconvocado", () => {
    expect(recentDeconvocationRule(ctx([CALLED, CALLED, undefined]), {})).toEqual({ factors: [], delta: 0 });
  });

  it("usa la desconvocatoria más reciente si hay varias", () => {
    const result = recentDeconvocationRule(ctx([CALLED, CALLED, DECONVOKED, CALLED, DECONVOKED]), {});

    expect(result.delta).toBe(5);
  });

  it.each([
    ["lesión", INJURED],
    ["no disponible", UNAVAILABLE],
  ])("cuenta también la desconvocatoria por %s", (_name, cell) => {
    expect(recentDeconvocationRule(ctx([cell]), {}).delta).toBe(15);
  });
});
