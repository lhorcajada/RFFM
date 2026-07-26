import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS } from "../constants";

const css = readFileSync(path.resolve(__dirname, "../NewExercisePage.module.css"), "utf-8");

function getBlock(selector: string): string {
  const matches = [...css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, "g"))];
  if (matches.length === 0) throw new Error(`Rule ".${selector} { ... }" not found`);
  return matches[matches.length - 1][1];
}

describe("half-pitch container scale (NewExercisePage.module.css .halfPitch)", () => {
  it("expresses width and aspect-ratio in the half-pitch length, so horizontal and vertical px/meter match", () => {
    const block = getBlock("halfPitch");

    const widthMatch = block.match(/width:\s*min\(100%,\s*calc\((\d+(?:\.\d+)?)px \* var\(--pitch-ppm\)\)/);
    const aspectRatioMatch = block.match(/aspect-ratio:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);

    expect(widthMatch).not.toBeNull();
    expect(aspectRatioMatch).not.toBeNull();

    const widthLengthMeters = Number(widthMatch![1]);
    const aspectLengthMeters = Number(aspectRatioMatch![1]);
    const aspectWidthMeters = Number(aspectRatioMatch![2]);

    // Both the width formula and the aspect-ratio must use the half-pitch
    // length (52.5m, HALF_FIELD_LENGTH_METERS — the same constant the space
    // geometry helpers use for the horizontal axis), not the full-pitch
    // length (105m). Otherwise the container's real horizontal px/meter
    // scale ends up double its vertical px/meter scale, and a square placed
    // on the field renders as a rectangle.
    expect(widthLengthMeters).toBe(HALF_FIELD_LENGTH_METERS);
    expect(aspectLengthMeters).toBe(HALF_FIELD_LENGTH_METERS);
    expect(aspectWidthMeters).toBe(FIELD_WIDTH_METERS);
  });

  it("caps its width by the available height too (via cqh), so it never overflows the viewport vertically", () => {
    // `.pitchArea` has a base rule plus a mobile media-query override; check
    // all of its occurrences rather than assuming which one a naive "first/
    // last match" pick would land on.
    const pitchAreaBlocks = [...css.matchAll(/\.pitchArea\s*\{([^}]*)\}/g)].map((m) => m[1]);
    // `.halfPitch`'s cqh-based width term only resolves against the
    // half-pitch length when `.pitchArea` (its containing block) is a size
    // container — without this, `cqh` falls back to the viewport and the
    // cap stops matching `.pitchArea`'s actual available height.
    expect(pitchAreaBlocks.some((block) => /container-type:\s*size/.test(block))).toBe(true);

    const halfPitchBlock = getBlock("halfPitch");
    const cqhMatch = halfPitchBlock.match(
      /calc\(100cqh \* (\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\)/,
    );
    expect(cqhMatch).not.toBeNull();
    expect(Number(cqhMatch![1])).toBe(HALF_FIELD_LENGTH_METERS);
    expect(Number(cqhMatch![2])).toBe(FIELD_WIDTH_METERS);
  });
});

describe("half-pitch corner backdrop (terrainBandTop/Bottom + terrainGoalBack)", () => {
  it("terrainGoalBack spans the full height, meeting the touchline bands flush at the corners", () => {
    const block = getBlock("terrainGoalBack");

    // If this were `top: var(--touchline-band); bottom: var(--touchline-band);`
    // instead, it would stop short of the corners already covered by
    // terrainBandTop/terrainBandBottom, leaving a square of undarkened grass
    // visible in each one instead of a seamless dark backdrop.
    expect(block).toMatch(/top:\s*0\s*;/);
    expect(block).toMatch(/bottom:\s*0\s*;/);
  });
});
