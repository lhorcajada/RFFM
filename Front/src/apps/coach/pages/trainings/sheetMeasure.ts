import type { Exercise } from "../../types/training";
import {
  SHEET_CSS,
  SHEET_LEFT_WIDTH_MM,
  buildSheetPanelHtml,
  sheetContentFromExercise,
  type SheetContent,
} from "./exerciseSheet";

/** Sub-pixel layout differences must not turn a sheet that fits into one that overflows. */
const TOLERANCE_PX = 1;
const PX_PER_CM = 96 / 2.54;

export type SheetFit = {
  fits: boolean;
  /** How far the content runs past the bottom of the panel, in CSS pixels (0 when it fits). */
  overflowPx: number;
  /** Titles of the panel blocks that do not fully fit. */
  overflowingBlocks: string[];
};

const FITS: SheetFit = { fits: true, overflowPx: 0, overflowingBlocks: [] };

function withMeasureHost<T>(doc: Document, innerHtml: string, measure: (host: HTMLElement) => T): T {
  const host = doc.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
  host.innerHTML = `<style>${SHEET_CSS}</style>${innerHtml}`;
  doc.body.appendChild(host);
  try {
    return measure(host);
  } finally {
    host.remove();
  }
}

/** Measures the real side panel of the sheet — the same markup and styles the print uses — and
 * reports whether its content fits the height of one page. Only the panel is measured, so images
 * never need to load first. When the browser reports no layout (every height is 0) the sheet is
 * treated as fitting. */
export function measureSheetFit(content: SheetContent, doc: Document = document): SheetFit {
  return withMeasureHost(doc, buildSheetPanelHtml(content), (host) => {
    const panel = host.querySelector<HTMLElement>(".ficha-panel");
    if (!panel) return FITS;

    const available = panel.clientHeight;
    const overflowPx = panel.scrollHeight - available;
    if (overflowPx <= TOLERANCE_PX) return FITS;

    const overflowingBlocks = Array.from(panel.querySelectorAll<HTMLElement>(".ficha-block"))
      .filter((block) => block.offsetTop + block.offsetHeight > available + TOLERANCE_PX)
      .map((block) => block.dataset.block ?? "")
      .filter(Boolean);
    return { fits: false, overflowPx, overflowingBlocks };
  });
}

/** Whether the material legend fits the free space under the drawing. */
export function legendFits(legendHtml: string, freeHeightMm: number, doc: Document = document): boolean {
  const html = `<div style="width:${SHEET_LEFT_WIDTH_MM}mm">${legendHtml}</div><div data-probe style="height:${freeHeightMm}mm"></div>`;
  return withMeasureHost(doc, html, (host) => {
    const legend = host.querySelector<HTMLElement>(".ficha-legend");
    const probe = host.querySelector<HTMLElement>("[data-probe]");
    if (!legend || !probe) return true;
    return legend.offsetHeight <= probe.offsetHeight + TOLERANCE_PX;
  });
}

export type SheetOverflow = {
  exercise: Exercise;
  /** Name of the session block the exercise belongs to, when it is printed as part of a session. */
  blockName?: string;
  fit: SheetFit;
};

export type SheetToCheck = { exercise: Exercise; blockName?: string };

/** Runs the fit check for every sheet and returns the ones that do not fit. */
export function findOverflowingSheets(sheets: SheetToCheck[], doc: Document = document): SheetOverflow[] {
  return sheets.flatMap(({ exercise, blockName }) => {
    const fit = measureSheetFit(sheetContentFromExercise(exercise), doc);
    return fit.fits ? [] : [{ exercise, blockName, fit }];
  });
}

/** Short reason shown to the coach: which blocks run over and by roughly how much. */
export function describeOverflow(fit: SheetFit): string {
  const blocks = fit.overflowingBlocks.map((title) => `«${title}»`).join(", ");
  const centimetres = Math.max(0.5, Math.round((fit.overflowPx / PX_PER_CM) * 2) / 2);
  const amount = `${String(centimetres).replace(".", ",")} cm`;
  return blocks
    ? `No cabe en una hoja A4: se sale ${blocks} (unos ${amount} de más).`
    : `No cabe en una hoja A4: sobran unos ${amount}.`;
}
