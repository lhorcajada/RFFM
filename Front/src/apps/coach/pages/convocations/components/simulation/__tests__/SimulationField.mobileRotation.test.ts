import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// jsdom no calcula layout real ni aplica @media queries de anchura, así que la rotación del
// campo en móvil (puramente CSS, ver design.md de coach-simulation-mobile-layout) se verifica
// leyendo el código fuente de los módulos CSS en vez de estilos computados. La verificación
// visual real (campo en vertical, tarjetas legibles, drag & drop) es manual — ver tasks.md.

const fieldCss = readFileSync(
  join(__dirname, "..", "SimulationField.module.css"),
  "utf-8",
);
const slotCss = readFileSync(
  join(__dirname, "..", "SimulationPlayerSlot.module.css"),
  "utf-8",
);

function extractMediaBlock(css: string, maxWidth: number): string {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  expect(start, `expected to find "${marker}" in CSS source`).toBeGreaterThanOrEqual(0);
  // Grab a generous chunk after the marker — enough to contain the nested rules.
  return css.slice(start, start + 2000);
}

describe("SimulationField.module.css — rotación del campo en móvil (<=780px)", () => {
  it("activa container queries en .fieldWrapper dentro de la media query móvil", () => {
    const mobileBlock = extractMediaBlock(fieldCss, 780);
    expect(mobileBlock).toMatch(/\.fieldWrapper\s*\{[^}]*container-type:\s*size/);
  });

  it("da a .fieldWrapper una relación de aspecto portrait (68 / 105) en móvil", () => {
    const mobileBlock = extractMediaBlock(fieldCss, 780);
    expect(mobileBlock).toMatch(/\.fieldWrapper\s*\{[^}]*aspect-ratio:\s*68\s*\/\s*105/);
  });

  it("rota .field 90 grados usando unidades de container query (cqw/cqh) en móvil", () => {
    const mobileBlock = extractMediaBlock(fieldCss, 780);
    expect(mobileBlock).toMatch(/\.field\s*\{[^}]*width:\s*100cqh/);
    expect(mobileBlock).toMatch(/\.field\s*\{[^}]*height:\s*100cqw/);
    expect(mobileBlock).toMatch(/\.field\s*\{[^}]*rotate\(90deg\)/);
  });

  it("no toca la relación de aspecto apaisada base (105 / 68) fuera de la media query móvil", () => {
    const beforeMobileQuery = fieldCss.slice(0, fieldCss.indexOf("@media (max-width: 780px)"));
    expect(beforeMobileQuery).toMatch(/\.fieldWrapper\s*\{[^}]*aspect-ratio:\s*105\s*\/\s*68/);
  });
});

describe("SimulationPlayerSlot.module.css — contra-rotación del contenido en móvil (<=780px)", () => {
  it("contra-rota .slot -90 grados en móvil para que el contenido se vea en pie", () => {
    const mobileBlock = extractMediaBlock(slotCss, 780);
    expect(mobileBlock).toMatch(/\.slot\s*\{[^}]*rotate\(-90deg\)/);
  });
});
