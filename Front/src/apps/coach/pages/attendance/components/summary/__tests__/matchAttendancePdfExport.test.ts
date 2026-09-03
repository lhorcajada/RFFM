import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

let capturedTexts: string[];
let capturedFileNames: string[];
let pageCount: number;

vi.mock("jspdf", () => {
  class FakeJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 595.28,
        getHeight: () => 841.89,
      },
    };
    constructor() {
      pageCount = 1;
    }
    setFont() { return this; }
    setFontSize() { return this; }
    setTextColor() { return this; }
    setFillColor() { return this; }
    setDrawColor() { return this; }
    setLineWidth() { return this; }
    rect() { return this; }
    line() { return this; }
    text(value: string | string[]) {
      const values = Array.isArray(value) ? value : [value];
      capturedTexts.push(...values);
      return this;
    }
    splitTextToSize(value: string) { return [value]; }
    getTextWidth(value: string) { return value.length * 4; }
    addPage() { pageCount++; return this; }
    getNumberOfPages() { return pageCount; }
    setPage() { return this; }
    save(fileName: string) { capturedFileNames.push(fileName); }
  }
  return { default: FakeJsPDF };
});

// import after the mock so the module under test picks up the fake jsPDF
import { exportMatchesSummaryPdf, exportMatchesFullPdf } from "../matchAttendancePdfExport";

const officialColumn: MatchAttendanceColumn = {
  eventId: "event-1",
  label: "J1",
  date: "2026-01-01T10:00:00Z",
  rival: "Rival A",
  isFriendly: false,
};

const friendlyColumn: MatchAttendanceColumn = {
  eventId: "event-2",
  label: "A1",
  date: "2026-01-08T10:00:00Z",
  rival: "Rival B",
  isFriendly: true,
};

function makeRow(overrides: Partial<PlayerMatchSummary> = {}): PlayerMatchSummary {
  return {
    playerId: "tp-1",
    playerName: "Jugador Uno",
    totalMatches: 2,
    calledMatches: 1,
    startedMatches: 1,
    notCalledMatches: 1,
    seasonMinutesPlayed: 245,
    cells: [
      { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
      { eventId: "event-2", state: "notCalled", wasCalled: false, wasStarter: false, minutesPlayed: null },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  capturedTexts = [];
  capturedFileNames = [];
  pageCount = 1;
});

describe("exportMatchesSummaryPdf", () => {
  it("lista los jugadores en el mismo orden en que llegan en rows, no alfabético ni por dorsal", async () => {
    const rows: PlayerMatchSummary[] = [
      makeRow({ playerId: "tp-3", playerName: "Zutano", dorsal: 3 }),
      makeRow({ playerId: "tp-1", playerName: "Alfonso", dorsal: 9 }),
      makeRow({ playerId: "tp-2", playerName: "Benito", dorsal: 1 }),
    ];

    await exportMatchesSummaryPdf(rows, [officialColumn, friendlyColumn]);

    const indices = ["Zutano", "Alfonso", "Benito"].map((name) => capturedTexts.indexOf(name));
    expect(indices[0]).toBeLessThan(indices[1]);
    expect(indices[1]).toBeLessThan(indices[2]);
    indices.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
  });

  it("guarda el PDF con un nombre de archivo que empieza por resumen_partidos", async () => {
    await exportMatchesSummaryPdf([makeRow()], [officialColumn, friendlyColumn]);

    expect(capturedFileNames).toHaveLength(1);
    expect(capturedFileNames[0]).toMatch(/^resumen_partidos/);
  });

  it("la tira de forma solo cuenta partidos ya jugados, no los últimos del calendario completo", async () => {
    // Same bug as the on-screen card: `columns` covers the whole season, including
    // future fixtures. A plain slice(-5) would pull from the tail of the schedule
    // (all future) instead of the most recently played matches.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    try {
      const playedColumn: MatchAttendanceColumn = {
        eventId: "played-1",
        label: "A1",
        date: "2026-09-02T10:00:00Z",
        rival: "Rival jugado",
        isFriendly: true,
      };
      const futureColumns: MatchAttendanceColumn[] = Array.from({ length: 6 }, (_, index) => ({
        eventId: `future-${index}`,
        label: `J${index + 1}`,
        date: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
        rival: `Rival ${index + 1}`,
        isFriendly: false,
      }));
      const row = makeRow({
        totalMatches: 7,
        cells: [
          { eventId: "played-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 5 },
        ],
      });

      await exportMatchesSummaryPdf([row], [playedColumn, ...futureColumns]);

      expect(capturedTexts.filter((t) => t === "T")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("incluye los datos agregados de cada jugador", async () => {
    await exportMatchesSummaryPdf(
      [makeRow({ totalMatches: 7, startedMatches: 4, notCalledMatches: 2, seasonMinutesPlayed: 333 })],
      [officialColumn, friendlyColumn]
    );

    const joined = capturedTexts.join(" | ");
    expect(joined).toMatch(/7/);
    expect(joined).toMatch(/4/);
    expect(joined).toMatch(/2/);
    expect(joined).toMatch(/333/);
  });
});

describe("exportMatchesFullPdf", () => {
  it("incluye jornada, rival, estado y minutos del detalle de cada partido", async () => {
    await exportMatchesFullPdf([makeRow()], [officialColumn, friendlyColumn]);

    expect(capturedTexts.join(" | ")).toContain("J1");
    expect(capturedTexts.join(" | ")).toContain("Rival A");
    expect(capturedTexts).toContain("Titular");
    expect(capturedTexts).toContain("78'");
  });

  it("muestra la etiqueta Amistoso para partidos amistosos y no para partidos oficiales", async () => {
    await exportMatchesFullPdf([makeRow()], [officialColumn, friendlyColumn]);
    expect(capturedTexts).toContain("Amistoso");

    capturedTexts = [];
    await exportMatchesFullPdf([makeRow({ cells: [
      { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
    ] })], [officialColumn]);
    expect(capturedTexts).not.toContain("Amistoso");
  });

  it("incluye todas las jornadas del jugador, no solo las últimas 5", async () => {
    const manyColumns: MatchAttendanceColumn[] = Array.from({ length: 8 }, (_, index) => ({
      eventId: `event-${index}`,
      label: `J${index + 1}`,
      date: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
      rival: `Rival ${index + 1}`,
      isFriendly: false,
    }));
    const row = makeRow({
      totalMatches: 8,
      cells: manyColumns.map((column, index) => ({
        eventId: column.eventId,
        state: "called",
        wasCalled: true,
        wasStarter: false,
        minutesPlayed: (index + 1) * 10,
      })),
    });

    await exportMatchesFullPdf([row], manyColumns);

    for (const column of manyColumns) {
      expect(capturedTexts.join(" | ")).toContain(column.label);
    }
  });

  it("lista los jugadores en el mismo orden en que llegan en rows", async () => {
    const rows: PlayerMatchSummary[] = [
      makeRow({ playerId: "tp-3", playerName: "Zutano", dorsal: 3 }),
      makeRow({ playerId: "tp-1", playerName: "Alfonso", dorsal: 9 }),
      makeRow({ playerId: "tp-2", playerName: "Benito", dorsal: 1 }),
    ];

    await exportMatchesFullPdf(rows, [officialColumn, friendlyColumn]);

    const indices = ["Zutano", "Alfonso", "Benito"].map((name) => capturedTexts.indexOf(name));
    expect(indices[0]).toBeLessThan(indices[1]);
    expect(indices[1]).toBeLessThan(indices[2]);
  });

  it("no incluye partidos futuros (aún no jugados) en el detalle", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    try {
      const playedColumn: MatchAttendanceColumn = {
        eventId: "played-1",
        label: "A1",
        date: "2026-09-02T10:00:00Z",
        rival: "Rival jugado",
        isFriendly: true,
      };
      const futureColumn: MatchAttendanceColumn = {
        eventId: "future-1",
        label: "J1",
        date: "2026-10-01T10:00:00Z",
        rival: "Rival futuro",
        isFriendly: false,
      };
      const row = makeRow({
        totalMatches: 2,
        cells: [
          { eventId: "played-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 5 },
        ],
      });

      await exportMatchesFullPdf([row], [playedColumn, futureColumn]);

      expect(capturedTexts.join(" | ")).toContain("Rival jugado");
      expect(capturedTexts.join(" | ")).not.toContain("Rival futuro");
    } finally {
      vi.useRealTimers();
    }
  });

  it("guarda el PDF con un nombre de archivo que empieza por partidos_completo", async () => {
    await exportMatchesFullPdf([makeRow()], [officialColumn, friendlyColumn]);

    expect(capturedFileNames).toHaveLength(1);
    expect(capturedFileNames[0]).toMatch(/^partidos_completo/);
  });
});
