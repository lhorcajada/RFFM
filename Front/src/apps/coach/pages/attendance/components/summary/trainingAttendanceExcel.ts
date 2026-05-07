import ExcelJS from "exceljs";
import type { PlayerTrainingSummary } from "./types";

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return value / total;
}

function applyFill(cell: ExcelJS.Cell, color: string): void {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
}

export async function exportTrainingAttendanceToExcel(
  rows: PlayerTrainingSummary[],
  teamName?: string | null,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFFM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Entrenamientos");
  sheet.properties.defaultRowHeight = 22;
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.columns = [
    { key: "playerName", width: 34 },
    { key: "totalTrainings", width: 12 },
    { key: "attendedTrainings", width: 12 },
    { key: "absentTrainings", width: 14 },
    { key: "pendingTrainings", width: 12 },
    { key: "attendanceRate", width: 14 },
  ];
  const headers = ["Jugador", "Totales", "Asistidos", "No asistidos", "Pendientes", "% Asistencia"];

  const titleColor = "FF1F4E79";
  const accentGreen = "FF4CAF50";
  const accentOrange = "FFFF9800";
  const accentRed = "FFF44336";
  const accentGray = "FF9E9E9E";
  const surfaceLight = "FFF2F7FC";
  const surfaceWhite = "FFFFFFFF";
  const textDark = "FF1F1F1F";
  const textLight = "FFFFFFFF";

  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Informe de entrenamientos${teamName ? ` - ${teamName}` : ""}`;
  titleCell.font = { bold: true, size: 16, color: { argb: textLight } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  applyFill(titleCell, titleColor);

  sheet.mergeCells("A2:F2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `Generado el ${formatGeneratedAt(new Date())}`;
  subtitleCell.font = { size: 10, color: { argb: textLight } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
  applyFill(subtitleCell, titleColor);

  sheet.mergeCells("A3:F3");
  const infoCell = sheet.getCell("A3");
  infoCell.value = "Resumen por jugador. El detalle de las no asistencias no se incluye en este informe.";
  infoCell.font = { italic: true, size: 10, color: { argb: textLight } };
  infoCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  applyFill(infoCell, titleColor);

  const headerRow = sheet.getRow(4);
  headerRow.height = 24;
  const headerColors = [titleColor, accentGreen, accentGreen, accentOrange, accentGray, accentRed];
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10, color: { argb: textLight } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB8C7D9" } },
      left: { style: "thin", color: { argb: "FFB8C7D9" } },
      bottom: { style: "thin", color: { argb: "FFB8C7D9" } },
      right: { style: "thin", color: { argb: "FFB8C7D9" } },
    };
    applyFill(cell, headerColors[index] ?? titleColor);
  });

  rows.forEach((row, index) => {
    const rowNumber = sheet.addRow({
      playerName: row.playerName,
      totalTrainings: row.totalTrainings,
      attendedTrainings: row.attendedTrainings,
      absentTrainings: row.absentTrainings,
      pendingTrainings: row.pendingTrainings,
      attendanceRate: `${Math.round(toPercent(row.attendedTrainings, row.totalTrainings) * 100)}%`,
    });

    rowNumber.height = 22;
    const fillColor = index % 2 === 0 ? surfaceLight : surfaceWhite;

    rowNumber.eachCell((cell, columnNumber) => {
      applyFill(cell, fillColor);
      cell.font = { color: { argb: textDark }, size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE3EAF2" } },
        left: { style: "thin", color: { argb: "FFE3EAF2" } },
        bottom: { style: "thin", color: { argb: "FFE3EAF2" } },
        right: { style: "thin", color: { argb: "FFE3EAF2" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber === 1 ? "left" : "center",
      };
    });
  });

  sheet.getRow(4).font = { bold: true, color: { argb: textLight } };
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 6 } };

  const fileName = sanitizeFileName(`informe_entrenamientos${teamName ? `_${teamName}` : ""}.xlsx`);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}