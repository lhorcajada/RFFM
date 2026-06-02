import type { Player, Demarcation } from './types';

const STATUS_LABELS: Record<string, string> = {
  descartado: 'Descartado',
  poco: 'Poco interés',
  interesado: 'Interesado',
  solicitado: 'Solicitado',
  seleccionado: 'Seleccionado',
};

export async function exportTestGridToPdf(players: Player[], demarcations: Demarcation[]): Promise<void> {
  const mod = await import('jspdf');
  const jsPDF = (mod as any).default ?? mod.jsPDF ?? mod;

  const COLS = [
    { header: '#',            width: 10 },
    { header: 'Nombre',       width: 52 },
    { header: 'Año',          width: 14 },
    { header: 'Equipo',       width: 40 },
    { header: 'Categoría',    width: 30 },
    { header: 'Estado',       width: 22 },
    { header: 'Dem. ideal',   width: 18 },
    { header: 'Dem. posibles',width: 30 },
  ] as const;

  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN_X = 10;
  const MARGIN_TOP = 14;
  const ROW_H = 6.5;
  const HEADER_H = 8;
  const FONT_SIZE_HEADER = 7.5;
  const FONT_SIZE_ROW = 6.8;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalCols = COLS.reduce((s, c) => s + c.width, 0);
  const scale = (PAGE_W - MARGIN_X * 2) / totalCols;

  const drawHeader = (y: number) => {
    // Bottom border line under header
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y + HEADER_H, PAGE_W - MARGIN_X, y + HEADER_H);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_HEADER);
    doc.setTextColor(30, 30, 30);
    let x = MARGIN_X;
    COLS.forEach((col) => {
      const w = col.width * scale;
      doc.text(col.header.toUpperCase(), x + 2, y + 5.5);
      x += w;
    });
    return y + HEADER_H;
  };

  const demById = new Map(demarcations.map((d) => [d.id, d.code]));

  const getCellValue = (p: Player, colIndex: number, rowIndex: number): string => {
    switch (colIndex) {
      case 0: return String(rowIndex + 1);
      case 1: return p.name ?? '';
      case 2: return p.birthYear != null ? String(p.birthYear) : '';
      case 3: return p.teamName ?? '';
      case 4: return p.category ?? '';
      case 5: return STATUS_LABELS[p.status] ?? p.status ?? '';
      case 6: return p.idealDemarcationId != null ? (demById.get(p.idealDemarcationId) ?? '') : '';
      case 7: return (p.possibleDemarcationIds ?? []).map((id) => demById.get(id) ?? '').filter(Boolean).join(', ');
      default: return '';
    }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Listado de jugadores – Pruebas de acceso', MARGIN_X, 9);

  // Thin line below title
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, 11, PAGE_W - MARGIN_X, 11);

  let y = MARGIN_TOP;
  y = drawHeader(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_ROW);

  players.forEach((p, rowIndex) => {
    if (y + ROW_H > PAGE_H - 8) {
      doc.addPage();
      y = MARGIN_TOP;
      y = drawHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE_ROW);
    }

    // Light separator line between rows
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, y + ROW_H, PAGE_W - MARGIN_X, y + ROW_H);

    doc.setTextColor(30, 30, 30);
    let x = MARGIN_X;
    COLS.forEach((col, colIndex) => {
      const w = col.width * scale;
      const cellText = getCellValue(p, colIndex, rowIndex);
      doc.text(cellText, x + 2, y + 4.5);
      x += w;
    });

    y += ROW_H;
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Página ${i} de ${pageCount}  ·  ${players.length} jugadores`,
      MARGIN_X,
      PAGE_H - 4,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`jugadores-pruebas-${date}.pdf`);
}
