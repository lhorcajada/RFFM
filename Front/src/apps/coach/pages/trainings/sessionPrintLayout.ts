/** Vertical positions (in CSS px, measured on the continuous on-screen layout of the print
 * sheet) of one exercise with a drawing: where its item starts, where its visual block
 * (heading + drawing/image) starts, the heading/margins overhead and the drawing's height. */
export type DrawingMeasure = {
  itemTop: number;
  visualTop: number;
  overhead: number;
  drawingHeight: number;
};

export type DrawingPlan = {
  height: number;
  breakBeforeItem: boolean;
  breakBeforeVisual: boolean;
};

export type DrawingFitOptions = {
  pageHeight: number;
  minDrawingHeight: number;
  safety: number;
};

/** Simulates the printed pagination so every drawing lands on the same page as its exercise's
 * text: it shrinks the drawing to the room left on that page, and only when not even
 * `minDrawingHeight` fits does it move the whole exercise (or, if its text already spans
 * several pages, just the drawing) to the next page. Positions shift as earlier drawings
 * shrink or move, so the plan is computed in document order carrying that offset. */
export function planDrawingFit(measures: DrawingMeasure[], options: DrawingFitOptions): DrawingPlan[] {
  const { pageHeight, minDrawingHeight, safety } = options;
  const pageEnd = (y: number) => (Math.floor(y / pageHeight) + 1) * pageHeight;
  const roomFor = (top: number, overhead: number) => pageEnd(top) - top - overhead - safety;
  let shift = 0;

  return measures.map((m) => {
    const itemTop = m.itemTop + shift;
    let visualTop = m.visualTop + shift;
    let breakBeforeItem = false;
    let breakBeforeVisual = false;

    if (roomFor(visualTop, m.overhead) < minDrawingHeight) {
      const itemOnSamePage = Math.floor(itemTop / pageHeight) === Math.floor(visualTop / pageHeight);
      const itemAtPageStart = itemTop % pageHeight === 0;
      const gap = itemOnSamePage && !itemAtPageStart ? pageEnd(itemTop) - itemTop : pageEnd(visualTop) - visualTop;
      breakBeforeItem = itemOnSamePage && !itemAtPageStart;
      breakBeforeVisual = !breakBeforeItem;
      shift += gap;
      visualTop += gap;
    }

    const height = Math.min(m.drawingHeight, Math.max(minDrawingHeight, roomFor(visualTop, m.overhead)));
    shift -= m.drawingHeight - height;
    return { height, breakBeforeItem, breakBeforeVisual };
  });
}

const PRINTABLE_PAGE_HEIGHT = "273mm";
const MIN_DRAWING_HEIGHT_PX = 220;
const SAFETY_PX = 24;

/** Applies `planDrawingFit` to a rendered session sheet (see `sessionPrint.ts`): measures each
 * `.exercise-visual` on screen and sets the drawing height / page breaks before printing. */
export function fitSessionDrawingsToPages(doc: Document): void {
  const probe = doc.createElement("div");
  probe.style.height = PRINTABLE_PAGE_HEIGHT;
  doc.body.appendChild(probe);
  const pageHeight = probe.getBoundingClientRect().height;
  probe.remove();
  if (!pageHeight) return;

  const sheet = doc.querySelector<HTMLElement>(".sheet");
  const visuals = Array.from(doc.querySelectorAll<HTMLElement>(".exercise-item .exercise-visual"));
  if (!sheet || visuals.length === 0) return;

  const originTop = sheet.getBoundingClientRect().top;
  const entries = visuals.flatMap((visual) => {
    const item = visual.closest<HTMLElement>(".exercise-item");
    const drawing = visual.querySelector<HTMLElement>(".board-drawing, img");
    if (!item || !drawing) return [];
    const visualRect = visual.getBoundingClientRect();
    const drawingHeight = drawing.getBoundingClientRect().height;
    if (!drawingHeight) return [];
    return [{
      item,
      visual,
      drawing,
      measure: {
        itemTop: item.getBoundingClientRect().top - originTop,
        visualTop: visualRect.top - originTop,
        overhead: visualRect.height - drawingHeight,
        drawingHeight,
      },
    }];
  });

  const plans = planDrawingFit(entries.map((e) => e.measure), {
    pageHeight,
    minDrawingHeight: MIN_DRAWING_HEIGHT_PX,
    safety: SAFETY_PX,
  });

  entries.forEach(({ item, visual, drawing, measure }, index) => {
    const plan = plans[index];
    if (plan.breakBeforeItem) item.classList.add("print-break-before");
    if (plan.breakBeforeVisual) visual.classList.add("print-break-before");
    if (plan.height < measure.drawingHeight) {
      drawing.classList.add("drawing-fitted");
      drawing.style.height = `${Math.floor(plan.height)}px`;
    }
  });
}
