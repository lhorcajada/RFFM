import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Igual criterio que los demás tests de layout móvil de este change: se lee el código fuente
// del módulo CSS porque jsdom no aplica @media queries de anchura.

const scoreboardCss = readFileSync(
  join(__dirname, "..", "LiveMatchScoreboard.module.css"),
  "utf-8",
);

function extractMediaBlock(css: string, maxWidth: number): string {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  expect(start, `expected to find "${marker}" in CSS source`).toBeGreaterThanOrEqual(0);
  return css.slice(start, start + 2000);
}

describe("LiveMatchScoreboard.module.css — marcador compacto en móvil (<=780px)", () => {
  it("reduce el padding de .root en móvil", () => {
    const mobileBlock = extractMediaBlock(scoreboardCss, 780);
    expect(mobileBlock).toMatch(/\.root\s*\{[^}]*padding:/);
  });

  it("reduce el tamaño de fuente del marcador (.score) por debajo del valor base (2.4rem)", () => {
    const mobileBlock = extractMediaBlock(scoreboardCss, 780);
    const scoreMatch = mobileBlock.match(/\.score\s*\{[^}]*font-size:\s*([\d.]+)rem/);
    expect(scoreMatch, ".score mobile font-size rule not found").not.toBeNull();
    expect(Number(scoreMatch![1])).toBeLessThan(2.4);
  });

  it("reduce el tamaño de los escudos (.shield) por debajo de 28px en móvil", () => {
    const mobileBlock = extractMediaBlock(scoreboardCss, 780);
    const shieldMatch = mobileBlock.match(/\.shield\s*\{[^}]*width:\s*(\d+)px/);
    expect(shieldMatch, ".shield mobile width rule not found").not.toBeNull();
    expect(Number(shieldMatch![1])).toBeLessThan(28);
  });
});
