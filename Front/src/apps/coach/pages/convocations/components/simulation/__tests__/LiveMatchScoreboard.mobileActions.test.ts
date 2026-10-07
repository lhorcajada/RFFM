import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// jsdom no aplica @media queries de anchura: se lee el código fuente del módulo CSS.

const scoreboardCss = readFileSync(
  join(__dirname, "..", "LiveMatchScoreboard.module.css"),
  "utf-8",
);

function mobileBlock(): string {
  const marker = "@media (max-width: 780px)";
  const start = scoreboardCss.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return scoreboardCss.slice(start);
}

describe("LiveMatchScoreboard.module.css — botones de gol y tarjeta en móvil", () => {
  it("en móvil coloca equipos y marcador en la primera fila y los botones en una segunda fila", () => {
    const block = mobileBlock();
    expect(block).toMatch(/\.root\s*\{[^}]*display:\s*grid/);
    expect(block).toMatch(/grid-template-areas:\s*"local score visitor"\s*"localGoal card visitorGoal"/);
  });

  it("asigna cada botón a su celda de la segunda fila, sin solaparse con el marcador", () => {
    const block = mobileBlock();
    expect(block).toMatch(/\.localGoal\s*\{[^}]*grid-area:\s*localGoal/);
    expect(block).toMatch(/\.visitorGoal\s*\{[^}]*grid-area:\s*visitorGoal/);
    expect(block).toMatch(/\.cardBtn\s*\{[^}]*grid-area:\s*card/);
    expect(block).toMatch(/\.scoreBlock\s*\{[^}]*grid-area:\s*score/);
  });
});
