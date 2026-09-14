import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Igual que SimulationField.mobileRotation.test.ts: se verifica el tamaño reducido de tarjeta en
// móvil leyendo el código fuente CSS, porque jsdom no aplica @media queries de anchura.

const slotCss = readFileSync(
  join(__dirname, "..", "SimulationPlayerSlot.module.css"),
  "utf-8",
);
const compactBenchCss = readFileSync(
  join(__dirname, "..", "CompactBenchCard.module.css"),
  "utf-8",
);

function extractMediaBlock(css: string, maxWidth: number): string {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  expect(start, `expected to find "${marker}" in CSS source`).toBeGreaterThanOrEqual(0);
  return css.slice(start, start + 2000);
}

describe("SimulationPlayerSlot.module.css — tarjeta reducida en móvil (<=780px)", () => {
  it("reduce el tamaño de .playerCard y .dropTarget por debajo de 52px en móvil", () => {
    const mobileBlock = extractMediaBlock(slotCss, 780);
    const playerCardMatch = mobileBlock.match(/\.playerCard[^{]*\{[^}]*width:\s*(\d+)px/);
    const dropTargetMatch = mobileBlock.match(/\.dropTarget[^{]*\{[^}]*width:\s*(\d+)px/);
    expect(playerCardMatch, ".playerCard mobile width rule not found").not.toBeNull();
    expect(dropTargetMatch, ".dropTarget mobile width rule not found").not.toBeNull();
    expect(Number(playerCardMatch![1])).toBeLessThan(52);
    expect(Number(dropTargetMatch![1])).toBeLessThan(52);
  });
});

describe("CompactBenchCard.module.css — wrapper reducido en móvil (<=780px)", () => {
  it("reduce el ancho de .wrapper por debajo de 72px en móvil", () => {
    const mobileBlock = extractMediaBlock(compactBenchCss, 780);
    const wrapperMatch = mobileBlock.match(/\.wrapper\s*\{[^}]*width:\s*(\d+)px/);
    expect(wrapperMatch, ".wrapper mobile width rule not found").not.toBeNull();
    expect(Number(wrapperMatch![1])).toBeLessThan(72);
  });
});
