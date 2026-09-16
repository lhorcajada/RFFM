import { describe, expect, it, vi, beforeEach } from "vitest";

const saveMock = vi.fn();
const textMock = vi.fn();
const setFontMock = vi.fn();
const setFontSizeMock = vi.fn();
const setFillColorMock = vi.fn();
const setDrawColorMock = vi.fn();
const setLineWidthMock = vi.fn();
const rectMock = vi.fn();
const roundedRectMock = vi.fn();
const addPageMock = vi.fn();

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(function MockJsPdf(this: any) {
    this.text = textMock;
    this.setFont = setFontMock;
    this.setFontSize = setFontSizeMock;
    this.setFillColor = setFillColorMock;
    this.setDrawColor = setDrawColorMock;
    this.setLineWidth = setLineWidthMock;
    this.setTextColor = vi.fn();
    this.rect = rectMock;
    this.roundedRect = roundedRectMock;
    this.save = saveMock;
    this.addPage = addPageMock;
    this.getTextWidth = vi.fn().mockReturnValue(10);
    this.splitTextToSize = vi.fn((text: string) => [text]);
    this.internal = {
      pageSize: {
        getWidth: () => 841.89,
        getHeight: () => 595.28,
      },
    };
  }),
}));

import jsPDF from "jspdf";
import { exportSquadStatisticsPdf } from "../squadStatsPdfExport";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";

function buildPlayer(overrides: Partial<PlayerStatistics> = {}): PlayerStatistics {
  return {
    teamPlayerId: "tp-1",
    displayName: "Juan Pérez",
    position: "Delantero",
    dorsal: 9,
    goals: 3,
    yellowCards: 1,
    redCards: 0,
    minutesPlayed: 450,
    trainings: { attended: 14, possible: 16, calledButAbsent: 0 },
    friendlies: { attended: 3, possible: 4, calledButAbsent: 0 },
    league: { attended: 10, possible: 12, calledButAbsent: 0 },
    daysSinceLastInjury: null,
    lastInjuryDurationDays: null,
    fatigue: 37,
    readiness: 82,
    readinessBreakdown: null,
    matchesAbsentAttributableToPlayer: 0,
    minutesPlayedPercentOfSeasonTotal: null,
    attributableAbsentMinutesPercentOfSeasonTotal: null,
    ...overrides,
  };
}

describe("squadStatsPdfExport.exportSquadStatisticsPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda el PDF con un nombre de archivo saneado a partir del nombre del equipo", () => {
    exportSquadStatisticsPdf([buildPlayer()], "Alevín A");

    expect(saveMock).toHaveBeenCalledTimes(1);
    const filename = saveMock.mock.calls[0][0] as string;
    expect(filename).toContain("alevin_a");
  });

  it("no lanza excepción cuando teamName es undefined y aun así guarda el PDF", () => {
    expect(() => exportSquadStatisticsPdf([buildPlayer()], undefined)).not.toThrow();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("usa orientación landscape y dibuja una tarjeta por jugador con EF/Rodaje/Cansancio, sin Forma física", () => {
    exportSquadStatisticsPdf([buildPlayer({ fatigue: 37 })], "Alevín A");

    expect(jsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: "landscape" }));
    expect(roundedRectMock).toHaveBeenCalledTimes(1);

    const texts = textMock.mock.calls.map((call) => call[0]);
    expect(texts.some((t) => typeof t === "string" && t.includes("Cansancio 37%"))).toBe(true);
    expect(texts.some((t) => typeof t === "string" && t.includes("Forma física"))).toBe(false);
  });

  it("incluye Ausencias, ratios de Entrenamientos/Amistosos/Liga con su nota, y el objetivo de minutos de temporada", () => {
    exportSquadStatisticsPdf(
      [
        buildPlayer({
          matchesAbsentAttributableToPlayer: 2,
          friendlies: { attended: 0, possible: 2, calledButAbsent: 2 },
          minutesPlayedPercentOfSeasonTotal: 22,
          attributableAbsentMinutesPercentOfSeasonTotal: 8,
        }),
      ],
      "Alevín A",
    );

    const texts = textMock.mock.calls.map((call) => call[0]);
    expect(texts.some((t) => typeof t === "string" && t.includes("Ausencias 2"))).toBe(true);
    expect(texts.some((t) => typeof t === "string" && t.includes("Entrenamientos 14 de 16"))).toBe(true);
    expect(
      texts.some(
        (t) => typeof t === "string" && t.includes("Amistosos 0 de 2") && t.includes("No asistió a 2 partidos a los que fue convocado"),
      ),
    ).toBe(true);
    expect(
      texts.some((t) => typeof t === "string" && t.includes("% minutos jugados: 22%") && t.includes("objetivo mínimo 30%")),
    ).toBe(true);
  });

  it("no dibuja el bloque de objetivo de minutos cuando minutesPlayedPercentOfSeasonTotal es null", () => {
    exportSquadStatisticsPdf([buildPlayer({ minutesPlayedPercentOfSeasonTotal: null })], "Alevín A");

    const texts = textMock.mock.calls.map((call) => call[0]);
    expect(texts.some((t) => typeof t === "string" && t.includes("% minutos jugados:"))).toBe(false);
  });

  it("pagina cuando el contenido supera el alto disponible", () => {
    const manyPlayers = Array.from({ length: 30 }, (_, i) =>
      buildPlayer({ teamPlayerId: `tp-${i}`, displayName: `Jugador ${i}`, dorsal: i }),
    );

    exportSquadStatisticsPdf(manyPlayers, "Alevín A");

    expect(addPageMock).toHaveBeenCalled();
  });
});
