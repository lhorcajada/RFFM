import { describe, expect, it } from "vitest";
import { countMissedEventsDuringInjury } from "../injuryMissedEvents";

const injury = { startDate: "2026-09-10", endDate: "2026-09-20" };

describe("countMissedEventsDuringInjury", () => {
  it("devuelve 0 si la lesión fue en un periodo sin entrenamientos ni partidos", () => {
    expect(countMissedEventsDuringInjury(injury, ["2026-09-05", "2026-09-22"], ["2026-09-06", "2026-09-27"])).toBe(0);
  });

  it("cuenta los entrenamientos perdidos entre el inicio de la lesión y el alta", () => {
    expect(countMissedEventsDuringInjury(injury, ["2026-09-10", "2026-09-15", "2026-09-20"], [])).toBe(2);
  });

  it("cuenta los partidos jugados por el equipo mientras el jugador estaba lesionado", () => {
    expect(countMissedEventsDuringInjury(injury, [], ["2026-09-10", "2026-09-13", "2026-09-20"])).toBe(1);
  });

  it("acepta fechas con hora", () => {
    expect(
      countMissedEventsDuringInjury(
        { startDate: "2026-09-10T08:00:00Z", endDate: "2026-09-20T10:00:00.000Z" },
        ["2026-09-12T19:00:00"],
        [],
      ),
    ).toBe(1);
  });
});
