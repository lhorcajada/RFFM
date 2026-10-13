import { describe, it, expect } from "vitest";
import {
  computeMinutesFromWindows,
  getWindowPeriod,
  rebuildWindows,
  type EditedWindow,
} from "../substitutionWindowEdits";
import type { SubstitutionWindow } from "../../components/simulation/simulation.types";
import type { CardEvent } from "../../components/simulation/liveMatch.types";

const STARTERS = ["p0", "p1", "p2"];

function originalWindows(): SubstitutionWindow[] {
  return [
    {
      windowIndex: 1,
      minute: 30,
      half: 1,
      swaps: [{ inPlayerId: "p3", outPlayerId: "p1", slotIndex: 1 }],
      slotsAfter: { 0: "p0", 1: "p3", 2: "p2" },
    },
    {
      windowIndex: 0,
      minute: 45,
      half: 1,
      isHalftime: true,
      swaps: [{ inPlayerId: "p4", outPlayerId: "p2", slotIndex: 2 }],
      slotsAfter: { 0: "p0", 1: "p3", 2: "p4" },
    },
    {
      windowIndex: 2,
      minute: 70,
      half: 2,
      swaps: [{ inPlayerId: "p1", outPlayerId: "p3", slotIndex: 1 }],
      slotsAfter: { 0: "p0", 1: "p1", 2: "p4" },
    },
  ];
}

function asEdited(windows: SubstitutionWindow[]): EditedWindow[] {
  return windows.map((w, sourceIndex) => ({
    sourceIndex,
    minute: w.minute,
    period: getWindowPeriod(w),
    swaps: w.swaps.map((s) => ({ ...s })),
  }));
}

function redCard(teamPlayerId: string, minute: number): CardEvent {
  return {
    id: `card-${teamPlayerId}-${minute}`,
    minute,
    half: 2,
    cardType: "red",
    teamPlayerId,
    playerName: teamPlayerId,
    isRivalPlayer: false,
    rivalDorsal: null,
  };
}

describe("getWindowPeriod", () => {
  it("distingue descanso, primera y segunda parte", () => {
    const [first, halftime, second] = originalWindows();

    expect([getWindowPeriod(first), getWindowPeriod(halftime), getWindowPeriod(second)]).toEqual([
      "firstHalf",
      "halftime",
      "secondHalf",
    ]);
  });
});

describe("rebuildWindows", () => {
  it("devuelve las ventanas sin cambios cuando no se edita nada", () => {
    const original = originalWindows();

    expect(rebuildWindows(STARTERS, original, asEdited(original))).toEqual(original);
  });

  it("aplica el minuto corregido de una ventana", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[0].minute = 25;

    expect(rebuildWindows(STARTERS, original, edited)[0].minute).toBe(25);
  });

  it("al corregir el jugador que entra actualiza los jugadores en campo tras esa ventana", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[1].swaps[0].inPlayerId = "p5";

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt[1].slotsAfter).toEqual({ 0: "p0", 1: "p3", 2: "p5" });
  });

  it("propaga la corrección de un cambio a las ventanas posteriores", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[1].swaps[0].inPlayerId = "p5";

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt[2].slotsAfter).toEqual({ 0: "p0", 1: "p1", 2: "p5" });
  });

  it("al corregir el jugador que sale mantiene en campo al que salía por error", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[0].swaps[0].outPlayerId = "p2";

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(Object.values(rebuilt[0].slotsAfter).sort()).toEqual(["p0", "p1", "p3"]);
  });

  it("al eliminar una ventana renumera las siguientes", () => {
    const original = originalWindows();
    const edited = asEdited(original).filter((w) => w.sourceIndex !== 0);

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt.map((w) => w.windowIndex)).toEqual([0, 1]);
  });

  it("al eliminar una ventana deshace su cambio en las ventanas posteriores", () => {
    const original = originalWindows();
    const edited = asEdited(original).filter((w) => w.sourceIndex !== 1);

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt[1].slotsAfter).toEqual({ 0: "p0", 1: "p1", 2: "p2" });
  });

  it("descarta una ventana que se queda sin cambios", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[0].swaps = [];

    expect(rebuildWindows(STARTERS, original, edited)).toHaveLength(2);
  });

  it("al pasar una ventana a descanso deja de contar como ventana numerada", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[0].period = "halftime";

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt.map((w) => ({ index: w.windowIndex, isHalftime: w.isHalftime === true, half: w.half }))).toEqual([
      { index: 0, isHalftime: true, half: 1 },
      { index: 0, isHalftime: true, half: 1 },
      { index: 1, isHalftime: false, half: 2 },
    ]);
  });

  it("al pasar el descanso a segunda parte cuenta como ventana numerada", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[1].period = "secondHalf";
    edited[1].minute = 50;

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt.map((w) => ({ index: w.windowIndex, half: w.half, isHalftime: w.isHalftime }))).toEqual([
      { index: 1, half: 1, isHalftime: undefined },
      { index: 2, half: 2, isHalftime: undefined },
      { index: 3, half: 2, isHalftime: undefined },
    ]);
  });

  it("reordena las ventanas por minuto cuando la corrección cambia el orden", () => {
    const original = originalWindows();
    const edited = asEdited(original);
    edited[2].minute = 20;
    edited[2].period = "firstHalf";

    const rebuilt = rebuildWindows(STARTERS, original, edited);

    expect(rebuilt.map((w) => w.minute)).toEqual([20, 30, 45]);
  });
});

describe("computeMinutesFromWindows", () => {
  it("reparte los minutos según titulares, cambios y duración", () => {
    const minutes = computeMinutesFromWindows(STARTERS, originalWindows(), 90, []);

    expect(minutes).toEqual({ p0: 90, p1: 50, p2: 45, p3: 40, p4: 45 });
  });

  it("corta los minutos del jugador expulsado en el minuto de la tarjeta", () => {
    const minutes = computeMinutesFromWindows(STARTERS, originalWindows(), 90, [redCard("p4", 60)]);

    expect(minutes.p4).toBe(15);
  });

  it("cuenta la expulsión por doble amarilla desde la segunda tarjeta", () => {
    const yellow = (minute: number): CardEvent => ({ ...redCard("p0", minute), cardType: "yellow" });

    const minutes = computeMinutesFromWindows(STARTERS, originalWindows(), 90, [yellow(10), yellow(80)]);

    expect(minutes.p0).toBe(80);
  });
});
