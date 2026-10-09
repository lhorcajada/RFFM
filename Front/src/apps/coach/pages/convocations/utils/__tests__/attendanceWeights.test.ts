import { describe, expect, it } from "vitest";
import { absencePenalty, classifyFriendlyConvocation, isFriendlyEvent } from "../attendanceWeights";

describe("absencePenalty", () => {
  it.each([
    [10, "Imprevisto"],
    [4, "Problema familiar"],
  ])("penaliza medio evento una falta por %s (%s)", (excuseTypeId) => {
    expect(absencePenalty(excuseTypeId)).toBe(0.5);
  });

  it.each([
    [2, "Estudios"],
    [3, "Enfermedad"],
    [9, "Cita médica"],
  ])("penaliza tres cuartos de evento una falta por %s (%s)", (excuseTypeId) => {
    expect(absencePenalty(excuseTypeId)).toBe(0.75);
  });

  it.each([
    [5, "Evento familiar"],
    [6, "Cumpleaños"],
    [8, "Sanción deportiva"],
    [null, "sin motivo"],
  ])("penaliza el evento completo una falta por %s (%s)", (excuseTypeId) => {
    expect(absencePenalty(excuseTypeId)).toBe(1);
  });

  it.each([
    [1, "Lesión"],
    [7, "Decisión técnica"],
  ])("no penaliza una falta por %s (%s)", (excuseTypeId) => {
    expect(absencePenalty(excuseTypeId)).toBe(0);
  });
});

describe("classifyFriendlyConvocation", () => {
  it.each([1, 4])("cuenta como asistencia el tipo de asistencia %s", (assistanceTypeId) => {
    expect(classifyFriendlyConvocation({ assistanceTypeId, statusId: 2 })).toBe("attended");
  });

  it.each([2, 3])("cuenta como falta el tipo de asistencia %s", (assistanceTypeId) => {
    expect(classifyFriendlyConvocation({ assistanceTypeId, statusId: 2 })).toBe("absent");
  });

  it("cuenta como falta una convocatoria justificada sin asistencia registrada", () => {
    expect(classifyFriendlyConvocation({ assistanceTypeId: null, statusId: 4 })).toBe("absent");
  });

  it("no cuenta una desconvocatoria del entrenador", () => {
    expect(classifyFriendlyConvocation({ assistanceTypeId: null, statusId: 5 })).toBeNull();
  });
});

describe("isFriendlyEvent", () => {
  it("reconoce un amistoso por su categoría de partido", () => {
    expect(isFriendlyEvent({ matchCategory: "Friendly" })).toBe(true);
  });

  it("reconoce un amistoso por su título", () => {
    expect(isFriendlyEvent({ title: "Amistoso vs Getafe" })).toBe(true);
  });

  it("no considera amistoso un partido de liga", () => {
    expect(isFriendlyEvent({ matchCategory: "League", title: "Jornada 4" })).toBe(false);
  });
});
