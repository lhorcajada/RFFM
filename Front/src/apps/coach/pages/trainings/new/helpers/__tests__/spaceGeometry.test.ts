import { describe, expect, it } from "vitest";
import { FULL_FIELD_LENGTH_METERS } from "../../constants";
import { getBaseDimensionsMeters, getMaxScalesForPlayableArea, getPlayableBounds } from "../spaceGeometry";

describe("getPlayableBounds — zona jugable del campo completo", () => {
  it("abarca ambas mitades: de la línea de gol izquierda (x negativa) a la derecha, en % de la mitad derecha", () => {
    expect(getPlayableBounds(8, 10)).toEqual({ left: -90, right: 90, top: 8, bottom: 92 });
  });
});

describe("getMaxScalesForPlayableArea — tamaño máximo de los sectores", () => {
  it("permite que un sector ocupe todo el largo del campo completo, no solo media parte", () => {
    const base = getBaseDimensionsMeters("rectangle");
    expect(getMaxScalesForPlayableArea("rectangle").x).toBe(FULL_FIELD_LENGTH_METERS / base.width);
  });
});

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
