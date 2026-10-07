import { describe, expect, it } from "vitest";
import {
  countByStatus,
  initialStatusFilter,
  playerLotteryStatus,
  searchPlayers,
  suggestNextBook,
} from "../lotteryHelpers";
import type { LotteryBook } from "../../../services/lotteryService";

type Player = { id: string; name: string; lastName?: string | null; alias: string; dorsal?: number | null };

const players: Player[] = [
  { id: "p10", name: "Hugo", lastName: "Martín López", alias: "Hugo", dorsal: 10 },
  { id: "p7", name: "Pablo", lastName: "García Ruiz", alias: "Pablito", dorsal: 7 },
  { id: "p17", name: "Leo", lastName: "Sánchez", alias: "El 7", dorsal: 17 },
  { id: "pnd", name: "Álvaro", lastName: "Gómez", alias: "Garci", dorsal: null },
];

function book(overrides: Partial<LotteryBook>): LotteryBook {
  return {
    id: "b",
    teamPlayerId: "p7",
    bookNumber: 1,
    firstTicketNumber: 1,
    lastTicketNumber: 15,
    deliveredOn: "2026-11-20",
    returnedOn: null,
    amountReturned: null,
    ticketsSold: null,
    ticketsUnsold: null,
    ...overrides,
  };
}

describe("searchPlayers", () => {
  it("sin búsqueda ordena por dorsal y deja al final a quien no tiene dorsal", () => {
    expect(searchPlayers(players, "").map((p) => p.id)).toEqual(["p7", "p10", "p17", "pnd"]);
  });

  it("pone primero el dorsal exacto y después las coincidencias por alias", () => {
    expect(searchPlayers(players, "7").map((p) => p.id)).toEqual(["p7", "p17"]);
  });

  it("prioriza el alias sobre el nombre y apellidos", () => {
    expect(searchPlayers(players, "garci").map((p) => p.id)).toEqual(["pnd", "p7"]);
  });

  it("busca por apellido sin distinguir mayúsculas ni acentos", () => {
    expect(searchPlayers(players, "SANCHEZ").map((p) => p.id)).toEqual(["p17"]);
  });

  it("busca por nombre con acento escribiéndolo sin él", () => {
    expect(searchPlayers(players, "alva").map((p) => p.id)).toEqual(["pnd"]);
  });

  it("busca por inicio de palabra, no por subcadena", () => {
    expect(searchPlayers(players, "artin")).toEqual([]);
  });
});

describe("playerLotteryStatus", () => {
  it("sin tacos es «none»", () => {
    expect(playerLotteryStatus([])).toBe("none");
  });

  it("con algún taco sin devolver es «pending»", () => {
    expect(playerLotteryStatus([book({ amountReturned: 75 }), book({ id: "b2", amountReturned: null })])).toBe("pending");
  });

  it("con todos los tacos devueltos es «returned»", () => {
    expect(playerLotteryStatus([book({ amountReturned: 0 })])).toBe("returned");
  });
});

describe("countByStatus e initialStatusFilter", () => {
  const books = [book({ teamPlayerId: "p7" }), book({ id: "b2", teamPlayerId: "p10", amountReturned: 75 })];

  it("cuenta jugadores por estado", () => {
    expect(countByStatus(players, books)).toEqual({ none: 2, pending: 1, returned: 1 });
  });

  it("empieza en «Sin taco» si queda alguien sin taco", () => {
    expect(initialStatusFilter({ none: 2, pending: 1, returned: 1 })).toBe("none");
  });

  it("empieza en «Por devolver» cuando todos tienen taco", () => {
    expect(initialStatusFilter({ none: 0, pending: 3, returned: 1 })).toBe("pending");
  });

  it("empieza en «Devueltos» cuando ya está todo devuelto", () => {
    expect(initialStatusFilter({ none: 0, pending: 0, returned: 4 })).toBe("returned");
  });
});

describe("suggestNextBook", () => {
  it("sin tacos sugiere el taco 1 desde la papeleta 1", () => {
    expect(suggestNextBook([])).toEqual({ bookNumber: 1, firstTicketNumber: 1 });
  });

  it("sugiere el siguiente número y la papeleta siguiente a la última entregada", () => {
    const books = [
      book({ bookNumber: 12, firstTicketNumber: 166, lastTicketNumber: 180 }),
      book({ id: "b2", bookNumber: 3, firstTicketNumber: 31, lastTicketNumber: 45 }),
    ];
    expect(suggestNextBook(books)).toEqual({ bookNumber: 13, firstTicketNumber: 181 });
  });
});
