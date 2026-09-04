import { describe, expect, it } from "vitest";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { ClubKit } from "../../../../services/kitService";
import type { TeamNote } from "../../../../services/teamNoteService";
import type { MatchState } from "../../components/convocationMatchDetail.types";
import {
  buildConvocationSummary,
  buildWhatsAppText,
  sortByDorsalAsc,
} from "../convocationSummary";

function makeMatch(overrides: Partial<MatchState> = {}): MatchState {
  return {
    date: "2026-09-06",
    time: "17:00",
    localTeamName: "CD Rivas",
    localTeamShield: "",
    visitorTeamName: "CF Getafe",
    visitorTeamShield: "",
    isFinished: false,
    isHomeTeam: true,
    field: "Campo Municipal",
    codacta: null,
    selectedKitNumber: 1,
    locationMapUrl: null,
    ...overrides,
  };
}

function player(overrides: Partial<PlayerResponse> = {}): PlayerResponse {
  return {
    id: "p1",
    name: "Jugador",
    lastName: "Uno",
    alias: "",
    dorsal: null,
    position: null,
    ...overrides,
  };
}

const kits: ClubKit[] = [
  { kitNumber: 1, shirtColor: "#E53935", shortsColor: "#FFFFFF", socksColor: "#FFFFFF" },
  { kitNumber: 2, shirtColor: "#1E88E5", shortsColor: "#1E88E5", socksColor: "#1E88E5" },
];

describe("sortByDorsalAsc", () => {
  it("ordena por dorsal ascendente dejando al final a los jugadores sin dorsal", () => {
    const players = [
      player({ id: "a", dorsal: 10 }),
      player({ id: "b", dorsal: null }),
      player({ id: "c", dorsal: 1 }),
      player({ id: "d", dorsal: 4 }),
    ];

    const sorted = sortByDorsalAsc(players).map((p) => p.id);

    expect(sorted).toEqual(["c", "d", "a", "b"]);
  });
});

describe("buildConvocationSummary — convocados sin agrupar por posición", () => {
  it("devuelve calledPlayers ordenados por dorsal, no agrupados por posición", () => {
    const players = [
      player({ id: "p1", dorsal: 9, position: "Delantero" }),
      player({ id: "p2", dorsal: 1, position: "Portero" }),
      player({ id: "p3", dorsal: null, position: "Defensa" }),
    ];

    const summary = buildConvocationSummary({
      match: makeMatch(),
      calledIds: ["p1", "p2", "p3"],
      notCalledIds: [],
      players,
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });

    expect(summary.calledPlayers.map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
    expect(summary).not.toHaveProperty("sortedGroups");
  });
});

describe("buildWhatsAppText — ubicación", () => {
  it("usa locationMapUrl como enlace cuando está presente", () => {
    const match = makeMatch({ locationMapUrl: "https://maps.example.com/campo" });
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);

    expect(text).toContain("📍 Campo: Campo Municipal");
    expect(text).toContain("https://maps.example.com/campo");
    expect(text).not.toContain("https://maps.google.com/?q=");
  });

  it("cae al enlace de búsqueda de Google Maps cuando no hay locationMapUrl", () => {
    const match = makeMatch({ locationMapUrl: null });
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);

    expect(text).toContain(`https://maps.google.com/?q=${encodeURIComponent("Campo Municipal")}`);
  });
});

describe("buildWhatsAppText — equipación seleccionada, sin avisos fijos", () => {
  it("indica la equipación seleccionada sin incluir texto fijo hardcodeado", () => {
    const match = makeMatch();
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits,
      selectedKitNumber: 1,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);

    expect(text).toContain("Se juega con: 1ª Equipación");
    expect(text).not.toMatch(/traed las dos equipaciones/i);
    expect(text).not.toMatch(/espinilleras obligatorias/i);
    expect(text).not.toMatch(/no podrá jugar el partido/i);
    expect(text).not.toMatch(/porteros:.*traed/i);
  });
});

describe("buildWhatsAppText — colores reales de las equipaciones", () => {
  it("incluye el nombre de color de la equipación seleccionada y de la alternativa", () => {
    const match = makeMatch();
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits,
      selectedKitNumber: 1,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);

    // Kit 1 (seleccionada): camiseta Rojo, pantalón Blanco
    expect(text).toMatch(/1ª Equipación.*Rojo.*Blanco/is);
    // Kit 2 (alternativa): camiseta Azul, pantalón Azul
    expect(text).toMatch(/2ª Equipación.*Azul.*Azul/is);
    expect(text).toMatch(/traed también/i);
  });
});

describe("buildWhatsAppText — notas del equipo", () => {
  it("incluye las notas del equipo como lista, en el orden recibido", () => {
    const match = makeMatch();
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });
    const notes = [
      { id: "n1", teamId: "team-1", text: "Traed las dos equipaciones", order: 0 },
      { id: "n2", teamId: "team-1", text: "Espinilleras obligatorias", order: 1 },
    ];

    const text = buildWhatsAppText(match, summary, {}, [], notes);

    const idx1 = text.indexOf("Traed las dos equipaciones");
    const idx2 = text.indexOf("Espinilleras obligatorias");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx1).toBeLessThan(idx2);
  });

  it("no añade sección de notas cuando no hay ninguna", () => {
    const match = makeMatch();
    const summary = buildConvocationSummary({
      match,
      calledIds: [],
      notCalledIds: [],
      players: [],
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);

    expect(text).not.toMatch(/notas/i);
  });
});

describe("buildWhatsAppText — lista de convocados", () => {
  it("lista a los convocados ordenados por dorsal, sin encabezados de posición", () => {
    const match = makeMatch();
    const players = [
      player({ id: "p1", dorsal: 9, position: "Delantero" }),
      player({ id: "p2", dorsal: 1, position: "Portero" }),
    ];
    const summary = buildConvocationSummary({
      match,
      calledIds: ["p1", "p2"],
      notCalledIds: [],
      players,
      excuseMap: {},
      kits: [],
      selectedKitNumber: null,
    });

    const text = buildWhatsAppText(match, summary, {}, [], []);
    const p1Index = text.indexOf("Jugador Uno (Nº 9)");
    const p2Index = text.indexOf("Jugador Uno (Nº 1)");

    expect(p2Index).toBeGreaterThan(-1);
    expect(p1Index).toBeGreaterThan(-1);
    expect(p2Index).toBeLessThan(p1Index);
    expect(text).not.toMatch(/porteros|defensas|delanteros|medios/i);
  });
});
