import { describe, expect, it } from "vitest";
import { getBaseDimensionsMeters } from "../spaceGeometry";

describe("getBaseDimensionsMeters — tamaño inicial de los sectores", () => {
  it("el cuadrado arranca con 10x10 metros", () => {
    expect(getBaseDimensionsMeters("square")).toEqual({ width: 10, height: 10 });
  });

  it("el círculo arranca con un diámetro de 10x10 metros", () => {
    expect(getBaseDimensionsMeters("circle")).toEqual({ width: 10, height: 10 });
  });

  it("el rectángulo arranca con 20x10 metros manteniendo su proporción 2:1", () => {
    expect(getBaseDimensionsMeters("rectangle")).toEqual({ width: 20, height: 10 });
  });
});
