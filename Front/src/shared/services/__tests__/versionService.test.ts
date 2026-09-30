import { describe, expect, it } from "vitest";
import { formatVersion } from "../versionService";

describe("formatVersion", () => {
  it("incluye el commit entre paréntesis cuando existe", () => {
    expect(formatVersion({ version: "1.0.0", commit: "9be4c62" })).toBe("v1.0.0 (9be4c62)");
  });

  it("muestra solo la versión cuando no hay commit", () => {
    expect(formatVersion({ version: "1.0.0", commit: null })).toBe("v1.0.0");
  });
});
