import { describe, expect, it, vi, beforeEach } from "vitest";

const saveMock = vi.fn();
const textMock = vi.fn();
const setFontMock = vi.fn();
const setFontSizeMock = vi.fn();
const setFillColorMock = vi.fn();
const setDrawColorMock = vi.fn();
const setLineWidthMock = vi.fn();
const rectMock = vi.fn();
const lineMock = vi.fn();

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
    this.line = lineMock;
    this.save = saveMock;
    this.addPage = vi.fn();
    this.getTextWidth = vi.fn().mockReturnValue(10);
    this.internal = {
      pageSize: {
        getWidth: () => 595.28,
        getHeight: () => 841.89,
      },
    };
  }),
}));

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
    trainingsAttended: 14,
    matchesPlayed: 10,
    daysSinceLastInjury: null,
    lastInjuryDurationDays: null,
    readiness: 82,
    readinessBreakdown: null,
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
});
