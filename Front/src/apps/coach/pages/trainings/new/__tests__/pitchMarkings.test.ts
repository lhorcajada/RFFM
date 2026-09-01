import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  F7_GOAL_AREA_DEPTH_METERS,
  F7_GOAL_AREA_WIDTH_METERS,
  F7_GOAL_DEPTH_METERS,
  F7_GOAL_WIDTH_METERS,
  F7_LENGTH_METERS,
  F7_WIDTH_METERS,
  FIELD_WIDTH_METERS,
  HALF_FIELD_LENGTH_METERS,
} from "../constants";

// Official F11 (11-a-side) pitch marking dimensions, FIFA Laws of the Game.
const PENALTY_AREA_DEPTH_METERS = 16.5;
const PENALTY_AREA_WIDTH_METERS = 40.32;
const GOAL_AREA_DEPTH_METERS = 5.5;
const GOAL_AREA_WIDTH_METERS = 18.32;
const PENALTY_SPOT_DEPTH_METERS = 11;
const CENTER_CIRCLE_DIAMETER_METERS = 18.3;
const GOAL_WIDTH_METERS = 7.32;

const css = readFileSync(path.resolve(__dirname, "../NewExercisePage.module.css"), "utf-8");

// Some selectors (penaltyArea, goalArea) appear twice: once in a shared
// selector list carrying only positioning rules, and once in their own
// standalone rule carrying width/height. Take the LAST match, which is
// always the selector's own dedicated rule in this file.
function getBlock(selector: string): string {
  const matches = [...css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, "g"))];
  if (matches.length === 0) throw new Error(`Rule ".${selector} { ... }" not found`);
  return matches[matches.length - 1][1];
}

function getPercent(block: string, property: string): number {
  const match = block.match(new RegExp(`(?<!-)\\b${property}:\\s*(-?\\d+(?:\\.\\d+)?)%`));
  if (!match) throw new Error(`Property "${property}" not found in block`);
  return Number(match[1]);
}

function getGoalLineOffsetPercent(block: string): number {
  const match = block.match(/calc\(100% - var\(--goal-back-band\) - (\d+(?:\.\d+)?)%\)/);
  if (!match) throw new Error("Goal-line-relative offset not found in block");
  return Number(match[1]);
}

// Depth/diameter measurements run along the horizontal axis, which spans the
// half-pitch length (HALF_FIELD_LENGTH_METERS); width measurements run along
// the vertical axis, which spans the full field width (FIELD_WIDTH_METERS).
const toPercent = (meters: number, axisMeters: number) =>
  Math.round((meters / axisMeters) * 100 * 1000) / 1000;

describe("F11 pitch area markings (NewExercisePage.module.css)", () => {
  it("penalty area: 16.5m depth x 40.32m width", () => {
    const block = getBlock("penaltyArea");
    expect(getPercent(block, "width")).toBe(toPercent(PENALTY_AREA_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));
    expect(getPercent(block, "height")).toBe(toPercent(PENALTY_AREA_WIDTH_METERS, FIELD_WIDTH_METERS));
  });

  it("goal area: 5.5m depth x 18.32m width", () => {
    const block = getBlock("goalArea");
    expect(getPercent(block, "width")).toBe(toPercent(GOAL_AREA_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));
    expect(getPercent(block, "height")).toBe(toPercent(GOAL_AREA_WIDTH_METERS, FIELD_WIDTH_METERS));
  });

  it("penalty spot: 11m from the goal line", () => {
    const block = getBlock("penaltySpot");
    expect(getGoalLineOffsetPercent(block)).toBe(toPercent(PENALTY_SPOT_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));
  });

  it("penalty arc: 18.3m diameter, centered on the penalty spot", () => {
    const block = getBlock("penaltyArc");
    expect(getPercent(block, "width")).toBe(toPercent(CENTER_CIRCLE_DIAMETER_METERS, HALF_FIELD_LENGTH_METERS));
    expect(getGoalLineOffsetPercent(block)).toBe(toPercent(PENALTY_SPOT_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));
  });

  it("center circle: 18.3m diameter", () => {
    const block = getBlock("centerCircle");
    expect(getPercent(block, "width")).toBe(toPercent(CENTER_CIRCLE_DIAMETER_METERS, HALF_FIELD_LENGTH_METERS));
  });

  it("goal mouth: 7.32m wide", () => {
    const block = getBlock("goalMouth");
    expect(getPercent(block, "height")).toBe(toPercent(GOAL_WIDTH_METERS, FIELD_WIDTH_METERS));
  });
});

// .halfPitch/.mirrorHalf reserve a decorative "out of bounds" band around the
// true playable area: --touchline-band (top/bottom) and --goal-back-band
// (right, toward the goal). The true touchlines/goal-line sit at these band
// edges, NOT at 0%/100% of the container.
const GOAL_BACK_BAND_PERCENT = 10;

describe("Fútbol 7 pitch overlay, marked crosswise in each F11 half (NewExercisePage.module.css)", () => {
  it("f7Pitch: goal-to-goal axis stretched to the full F11 width (touching both touchlines exactly)", () => {
    // The F7 goal-to-goal axis runs along the F11 width axis. That's the
    // constrained dimension, so the F7 pitch's length is stretched to fill
    // it exactly (goals flush on the real touchlines/bandas), taking
    // priority over F7's own nominal 60m length. The F7 touchline axis
    // (40m) runs along the F11 half-length axis, centered at its official
    // size within the true playable span (90% of width, between the
    // midline and --goal-back-band).
    const block = getBlock("f7Pitch");

    expect(block).toMatch(/top:\s*var\(--touchline-band\)/);
    expect(block).toMatch(/height:\s*calc\(100%\s*-\s*\(?2\s*\*\s*var\(--touchline-band\)\)?\)/);

    const playableWidthPercent = 100 - GOAL_BACK_BAND_PERCENT;
    // Computed directly from the raw meter fraction (not from the already
    // rounded toPercent() output) so this matches the CSS, which is also
    // computed directly, without compounding two separate roundings.
    const expectedWidth = (F7_WIDTH_METERS / HALF_FIELD_LENGTH_METERS) * playableWidthPercent;
    const expectedLeft = ((HALF_FIELD_LENGTH_METERS - F7_WIDTH_METERS) / 2 / HALF_FIELD_LENGTH_METERS) * playableWidthPercent;

    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    expect(getPercent(block, "width")).toBe(round3(expectedWidth));
    expect(getPercent(block, "left")).toBe(round3(expectedLeft));

    // Must stay fully within the true playable width — never past the real
    // goal line.
    const left = getPercent(block, "left");
    const width = getPercent(block, "width");
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(100 - GOAL_BACK_BAND_PERCENT);

    // Centered within the true playable width (not the raw 0-100% box,
    // whose center is skewed by the one-sided goal-back band).
    expect(round3(left + width / 2)).toBe(round3((100 - GOAL_BACK_BAND_PERCENT) / 2));
  });

  it("f7 goal area (for goal kicks): 5m depth x 13m width from each goal line", () => {
    for (const selector of ["f7AreaTop", "f7AreaBottom"]) {
      const block = getBlock(selector);
      expect(getPercent(block, "width")).toBe(toPercent(F7_GOAL_AREA_WIDTH_METERS, F7_WIDTH_METERS));
      expect(getPercent(block, "height")).toBe(toPercent(F7_GOAL_AREA_DEPTH_METERS, F7_LENGTH_METERS));
    }
  });

  it("f7 goals: 2m deep x 6m wide, centered on each goal line", () => {
    for (const selector of ["f7GoalTop", "f7GoalBottom"]) {
      const block = getBlock(selector);
      expect(getPercent(block, "width")).toBe(toPercent(F7_GOAL_WIDTH_METERS, F7_WIDTH_METERS));
      expect(getPercent(block, "height")).toBe(toPercent(F7_GOAL_DEPTH_METERS, F7_LENGTH_METERS));
    }
  });

  it("fuera de juego (offside) line: a continuous line from the F11 penalty area's corner to the F7 pitch's far side (away from goal)", () => {
    const block1 = getBlock("f7OffsideLineTop");
    const block2 = getBlock("f7OffsideLineBottom");

    // Right-anchored at the penalty area's own left/outer edge (16.5m over
    // the 52.5m half-pitch length) — the corner it extends from.
    const rightMatch1 = block1.match(/right:\s*calc\(var\(--goal-back-band\)\s*\+\s*(\d+(?:\.\d+)?)%\)/);
    const rightMatch2 = block2.match(/right:\s*calc\(var\(--goal-back-band\)\s*\+\s*(\d+(?:\.\d+)?)%\)/);
    expect(rightMatch1).not.toBeNull();
    expect(rightMatch2).not.toBeNull();
    expect(Number(rightMatch1![1])).toBe(toPercent(PENALTY_AREA_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));
    expect(Number(rightMatch2![1])).toBe(toPercent(PENALTY_AREA_DEPTH_METERS, HALF_FIELD_LENGTH_METERS));

    // Left-anchored at .f7Pitch's own left edge — the F7 pitch's far side,
    // away from the goal (never reaching toward the goal/touchline).
    expect(getPercent(block1, "left")).toBe(getPercent(getBlock("f7Pitch"), "left"));
    expect(getPercent(block2, "left")).toBe(getPercent(getBlock("f7Pitch"), "left"));

    // Vertically at the penalty area's top/bottom edge (50% ± half of
    // .penaltyArea's height, 40.32m over the 68m field width) — level with
    // the corner, not running down toward the touchline/goal.
    const penaltyAreaHalfHeight = toPercent(PENALTY_AREA_WIDTH_METERS, FIELD_WIDTH_METERS) / 2;
    const expectedOffset = Math.round((50 - penaltyAreaHalfHeight) * 1000) / 1000;
    expect(getPercent(block1, "top")).toBe(expectedOffset);
    expect(getPercent(block2, "bottom")).toBe(expectedOffset);

    expect(block1).toMatch(/#44c8ff/);
    expect(block2).toMatch(/#44c8ff/);
  });

  it("all F7 markings (including the offside line and the center point) are drawn in blue", () => {
    for (const selector of [
      "f7Pitch",
      "f7AreaTop",
      "f7AreaBottom",
      "f7GoalTop",
      "f7GoalBottom",
      "f7CenterPoint",
      "f7OffsideLineTop",
      "f7OffsideLineBottom",
    ]) {
      const block = getBlock(selector);
      expect(block).toMatch(/#44c8ff/);
    }
  });
});
