import { describe, expect, it } from "vitest";
import { buildLastMatchMinutes } from "../lastMatchMinutes";
import type { MatchColumn } from "../../components/convocationMatchDetail.types";

const columns: MatchColumn[] = [
  { eventId: "e3", label: "J3 · 12 abr", date: "2026-04-12", rival: null },
  { eventId: "e2", label: "J2 · 05 abr", date: "2026-04-05", rival: null },
  { eventId: "e1", label: "J1 · 29 mar", date: "2026-03-29", rival: null },
];

const row = (eventId: string, teamPlayerId: string, minutesPlayed: number) => ({
  eventId,
  teamPlayerId,
  minutesPlayed,
  isStarter: false,
});

describe("buildLastMatchMinutes", () => {
  it("devuelve los minutos del partido más reciente con datos", () => {
    const result = buildLastMatchMinutes([row("e2", "a", 10), row("e2", "b", 0), row("e1", "a", 60)], columns);

    expect(result?.label).toBe("J2 · 05 abr");
    expect(result?.minutes.get("a")).toBe(10);
    expect(result?.minutes.get("b")).toBe(0);
  });

  it("no mezcla los minutos de partidos anteriores", () => {
    const result = buildLastMatchMinutes([row("e2", "a", 10), row("e1", "c", 60)], columns);

    expect(result?.minutes.has("c")).toBe(false);
  });

  it("devuelve null si ningún partido de la temporada tiene minutos", () => {
    expect(buildLastMatchMinutes([row("otro", "a", 10)], columns)).toBeNull();
    expect(buildLastMatchMinutes([], columns)).toBeNull();
  });
});
