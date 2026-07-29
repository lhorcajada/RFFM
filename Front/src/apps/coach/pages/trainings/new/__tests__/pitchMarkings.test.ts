import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS } from "../constants";

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
