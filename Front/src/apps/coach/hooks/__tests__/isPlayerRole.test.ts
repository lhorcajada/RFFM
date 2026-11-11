import { describe, it, expect } from "vitest";
import { computeIsCoachRole } from "../isPlayerRole";

describe("computeIsCoachRole", () => {
  it("reconoce el rol Coach", () => {
    expect(computeIsCoachRole(["Coach"])).toBe(true);
  });

  it("reconoce el rol Coach sin importar mayúsculas", () => {
    expect(computeIsCoachRole(["coach"])).toBe(true);
  });

  it("sigue siendo Coach aunque tenga también el rol Administrator", () => {
    expect(computeIsCoachRole(["Coach", "Administrator"])).toBe(true);
  });

  it("no considera Coach a un Administrator sin el rol Coach", () => {
    expect(computeIsCoachRole(["Administrator"])).toBe(false);
  });

  it("no considera Coach a un Player", () => {
    expect(computeIsCoachRole(["Player"])).toBe(false);
  });

  it("no considera Coach a un FamilyMember", () => {
    expect(computeIsCoachRole(["FamilyMember"])).toBe(false);
  });

  it("no considera Coach a un usuario sin roles", () => {
    expect(computeIsCoachRole([])).toBe(false);
  });
});
