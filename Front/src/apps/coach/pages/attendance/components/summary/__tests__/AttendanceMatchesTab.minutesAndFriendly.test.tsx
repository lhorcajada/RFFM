import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceMatchesTab from "../AttendanceMatchesTab";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "../types";

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
    technicalDecisionMatches: 1,
    unavailableMatches: 0,
    injuryMatches: 0,
    illnessMatches: 0,
    seasonMinutesPlayed: 245,
    cells: [
      { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
      { eventId: "event-2", state: "technicalDecision", wasCalled: false, wasStarter: false, minutesPlayed: null },
    ],
    ...overrides,
  };
}

async function expandCard(playerName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: new RegExp(playerName, "i") }));
}

describe("AttendanceMatchesTab — minutos y amistosos", () => {
  it("muestra los minutos jugados en la fila de detalle de un jugador titular", async () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow()]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    await expandCard("Jugador Uno");

    expect(screen.getByText("78'")).toBeInTheDocument();
  });

  it("muestra 0' cuando el jugador fue convocado pero no jugó minutos", async () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "called", wasCalled: true, wasStarter: false, minutesPlayed: 0 },
        { eventId: "event-2", state: "technicalDecision", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    await expandCard("Jugador Uno");

    expect(screen.getByText("0'")).toBeInTheDocument();
  });

  it("no muestra minutos para un jugador no convocado", async () => {
    render(
      <AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />
    );

    await expandCard("Jugador Uno");

    expect(screen.queryByText("null'")).not.toBeInTheDocument();
    // Only the starter's detail row shows minutes; the notCalled one shows none.
    expect(screen.getAllByText(/^\d+'$/)).toHaveLength(1);
  });

  it("muestra un chip con los minutos totales de temporada del jugador", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText(/245/)).toBeInTheDocument();
  });

  it("muestra 0 min temporada cuando el total de minutos no llega calculado", () => {
    const row = makeRow({ seasonMinutesPlayed: undefined as unknown as number });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("0 min temporada")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it("muestra la etiqueta Amistoso junto al partido amistoso en el detalle expandido", async () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    await expandCard("Jugador Uno");

    expect(screen.getByText("Amistoso")).toBeInTheDocument();
  });

  it("no muestra la etiqueta Amistoso cuando todos los partidos son oficiales", async () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn]} />);

    await expandCard("Jugador Uno");

    expect(screen.queryByText("Amistoso")).not.toBeInTheDocument();
  });

  it("no muestra el texto descriptivo de la barra de herramientas (redundante con los chips de recuento)", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.queryByText(/se muestran los partidos/i)).not.toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — recuento de jornadas y amistosos por separado", () => {
  it("cuenta las jornadas de liga y los amistosos en chips independientes", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("1 jornadas")).toBeInTheDocument();
    expect(screen.getByText("1 amistosos")).toBeInTheDocument();
  });

  it("no muestra el chip de amistosos cuando no hay ninguno", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn]} />);

    expect(screen.getByText("1 jornadas")).toBeInTheDocument();
    expect(screen.queryByText(/amistosos/i, { selector: ".MuiChip-label" })).not.toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — resumen de tarjeta colapsada", () => {
  it("muestra los chips agregados sin necesidad de expandir la tarjeta", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("2 partidos")).toBeInTheDocument();
    expect(screen.getByText("1 tit.")).toBeInTheDocument();
    expect(screen.getByText("1 técnica")).toBeInTheDocument();
    expect(screen.getByText("245 min temporada")).toBeInTheDocument();
  });

  it("no muestra chips de motivo de desconvocatoria cuando su contador es 0", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.queryByText(/^\d+ no disp\.$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ lesión$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ enferm\.$/)).not.toBeInTheDocument();
  });

  it("muestra un chip por cada motivo de desconvocatoria con contador > 0", () => {
    const row = makeRow({
      technicalDecisionMatches: 1,
      unavailableMatches: 2,
      injuryMatches: 1,
      illnessMatches: 3,
    });
    render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText("1 técnica")).toBeInTheDocument();
    expect(screen.getByText("2 no disp.")).toBeInTheDocument();
    expect(screen.getByText("1 lesión")).toBeInTheDocument();
    expect(screen.getByText("3 enferm.")).toBeInTheDocument();
  });

  it("muestra una tira de forma con un indicador por cada jornada, sin expandir la tarjeta", () => {
    const { container } = render(
      <AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />
    );

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    expect(summary).toBeInTheDocument();
    const formStripBadges = summary.querySelectorAll(
      '[class*="matchCellStarter"], [class*="matchCellCalled"], [class*="matchCellTechnicalDecision"], [class*="matchCellAbsent"]'
    );
    expect(formStripBadges).toHaveLength(2);
  });

  it("limita la tira de forma a los últimos 5 partidos cuando hay más jornadas", () => {
    const manyColumns: MatchAttendanceColumn[] = Array.from({ length: 8 }, (_, index) => ({
      eventId: `event-${index}`,
      label: `J${index + 1}`,
      date: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
      rival: `Rival ${index + 1}`,
      isFriendly: false,
    }));
    const row = makeRow({
      totalMatches: 8,
      // Distinct minutes per column so each badge's title is unique and we can
      // tell which columns survived the last-5 cut.
      cells: manyColumns.map((column, index) => ({
        eventId: column.eventId,
        state: "called",
        wasCalled: true,
        wasStarter: false,
        minutesPlayed: (index + 1) * 10,
      })),
    });

    const { container } = render(<AttendanceMatchesTab rows={[row]} columns={manyColumns} />);

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    const formStripBadges = summary.querySelectorAll('[class*="matchCellCalled"]');
    expect(formStripBadges).toHaveLength(5);
    expect(screen.getByText(/últimos 5/i)).toBeInTheDocument();

    // The most recent 5 (J4..J8, minutes 40'..80') are kept, not the earliest 5 (J1..J3, 10'..30').
    const titles = Array.from(formStripBadges).map((badge) => badge.getAttribute("title"));
    expect(titles).toEqual([
      "Convocado (40')",
      "Convocado (50')",
      "Convocado (60')",
      "Convocado (70')",
      "Convocado (80')",
    ]);
  });

  describe("con partidos futuros programados en el calendario", () => {
    beforeEach(() => {
      // A season with 29 scheduled matches (26 liga + 3 amistosos) where only
      // the very first one has actually been played — mirrors early-season data.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("la tira de forma solo cuenta partidos ya jugados, no descarta el único jugado por partidos futuros", () => {
      const playedColumn: MatchAttendanceColumn = {
        eventId: "played-1",
        label: "A1",
        date: "2026-09-02T10:00:00Z", // in the past relative to the mocked "now"
        rival: "Rival jugado",
        isFriendly: true,
      };
      const futureColumns: MatchAttendanceColumn[] = Array.from({ length: 28 }, (_, index) => ({
        eventId: `future-${index}`,
        label: `J${index + 1}`,
        date: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T10:00:00Z`, // in the future
        rival: `Rival ${index + 1}`,
        isFriendly: false,
      }));
      const columns = [playedColumn, ...futureColumns];
      const row = makeRow({
        totalMatches: columns.length,
        cells: [
          { eventId: "played-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 5 },
        ],
      });

      const { container } = render(<AttendanceMatchesTab rows={[row]} columns={columns} />);

      const summary = container.querySelector('[role="button"]') as HTMLElement;
      const formStripBadges = summary.querySelectorAll(
        '[class*="matchCellStarter"], [class*="matchCellCalled"], [class*="matchCellTechnicalDecision"], [class*="matchCellAbsent"]'
      );
      // Only one match has actually been played — the strip should show just that one,
      // not five badges pulled from the end of the full (mostly-future) schedule.
      expect(formStripBadges).toHaveLength(1);
      expect(formStripBadges[0].getAttribute("title")).toBe("Titular (5')");
    });
  });
});

describe("AttendanceMatchesTab — foto y dorsal", () => {
  it("muestra la foto del jugador cuando hay photoUrl", () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow({ photoUrl: "blob:mock-photo-1" })]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    expect(screen.getByAltText("Jugador Uno")).toHaveAttribute("src", "blob:mock-photo-1");
  });

  it("muestra las iniciales del jugador cuando no hay photoUrl", () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow({ photoUrl: null, playerName: "Jugador Uno" })]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    expect(screen.queryByAltText("Jugador Uno")).not.toBeInTheDocument();
    expect(screen.getByText("JU")).toBeInTheDocument();
  });

  it("muestra el dorsal del jugador en la insignia de camiseta cuando está disponible", () => {
    render(
      <AttendanceMatchesTab rows={[makeRow({ dorsal: 7 })]} columns={[officialColumn, friendlyColumn]} />
    );

    expect(screen.getByTitle("Dorsal 7")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("muestra la camiseta de un jugador de campo en azul", () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow({ dorsal: 7, position: "Defensa" })]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    const jersey = screen.getByTitle("Dorsal 7").querySelector("svg");
    expect(jersey?.getAttribute("class")).not.toMatch(/matchDorsalJerseyKeeper/);
  });

  it("muestra la camiseta de un portero en rojo", () => {
    render(
      <AttendanceMatchesTab
        rows={[makeRow({ dorsal: 1, position: "Portero" })]}
        columns={[officialColumn, friendlyColumn]}
      />
    );

    const jersey = screen.getByTitle("Dorsal 1").querySelector("svg");
    expect(jersey?.getAttribute("class")).toMatch(/matchDorsalJerseyKeeper/);
  });

  it("no muestra ninguna insignia de dorsal cuando no está disponible", () => {
    render(
      <AttendanceMatchesTab rows={[makeRow({ dorsal: null })]} columns={[officialColumn, friendlyColumn]} />
    );

    expect(screen.queryByTitle(/^Dorsal/)).not.toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — estado vacío", () => {
  it("muestra el estado vacío cuando no hay columnas", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[]} />);

    expect(screen.getByText("Sin datos de partidos")).toBeInTheDocument();
    expect(
      screen.getByText("No hay partidos con convocatorias para mostrar en este resumen.")
    ).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay jugadores", () => {
    render(<AttendanceMatchesTab rows={[]} columns={[officialColumn]} />);

    expect(screen.getByText("Sin datos de partidos")).toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — sin scroll horizontal", () => {
  it("no renderiza ninguna tabla ni contenedor con scroll horizontal, incluso con muchas jornadas", () => {
    const manyColumns: MatchAttendanceColumn[] = Array.from({ length: 9 }, (_, index) => ({
      eventId: `event-${index}`,
      label: `J${index + 1}`,
      date: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
      rival: `Rival ${index + 1}`,
      isFriendly: false,
    }));
    const row = makeRow({
      totalMatches: 9,
      cells: manyColumns.map((column, index) => ({
        eventId: column.eventId,
        state: index % 2 === 0 ? "starter" : "called",
        wasCalled: true,
        wasStarter: index % 2 === 0,
        minutesPlayed: 60,
      })),
    });

    const { container } = render(<AttendanceMatchesTab rows={[row]} columns={manyColumns} />);

    expect(container.querySelectorAll("table")).toHaveLength(0);
  });
});

describe("AttendanceMatchesTab — nuevos estados de desconvocatoria (letras)", () => {
  it("muestra la letra ND en la tira compacta para un jugador no disponible", () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
        { eventId: "event-2", state: "unavailable", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    const { container } = render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    expect(within(summary).getByText("ND")).toBeInTheDocument();
  });

  it("muestra la letra L en la tira compacta para un jugador lesionado", () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
        { eventId: "event-2", state: "injury", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    const { container } = render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    expect(within(summary).getByText("L")).toBeInTheDocument();
  });

  it("muestra la letra E en la tira compacta para un jugador enfermo", () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
        { eventId: "event-2", state: "illness", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    const { container } = render(<AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />);

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    expect(within(summary).getByText("E")).toBeInTheDocument();
  });

  it("muestra la letra D en la tira compacta para una decisión técnica (comportamiento previo)", () => {
    const { container } = render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    const summary = container.querySelector('[role="button"]') as HTMLElement;
    expect(within(summary).getByText("D")).toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — badge del detalle expandido", () => {
  it("muestra la letra y el texto completo juntos en la fila de detalle de un jugador titular", async () => {
    const { container } = render(
      <AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />
    );

    await expandCard("Jugador Uno");

    const detailList = container.querySelector('[class*="matchDetailList"]') as HTMLElement;
    expect(within(detailList).getByText("T")).toBeInTheDocument();
    expect(within(detailList).getByText("Titular")).toBeInTheDocument();
  });

  it("muestra el texto completo del motivo de desconvocatoria en el detalle expandido", async () => {
    const row = makeRow({
      cells: [
        { eventId: "event-1", state: "starter", wasCalled: true, wasStarter: true, minutesPlayed: 78 },
        { eventId: "event-2", state: "injury", wasCalled: false, wasStarter: false, minutesPlayed: null },
      ],
    });
    const { container } = render(
      <AttendanceMatchesTab rows={[row]} columns={[officialColumn, friendlyColumn]} />
    );

    await expandCard("Jugador Uno");

    const detailList = container.querySelector('[class*="matchDetailList"]') as HTMLElement;
    expect(within(detailList).getByText("L")).toBeInTheDocument();
    expect(within(detailList).getByText("Lesión")).toBeInTheDocument();
  });
});

describe("AttendanceMatchesTab — leyenda de estados", () => {
  it("muestra una leyenda visible con las 6 letras y su significado", () => {
    render(<AttendanceMatchesTab rows={[makeRow()]} columns={[officialColumn, friendlyColumn]} />);

    expect(screen.getByText(/T\s*(·|=)\s*Titular/)).toBeInTheDocument();
    expect(screen.getByText(/C\s*(·|=)\s*Convocado/)).toBeInTheDocument();
    expect(screen.getByText(/D\s*(·|=)\s*Decisión técnica/)).toBeInTheDocument();
    expect(screen.getByText(/ND\s*(·|=)\s*No disponible/)).toBeInTheDocument();
    expect(screen.getByText(/L\s*(·|=)\s*Lesión/)).toBeInTheDocument();
    expect(screen.getByText(/E\s*(·|=)\s*Enfermedad/)).toBeInTheDocument();
  });
});
