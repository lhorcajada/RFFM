import jsPDF from "jspdf";
import type { GameModel } from "../../types/gameModel";
import { buildGameModelPdfBlocks, gameModelPdfFileName, type GameModelPdfBlockKind } from "./gameModelPdfModel";

const MARGIN_X = 20;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 18;
const INDENT = 5;

type Style = {
  size: number;
  bold?: boolean;
  italic?: boolean;
  gapBefore: number;
  gapAfter: number;
  indent: number;
  color?: [number, number, number];
  rule?: boolean;
  keepWithNext?: boolean;
};

const STYLES: Record<GameModelPdfBlockKind, Style> = {
  title: { size: 22, bold: true, gapBefore: 0, gapAfter: 2, indent: 0 },
  subtitle: { size: 11, gapBefore: 0, gapAfter: 8, indent: 0, color: [100, 100, 100] },
  phase: { size: 15, bold: true, gapBefore: 10, gapAfter: 3, indent: 0, rule: true, keepWithNext: true },
  principle: { size: 12.5, bold: true, gapBefore: 6, gapAfter: 1.5, indent: 0, keepWithNext: true },
  subprinciple: { size: 11, bold: true, gapBefore: 4, gapAfter: 1, indent: INDENT, keepWithNext: true },
  zone: { size: 10.5, bold: true, italic: true, gapBefore: 3, gapAfter: 1, indent: INDENT * 2, keepWithNext: true },
  subsubprinciple: { size: 10, bold: true, gapBefore: 3, gapAfter: 0.5, indent: INDENT * 2, keepWithNext: true },
  setpiece: { size: 11, bold: true, gapBefore: 4, gapAfter: 1, indent: 0, keepWithNext: true },
  paragraph: { size: 10, gapBefore: 0, gapAfter: 1.5, indent: 0 },
  bullet: { size: 9.5, gapBefore: 0, gapAfter: 1, indent: INDENT * 3 },
  note: { size: 9.5, italic: true, gapBefore: 0, gapAfter: 1.5, indent: INDENT * 2, color: [90, 90, 90] },
};

/** Blocks that continue a heading inherit the indent of their parent level. */
const PARAGRAPH_INDENT: Partial<Record<GameModelPdfBlockKind, number>> = {
  principle: 0,
  subprinciple: INDENT,
  zone: INDENT * 2,
  subsubprinciple: INDENT * 2,
  setpiece: 0,
};

const lineHeight = (size: number): number => size * 0.45;

export function exportGameModelPdf(gameModel: GameModel, teamName?: string): void {
  const blocks = buildGameModelPdfBlocks(gameModel, teamName);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = pageH - MARGIN_BOTTOM;
  let y = MARGIN_TOP;
  let parentIndent = 0;

  const fontStyle = (s: Style) => (s.bold && s.italic ? "bolditalic" : s.bold ? "bold" : s.italic ? "italic" : "normal");

  blocks.forEach((block, i) => {
    const s = STYLES[block.kind];
    const indent = block.kind === "paragraph" || block.kind === "note" || block.kind === "bullet"
      ? Math.max(s.indent, parentIndent)
      : s.indent;
    if (block.kind in PARAGRAPH_INDENT) parentIndent = PARAGRAPH_INDENT[block.kind] ?? 0;
    const bulletPrefix = block.kind === "bullet" ? "•  " : "";
    const width = pageW - MARGIN_X * 2 - indent;

    doc.setFont("helvetica", fontStyle(s));
    doc.setFontSize(s.size);
    const lines = doc.splitTextToSize(`${bulletPrefix}${block.text}`, width) as string[];
    const lh = lineHeight(s.size);
    const next = blocks[i + 1];
    const nextNeeds = s.keepWithNext && next ? lineHeight(STYLES[next.kind].size) * 2 : 0;
    const needed = s.gapBefore + lines.length * lh + nextNeeds;

    if (y + needed > bottom && y > MARGIN_TOP) {
      doc.addPage();
      y = MARGIN_TOP;
    } else {
      y += y > MARGIN_TOP ? s.gapBefore : 0;
    }

    doc.setFont("helvetica", fontStyle(s));
    doc.setFontSize(s.size);
    const [r, g, b] = s.color ?? [30, 30, 30];
    doc.setTextColor(r, g, b);

    lines.forEach((line, li) => {
      if (y + lh > bottom) {
        doc.addPage();
        y = MARGIN_TOP;
        doc.setFont("helvetica", fontStyle(s));
        doc.setFontSize(s.size);
        doc.setTextColor(r, g, b);
      }
      y += lh;
      doc.text(line, MARGIN_X + indent + (block.kind === "bullet" && li > 0 ? 3 : 0), y, {
        align: "left",
      });
    });

    if (s.rule) {
      y += 1.2;
      doc.setDrawColor(190, 190, 190);
      doc.line(MARGIN_X, y, pageW - MARGIN_X, y);
    }
    y += s.gapAfter;
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(gameModel.name, MARGIN_X, pageH - 9);
    doc.text(`Página ${p} de ${total}`, pageW - MARGIN_X, pageH - 9, { align: "right" });
  }

  doc.save(gameModelPdfFileName(gameModel));
}
