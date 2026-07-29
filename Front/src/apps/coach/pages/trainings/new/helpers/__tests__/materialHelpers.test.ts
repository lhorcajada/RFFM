import { describe, expect, it } from "vitest";
import { getMaterialSizePercent } from "../materialHelpers";
import { FIELD_WIDTH_METERS, HALF_FIELD_LENGTH_METERS } from "../../constants";

describe("getMaterialSizePercent", () => {
  it("balones: width/height ratio matches the pitch aspect ratio, so it renders as a circle, not an oval", () => {
    const { width, height } = getMaterialSizePercent("balones");

    // The half-pitch container spans HALF_FIELD_LENGTH_METERS horizontally
    // and FIELD_WIDTH_METERS vertically, so a shape only renders with equal
    // pixel width/height (a true circle) when its own width%/height% ratio
    // compensates for that, i.e. equals FIELD_WIDTH_METERS/HALF_FIELD_LENGTH_METERS.
    expect(width / height).toBeCloseTo(FIELD_WIDTH_METERS / HALF_FIELD_LENGTH_METERS, 3);
  });
});
