import { describe, expect, it } from "vitest";
import {
  BOOK_STATUS_LABELS,
  booksByPlayer,
  bookTicketCount,
  countByFilter,
  initialFilter,
  playerLotteryFilter,
  searchPlayers,
  suggestNextBook,
  undoEffect,
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
    status: "DeliveredToPlayer",
    deliveredOn: "2026-11-20",
    returnedOn: null,
    amountReturned: null,
    clubDeliveredOn: null,
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

describe("BOOK_STATUS_LABELS", () => {
  it("traduce los cinco estados al español", () => {
    expect(BOOK_STATUS_LABELS).toEqual({
      Unassigned: "Sin asignar",
      Assigned: "Asignado",
      DeliveredToPlayer: "Entregado al jugador",
      ReturnedToCoach: "Devuelto al entrenador",
      DeliveredToClub: "Entregado al club",
    });
  });
});

describe("playerLotteryFilter", () => {
  it("sin tacos es «none»", () => {
    expect(playerLotteryFilter([])).toBe("none");
  });

  it("con varios tacos usa el estado menos avanzado", () => {
    const books = [book({ status: "DeliveredToClub" }), book({ id: "b2", status: "Assigned" })];
    expect(playerLotteryFilter(books)).toBe("Assigned");
  });

  it("con todos los tacos en el club es «DeliveredToClub»", () => {
    expect(playerLotteryFilter([book({ status: "DeliveredToClub" })])).toBe("DeliveredToClub");
  });
});

describe("booksByPlayer", () => {
  it("agrupa por jugador ordenando por número y descarta los tacos sin jugador", () => {
    const grouped = booksByPlayer([
      book({ id: "b2", bookNumber: 2 }),
      book({ id: "b1", bookNumber: 1 }),
      book({ id: "b3", bookNumber: 3, teamPlayerId: null, status: "Unassigned" }),
    ]);
    expect(grouped.get("p7")?.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(grouped.size).toBe(1);
  });
});

describe("countByFilter e initialFilter", () => {
  const books = [
    book({ teamPlayerId: "p7" }),
    book({ id: "b2", teamPlayerId: "p10", status: "ReturnedToCoach", amountReturned: 75 }),
  ];

  it("cuenta jugadores por su estado menos avanzado", () => {
    expect(countByFilter(players, books)).toEqual({
      none: 2,
      Assigned: 0,
      DeliveredToPlayer: 1,
      ReturnedToCoach: 1,
      DeliveredToClub: 0,
    });
  });

  it("empieza en «Sin taco» si queda alguien sin taco", () => {
    expect(initialFilter({ none: 2, Assigned: 0, DeliveredToPlayer: 1, ReturnedToCoach: 1, DeliveredToClub: 0 })).toBe("none");
  });

  it("empieza en el primer estado con jugadores cuando todos tienen taco", () => {
    expect(initialFilter({ none: 0, Assigned: 0, DeliveredToPlayer: 3, ReturnedToCoach: 1, DeliveredToClub: 0 })).toBe(
      "DeliveredToPlayer",
    );
  });

  it("empieza en «Entregado al club» cuando ya está todo en el club", () => {
    expect(initialFilter({ none: 0, Assigned: 0, DeliveredToPlayer: 0, ReturnedToCoach: 0, DeliveredToClub: 4 })).toBe(
      "DeliveredToClub",
    );
  });
});

describe("suggestNextBook", () => {
  it("sin tacos sugiere el taco 1 con el tamaño de la campaña", () => {
    expect(suggestNextBook([], 15)).toEqual({ bookNumber: 1, firstTicketNumber: 1, lastTicketNumber: 15 });
  });

  it("sugiere el siguiente número, la papeleta siguiente a la última y la última según el tamaño", () => {
    const books = [
      book({ bookNumber: 12, firstTicketNumber: 166, lastTicketNumber: 180 }),
      book({ id: "b2", bookNumber: 3, firstTicketNumber: 31, lastTicketNumber: 45 }),
    ];
    expect(suggestNextBook(books, 15)).toEqual({ bookNumber: 13, firstTicketNumber: 181, lastTicketNumber: 195 });
  });
});

describe("bookTicketCount", () => {
  it("cuenta las papeletas del rango del taco", () => {
    expect(bookTicketCount(book({ firstTicketNumber: 31, lastTicketNumber: 40 }))).toBe(10);
  });
});

describe("undoEffect", () => {
  it("indica el dato que se borra y el estado al que vuelve cada paso", () => {
    expect(undoEffect("Assigned")).toEqual({ removed: "el jugador", previous: "Unassigned" });
    expect(undoEffect("DeliveredToPlayer")).toEqual({ removed: "la fecha de entrega", previous: "Assigned" });
    expect(undoEffect("ReturnedToCoach")).toEqual({
      removed: "la fecha y el importe de la devolución",
      previous: "DeliveredToPlayer",
    });
    expect(undoEffect("DeliveredToClub")).toEqual({ removed: "la fecha de entrega al club", previous: "ReturnedToCoach" });
  });

  it("un taco sin asignar no tiene nada que deshacer", () => {
    expect(undoEffect("Unassigned")).toBeNull();
  });
});
