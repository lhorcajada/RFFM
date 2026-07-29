import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIELD_WIDTH_METERS,
  HALF_FIELD_LENGTH_METERS,
} from "../../pages/trainings/new/constants";

// This preview mirrors the real editor's half-pitch (NewExercisePage.module.css
// .halfPitch) as a hand-maintained copy, scaled to a card-sized thumbnail —
// see the header comment in TacticalBoardSnapshotPreview.module.css. These
// tests pin it to the SAME geometry as the editor so the two can't silently
// drift apart again (as they did: the editor was fixed to use the half-pitch
// length, 52.5m, for its horizontal/depth measurements, but this file kept
// the old full-pitch-length values, 105m, making cards show a differently
// shaped/proportioned board than the one the coach actually drew).

const css = readFileSync(
  path.resolve(__dirname, "../TacticalBoardSnapshotPreview.module.css"),
  "utf-8",
);

function getBlock(selector: string): string {
  const matches = [...css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, "g"))];
  if (matches.length === 0) throw new Error(`Rule ".${selector} { ... }" not found`);
  return matches[matches.length - 1][1];
}

// Official F11 (11-a-side) pitch marking dimensions, FIFA Laws of the Game —
// same values used in NewExercisePage.module.css / pitchMarkings.test.ts.
const PENALTY_AREA_DEPTH_METERS = 16.5;
const PENALTY_AREA_WIDTH_METERS = 40.32;
const GOAL_AREA_DEPTH_METERS = 5.5;
const GOAL_AREA_WIDTH_METERS = 18.32;
const PENALTY_SPOT_DEPTH_METERS = 11;
const CENTER_CIRCLE_DIAMETER_METERS = 18.3;
const GOAL_WIDTH_METERS = 7.32;

const toPercent = (meters: number, axisMeters: number) =>
  Math.round((meters / axisMeters) * 100 * 1000) / 1000;

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

describe("TacticalBoardSnapshotPreview — pitch box self-contains its own aspect ratio", () => {
  it(".board centers a cqh-sized .pitch, so it renders correctly proportioned regardless of the consumer's own card shape (16:9, 4:3, ...)", () => {
    const boardBlock = getBlock("board");
    expect(boardBlock).toMatch(/container-type:\s*size/);
    expect(boardBlock).toMatch(/display:\s*flex/);
    expect(boardBlock).toMatch(/align-items:\s*center/);
    expect(boardBlock).toMatch(/justify-content:\s*center/);

    const pitchBlock = getBlock("pitch");
    const cqhMatch = pitchBlock.match(/calc\(100cqh \* (\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\)/);
    expect(cqhMatch).not.toBeNull();
    expect(Number(cqhMatch![1])).toBe(HALF_FIELD_LENGTH_METERS);
    expect(Number(cqhMatch![2])).toBe(FIELD_WIDTH_METERS);

    const aspectRatioMatch = pitchBlock.match(/aspect-ratio:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    expect(aspectRatioMatch).not.toBeNull();
    expect(Number(aspectRatioMatch![1])).toBe(HALF_FIELD_LENGTH_METERS);
    expect(Number(aspectRatioMatch![2])).toBe(FIELD_WIDTH_METERS);
  });
});

describe("TacticalBoardSnapshotPreview — F11 area markings match the editor", () => {
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

  it("terrainGoalBack spans the full height, meeting the touchline bands flush at the corners", () => {
    const block = getBlock("terrainGoalBack");
    expect(block).toMatch(/top:\s*0\s*;/);
    expect(block).toMatch(/bottom:\s*0\s*;/);
  });
});
