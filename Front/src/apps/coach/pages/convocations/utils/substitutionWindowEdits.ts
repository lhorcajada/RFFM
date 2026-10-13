import type { CardEvent } from "../components/simulation/liveMatch.types";
import type { SubstitutionSwap, SubstitutionWindow } from "../components/simulation/simulation.types";
import { getExpelledIds } from "./expulsions";

export type WindowPeriod = "firstHalf" | "halftime" | "secondHalf";

/** A substitution window as corrected by the coach, still linked to the window it comes from */
export interface EditedWindow {
  /** Index of the original window this correction comes from */
  sourceIndex: number;
  minute: number;
  period: WindowPeriod;
  swaps: SubstitutionSwap[];
}

const PERIOD_ORDER: Record<WindowPeriod, number> = { firstHalf: 0, halftime: 1, secondHalf: 2 };

export function getWindowPeriod(window: Pick<SubstitutionWindow, "half" | "isHalftime">): WindowPeriod {
  if (window.isHalftime) return "halftime";
  return window.half === 2 ? "secondHalf" : "firstHalf";
}

/** Players on the field right after each window, replaying the swaps from the starting lineup */
function onFieldAfterEachWindow(starterIds: string[], windows: { swaps: SubstitutionSwap[] }[]): Set<string>[] {
  const onField = new Set(starterIds);
  return windows.map((window) => {
    for (const swap of window.swaps) {
      if (swap.outPlayerId) onField.delete(swap.outPlayerId);
      onField.add(swap.inPlayerId);
    }
    return new Set(onField);
  });
}

/** Moves the original slot map to the corrected set of on-field players, keeping everyone else in place */
function correctSlots(
  slots: Record<number, string | null>,
  removed: string[],
  added: string[],
): Record<number, string | null> {
  const corrected = { ...slots };
  const freedSlots: number[] = [];
  for (const [slotIndex, playerId] of Object.entries(slots)) {
    if (playerId && removed.includes(playerId)) {
      corrected[Number(slotIndex)] = null;
      freedSlots.push(Number(slotIndex));
    }
  }
  const emptySlots = Object.keys(corrected)
    .map(Number)
    .filter((slotIndex) => corrected[slotIndex] === null && !freedSlots.includes(slotIndex));
  const availableSlots = [...freedSlots, ...emptySlots];
  let nextNewSlot = Math.max(-1, ...Object.keys(corrected).map(Number)) + 1;
  for (const playerId of added) {
    const slotIndex = availableSlots.shift() ?? nextNewSlot++;
    corrected[slotIndex] = playerId;
  }
  return corrected;
}

/**
 * Turns the coach's corrections into consistent substitution windows: drops the windows left
 * without swaps, orders them chronologically, renumbers them and rebuilds who is on the field
 * after each one.
 */
export function rebuildWindows(
  starterIds: string[],
  original: SubstitutionWindow[],
  edited: EditedWindow[],
): SubstitutionWindow[] {
  const kept = edited
    .filter((window) => window.swaps.length > 0)
    .map((window, order) => ({ window, order }))
    .sort(
      (a, b) =>
        PERIOD_ORDER[a.window.period] - PERIOD_ORDER[b.window.period] ||
        a.window.minute - b.window.minute ||
        a.order - b.order,
    )
    .map(({ window }) => window);

  const originalOnField = onFieldAfterEachWindow(starterIds, original);
  const correctedOnField = onFieldAfterEachWindow(starterIds, kept);

  let numberedWindows = 0;
  return kept.map((window, i) => {
    const source = original[window.sourceIndex];
    const isHalftime = window.period === "halftime";
    const fillsEmptySlot = !isHalftime && window.swaps.every((swap) => swap.outPlayerId === null);
    const countsTowardQuota = !isHalftime && !fillsEmptySlot;
    if (countsTowardQuota) numberedWindows += 1;

    const before = originalOnField[window.sourceIndex];
    const after = correctedOnField[i];
    const removed = [...before].filter((playerId) => !after.has(playerId));
    const added = [...after].filter((playerId) => !before.has(playerId));

    return {
      windowIndex: isHalftime ? 0 : numberedWindows,
      minute: window.minute,
      half: window.period === "secondHalf" ? 2 : 1,
      swaps: window.swaps.map((swap) => ({ ...swap })),
      slotsAfter: correctSlots(source.slotsAfter, removed, added),
      ...(isHalftime ? { isHalftime: true } : {}),
      ...(fillsEmptySlot ? { fillsEmptySlot: true } : {}),
    };
  });
}

/** Minute at which each sent-off own-team player left the field */
function getExpulsionMinutes(cards: CardEvent[]): Map<string, number> {
  const expulsionMinutes = new Map<string, number>();
  for (const playerId of getExpelledIds(cards)) {
    const own = cards
      .filter((card) => !card.isRivalPlayer && card.teamPlayerId === playerId)
      .sort((a, b) => a.minute - b.minute);
    const red = own.find((card) => card.cardType === "red");
    const secondYellow = own.filter((card) => card.cardType === "yellow")[1];
    const expulsionCard = red ?? secondYellow;
    if (expulsionCard) expulsionMinutes.set(playerId, expulsionCard.minute);
  }
  return expulsionMinutes;
}

/** Minutes each player was on the field given the starters, the substitution windows and the match length */
export function computeMinutesFromWindows(
  starterIds: string[],
  windows: Pick<SubstitutionWindow, "minute" | "swaps">[],
  matchDurationMinutes: number,
  cards: CardEvent[],
): Record<string, number> {
  const minutes: Record<string, number> = {};
  const enteredAt = new Map<string, number>();
  const expulsionMinutes = getExpulsionMinutes(cards);
  const sentOff = new Set<string>();

  const enter = (playerId: string, minute: number) => {
    if (sentOff.has(playerId) || enteredAt.has(playerId)) return;
    enteredAt.set(playerId, minute);
    minutes[playerId] = minutes[playerId] ?? 0;
  };
  const leave = (playerId: string, minute: number) => {
    const entered = enteredAt.get(playerId);
    if (entered === undefined) return;
    minutes[playerId] += Math.max(0, minute - entered);
    enteredAt.delete(playerId);
  };
  const applyExpulsionsUntil = (minute: number) => {
    for (const [playerId, expulsionMinute] of expulsionMinutes) {
      if (expulsionMinute > minute || sentOff.has(playerId)) continue;
      leave(playerId, expulsionMinute);
      sentOff.add(playerId);
    }
  };

  for (const playerId of starterIds) enter(playerId, 0);
  for (const window of windows) {
    applyExpulsionsUntil(window.minute);
    for (const swap of window.swaps) {
      if (swap.outPlayerId) leave(swap.outPlayerId, window.minute);
      enter(swap.inPlayerId, window.minute);
    }
  }
  applyExpulsionsUntil(matchDurationMinutes);
  for (const playerId of [...enteredAt.keys()]) leave(playerId, matchDurationMinutes);

  return minutes;
}
