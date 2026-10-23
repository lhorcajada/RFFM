import { describe, expect, it } from "vitest";
import { buildPendingSanctionsMessage } from "../pendingSanctionsMessage";
import type { SanctionRecord } from "../../../../services/teamplayerSanctionService";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { SportEventResponse } from "../../../../services/sportEventService";

function player(id: string, name: string, lastName: string): PlayerResponse {
  return { id, name, lastName, alias: name.toLowerCase() } as PlayerResponse;
}

function sanction(overrides: Partial<SanctionRecord>): SanctionRecord {
  return {
    id: "s",
    startDate: "2026-10-01",
    sanctionType: "Sanción",
    description: null,
    estimatedEnd: null,
    endDate: null,
    isAutomatic: false,
    fine: null,
    ...overrides,
  };
}

const juan = player("p1", "Juan", "Pérez");
const luis = player("p2", "Luis", "Gómez");
const date = new Date("2026-10-23T10:00:00");

describe("buildPendingSanctionsMessage", () => {
  it("agrupa las sanciones pendientes por jugador y muestra el total pendiente", () => {
    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [
        { player: juan, sanction: sanction({ id: "s1", sanctionType: "Expulsión", fine: 10, amountPaid: 0, pendingAmount: 10, status: "Fulfilled" }) },
        { player: luis, sanction: sanction({ id: "s2", sanctionType: "Falta a entreno", fine: 5, pendingAmount: 5, status: "Fulfilled" }) },
      ],
      events: [],
    });

    expect(message).toBe(
      [
        "*Sanciones pendientes – Infantil A*",
        "_23/10/2026_",
        "",
        "*Juan Pérez*",
        "• Expulsión – 10,00 € pendientes",
        "",
        "*Luis Gómez*",
        "• Falta a entreno – 5,00 € pendientes",
        "",
        "*Total pendiente: 15,00 €*",
      ].join("\n")
    );
  });

  it("excluye las sanciones cumplidas y totalmente pagadas", () => {
    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [
        { player: juan, sanction: sanction({ sanctionType: "Pagada", fine: 10, amountPaid: 10, pendingAmount: 0, status: "Fulfilled" }) },
        { player: luis, sanction: sanction({ sanctionType: "Retraso", fine: 3, pendingAmount: 3, status: "Fulfilled" }) },
      ],
      events: [],
    });

    expect(message).not.toContain("Juan Pérez");
  });

  it("describe la desconvocatoria pendiente con el rival y la fecha del partido", () => {
    const events = [
      { id: "ev1", title: "Liga", rivalName: "CD Rival", eveDateTime: "2026-10-25T11:00:00" } as SportEventResponse,
    ];

    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [
        { player: juan, sanction: sanction({ sanctionType: "Retraso", sportivePunishmentType: "Deconvocation", targetEventId: "ev1", status: "Pending" }) },
      ],
      events,
    });

    expect(message).toContain("• Retraso – desconvocado vs CD Rival (25/10)");
  });

  it("describe el límite de minutos pendiente", () => {
    const events = [
      { id: "ev1", title: "Liga", rivalName: "CD Rival", eveDateTime: "2026-10-25T11:00:00" } as SportEventResponse,
    ];

    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [
        { player: juan, sanction: sanction({ sanctionType: "Actitud", sportivePunishmentType: "MinutesLimit", minutesLimit: 30, targetEventId: "ev1", status: "Pending" }) },
      ],
      events,
    });

    expect(message).toContain("• Actitud – máx. 30' vs CD Rival (25/10)");
  });

  it("no muestra el total cuando no hay importes pendientes", () => {
    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [{ player: juan, sanction: sanction({ sanctionType: "Expulsión", status: "Pending" }) }],
      events: [],
    });

    expect(message).not.toContain("Total pendiente");
  });

  it("indica que no hay sanciones pendientes cuando no queda ninguna", () => {
    const message = buildPendingSanctionsMessage({ teamName: "Infantil A", date, rows: [], events: [] });

    expect(message).toContain("No hay sanciones pendientes.");
  });

  it("ordena los jugadores alfabéticamente", () => {
    const message = buildPendingSanctionsMessage({
      teamName: "Infantil A",
      date,
      rows: [
        { player: juan, sanction: sanction({ sanctionType: "A", status: "Pending" }) },
        { player: luis, sanction: sanction({ sanctionType: "B", status: "Pending" }) },
      ],
      events: [],
    });

    expect(message.indexOf("*Juan Pérez*")).toBeLessThan(message.indexOf("*Luis Gómez*"));
  });
});
