import { describe, expect, it } from "vitest";
import {
  classifyNotCalledState,
  MATCH_LEGEND_STATES,
  MATCH_STATE_ABBREV,
  MATCH_STATE_LABELS,
  MATCH_STATE_RGB,
} from "../matchAttendanceState";

function excuseMap(entries: Array<[number, { name: string; justified?: boolean }]>) {
  return new Map(entries);
}

describe("classifyNotCalledState", () => {
  it("clasifica como decisión técnica cuando no hay excuseTypeId", () => {
    expect(classifyNotCalledState(null, excuseMap([]))).toBe("technicalDecision");
    expect(classifyNotCalledState(undefined, excuseMap([]))).toBe("technicalDecision");
  });

  it("clasifica como decisión técnica cuando el tipo de excusa no está justificado", () => {
    const map = excuseMap([[1, { name: "Decisión técnica", justified: false }]]);
    expect(classifyNotCalledState(1, map)).toBe("technicalDecision");
  });

  it("clasifica como decisión técnica cuando el excuseTypeId no existe en el catálogo", () => {
    expect(classifyNotCalledState(999, excuseMap([]))).toBe("technicalDecision");
  });

  it("clasifica como lesión cuando el nombre de la excusa es 'Lesión' (con tilde)", () => {
    const map = excuseMap([[2, { name: "Lesión", justified: true }]]);
    expect(classifyNotCalledState(2, map)).toBe("injury");
  });

  it("clasifica como lesión de forma insensible a mayúsculas/acentos ('LESION')", () => {
    const map = excuseMap([[2, { name: "LESION", justified: true }]]);
    expect(classifyNotCalledState(2, map)).toBe("injury");
  });

  it("clasifica como enfermedad cuando el nombre de la excusa es 'Enfermedad'", () => {
    const map = excuseMap([[3, { name: "Enfermedad", justified: true }]]);
    expect(classifyNotCalledState(3, map)).toBe("illness");
  });

  it("clasifica como no disponible cualquier otro motivo justificado no reconocido", () => {
    const map = excuseMap([
      [4, { name: "Estudios", justified: true }],
      [5, { name: "Problema familiar", justified: true }],
      [6, { name: "Evento familiar", justified: true }],
      [7, { name: "Cumpleaños", justified: true }],
    ]);
    expect(classifyNotCalledState(4, map)).toBe("unavailable");
    expect(classifyNotCalledState(5, map)).toBe("unavailable");
    expect(classifyNotCalledState(6, map)).toBe("unavailable");
    expect(classifyNotCalledState(7, map)).toBe("unavailable");
  });
});

describe("MATCH_STATE_ABBREV / MATCH_STATE_LABELS / MATCH_STATE_RGB", () => {
  it("cubren los 7 estados posibles con letras cortas distintas para los 6 estados visibles", () => {
    expect(MATCH_STATE_ABBREV.starter).toBe("T");
    expect(MATCH_STATE_ABBREV.called).toBe("C");
    expect(MATCH_STATE_ABBREV.technicalDecision).toBe("D");
    expect(MATCH_STATE_ABBREV.unavailable).toBe("ND");
    expect(MATCH_STATE_ABBREV.injury).toBe("L");
    expect(MATCH_STATE_ABBREV.illness).toBe("E");
  });

  it("da un texto completo distinto para cada estado", () => {
    const labels = MATCH_LEGEND_STATES.map((state) => MATCH_STATE_LABELS[state]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("da un color RGB para cada estado del listado de leyenda", () => {
    MATCH_LEGEND_STATES.forEach((state) => {
      expect(MATCH_STATE_RGB[state]).toHaveLength(3);
    });
  });

  it("la leyenda incluye exactamente los 6 estados visibles, sin 'absent'", () => {
    expect(MATCH_LEGEND_STATES).toEqual([
      "starter",
      "called",
      "technicalDecision",
      "unavailable",
      "injury",
      "illness",
    ]);
  });
});
