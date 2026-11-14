import jsPDF from "jspdf";
import type { Acta } from "../types/acta";
import { actaPdfFileName, buildActaPdfModel, type ActaPdfTeam } from "../utils/actaPdfModel";

const MARGIN = 12;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const COLUMN_GAP = 6;
const COLUMN_WIDTH = (PAGE_WIDTH - MARGIN * 2 - COLUMN_GAP) / 2;
const BODY_SIZE = 8;
const LINE_HEIGHT = 3.8;

export function downloadActaPdf(acta: Acta): void {
  const model = buildActaPdfModel(acta);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (title: string) => {
    ensureSpace(LINE_HEIGHT * 3);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 1.5;
    doc.setDrawColor(150);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += LINE_HEIGHT;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
  };

  const fullWidthList = (lines: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, PAGE_WIDTH - MARGIN * 2) as string[];
      ensureSpace(wrapped.length * LINE_HEIGHT);
      doc.text(wrapped, MARGIN, y);
      y += wrapped.length * LINE_HEIGHT;
    });
  };

  const twoColumns = (title: string, pick: (t: ActaPdfTeam) => string[]) => {
    const [left, right] = model.teams.map((t) => pick(t));
    if (left.length === 0 && right.length === 0) return;
    heading(title);
    doc.setFontSize(BODY_SIZE);
    const wrap = (lines: string[]) =>
      lines.flatMap((l) => doc.splitTextToSize(l, COLUMN_WIDTH) as string[]);
    const leftLines = wrap(left);
    const rightLines = wrap(right);
    const rows = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < rows; i += 1) {
      ensureSpace(LINE_HEIGHT);
      if (leftLines[i]) doc.text(leftLines[i], MARGIN, y);
      if (rightLines[i]) doc.text(rightLines[i], MARGIN + COLUMN_WIDTH + COLUMN_GAP, y);
      y += LINE_HEIGHT;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const scoreLines = doc.splitTextToSize(model.scoreLine, PAGE_WIDTH - MARGIN * 2) as string[];
  doc.text(scoreLines, PAGE_WIDTH / 2, y + 4, { align: "center" });
  y += 4 + scoreLines.length * 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_SIZE);
  [model.matchInfo, model.placeInfo].filter(Boolean).forEach((line) => {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += LINE_HEIGHT;
  });

  heading("Equipos");
  doc.setFont("helvetica", "bold");
  doc.text(model.teams[0].name, MARGIN, y);
  doc.text(model.teams[1].name, MARGIN + COLUMN_WIDTH + COLUMN_GAP, y);
  y += LINE_HEIGHT;
  doc.setFont("helvetica", "normal");

  twoColumns("Titulares", (t) => t.starters);
  twoColumns("Suplentes", (t) => t.substitutes);
  twoColumns("Cambios", (t) => t.substitutions);
  twoColumns("Tarjetas", (t) => t.cards);
  twoColumns("Cuerpo técnico", (t) => t.staff);

  if (model.goals.length > 0) {
    heading("Goles");
    fullWidthList(model.goals);
  }
  if (model.referees.length > 0) {
    heading("Árbitros");
    fullWidthList(model.referees);
  }

  doc.save(actaPdfFileName(acta));
}
