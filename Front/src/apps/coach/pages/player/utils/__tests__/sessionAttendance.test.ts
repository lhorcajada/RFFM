import { describe, it, expect } from "vitest";
import { ATTENDANCE_LABELS, attendanceFromAssistanceType, isAbsent } from "../sessionAttendance";

describe("sessionAttendance", () => {
  it.each([
    [true, 1, "attended"],
    [true, 4, "late"],
    [true, 2, "absent-excused"],
    [true, 3, "absent-unexcused"],
    [true, null, "unknown"],
    [false, null, "no-event"],
  ] as const)("con evento=%s y asistencia %s devuelve %s", (hasEvent, assistanceTypeId, expected) => {
    expect(attendanceFromAssistanceType(hasEvent, assistanceTypeId)).toBe(expected);
  });

  it("tiene una etiqueta en español para cada estado", () => {
    expect(ATTENDANCE_LABELS).toEqual({
      attended: "Asistió",
      late: "Llegó tarde",
      "absent-excused": "No asistió (con excusa)",
      "absent-unexcused": "No asistió (sin excusa)",
      unknown: "Sin registrar",
      "no-event": "Sin evento",
    });
  });

  it("solo considera ausencia no asistir con o sin excusa", () => {
    expect(isAbsent("absent-excused")).toBe(true);
    expect(isAbsent("absent-unexcused")).toBe(true);
    expect(isAbsent("late")).toBe(false);
    expect(isAbsent("unknown")).toBe(false);
  });
});
