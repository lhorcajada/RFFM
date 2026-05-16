import { describe, expect, it } from "vitest";
import { isProtectedStreakAbsence } from "../deconvokeProposal";
import type { GridCell } from "../../components/convocationMatchDetail.types";

describe("isProtectedStreakAbsence", () => {
  it.each([
    [{ statusName: "Deconvoke", excuseTypeId: 1, excuseName: "Lesión" }, true],
    [{ statusName: "Deconvoke", excuseTypeId: 3, excuseName: "Ill" }, true],
    [{ statusName: "Deconvoke", excuseTypeId: 4, excuseName: "Family Problem" }, true],
    [{ statusName: "Deconvoke", excuseTypeId: 7, excuseName: "Decisión técnica" }, false],
    [{ statusName: "Convocado", excuseTypeId: 1, excuseName: "Lesión" }, false],
  ])("returns %s for cell %o", (cell, expected) => {
    expect(isProtectedStreakAbsence(cell as GridCell)).toBe(expected);
  });
});