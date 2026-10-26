import { describe, expect, it } from "vitest";
import { getSegmentFilter } from "../attendanceUtils";

// Wednesday 28 Oct 2026
const NOW = new Date(2026, 9, 28, 12, 0, 0);
const SEASON = { startDate: "2026-08-01", endDate: "2027-06-30" };

describe("getSegmentFilter", () => {
  it("«Próximos» va de hoy al fin de temporada en orden ascendente", () => {
    expect(getSegmentFilter("upcoming", SEASON, NOW)).toEqual({
      start: "2026-10-28",
      end: "2027-06-30",
      descending: false,
    });
  });

  it("«Pasados» va del inicio de temporada a ayer en orden descendente", () => {
    expect(getSegmentFilter("past", SEASON, NOW)).toEqual({
      start: "2026-08-01",
      end: "2026-10-27",
      descending: true,
    });
  });

  it("«Toda la temporada» va del inicio al fin de temporada en orden ascendente", () => {
    expect(getSegmentFilter("season", SEASON, NOW)).toEqual({
      start: "2026-08-01",
      end: "2027-06-30",
      descending: false,
    });
  });

  it("sin temporada cargada usa el 1 de agosto del curso en marcha como inicio", () => {
    expect(getSegmentFilter("past", null, NOW).start).toBe("2026-08-01");
    expect(getSegmentFilter("past", null, new Date(2027, 2, 10)).start).toBe("2026-08-01");
  });

  it("sin temporada cargada «Próximos» acaba el 31 de diciembre", () => {
    expect(getSegmentFilter("upcoming", null, NOW).end).toBe("2026-12-31");
  });
});
