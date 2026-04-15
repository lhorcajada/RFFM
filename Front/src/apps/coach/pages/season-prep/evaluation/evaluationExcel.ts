import ExcelJS from "exceljs";
import type { PoolPlayer, PlayerEvaluation, AttributeScore } from "../SeasonPrep";

// â”€â”€ Attribute column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type AttrDef = { key: keyof Omit<PlayerEvaluation, "notes">; label: string; group: string; groupColor: string };

const GK_ATTRS: AttrDef[] = [
  // Físico
  { key: "velocidad",        label: "Velocidad",          group: "Físico",         groupColor: "2E75B6" },
  { key: "reflejos",         label: "Reflejos",           group: "Físico",         groupColor: "2E75B6" },
  { key: "altura",           label: "Altura",             group: "Físico",         groupColor: "2E75B6" },
  // Técnica
  { key: "blocajes",         label: "Blocajes",           group: "Técnica",        groupColor: "7030A0" },
  { key: "rechaces",         label: "Rechaces",           group: "Técnica",        groupColor: "7030A0" },
  { key: "desvios",          label: "Desvíos",            group: "Técnica",        groupColor: "7030A0" },
  { key: "prolongaciones",   label: "Prolongaciones",     group: "Técnica",        groupColor: "7030A0" },
  { key: "salto",            label: "Salto",              group: "Técnica",        groupColor: "7030A0" },
  { key: "controlOrientado", label: "Control orientado",  group: "Técnica",        groupColor: "7030A0" },
  { key: "saqueLargo",       label: "Saque en largo",     group: "Técnica",        groupColor: "7030A0" },
  { key: "saqueMano",        label: "Saque con la mano",  group: "Técnica",        groupColor: "7030A0" },
  // Competitividad
  { key: "unVsUno",          label: "1 vs 1",             group: "Competitividad",  groupColor: "C55A11" },
  { key: "balonesAereos",    label: "Balones aéreos",    group: "Competitividad",  groupColor: "C55A11" },
  { key: "valentia",         label: "Valentía",           group: "Competitividad",  groupColor: "C55A11" },
];

const FP_ATTRS: AttrDef[] = [
  // Defensa
  { key: "valentia",           label: "Valentía",            group: "Defensa",  groupColor: "C00000" },
  { key: "duelosGanados",      label: "Ganador de duelos",   group: "Defensa",  groupColor: "C00000" },
  { key: "balonesDivididos",   label: "Balones divididos",   group: "Defensa",  groupColor: "C00000" },
  { key: "marcajeFerreo",      label: "Marcaje férreo",      group: "Defensa",  groupColor: "C00000" },
  { key: "pressingTrasPerdida",label: "Pressing tras pérdida",group: "Defensa",  groupColor: "C00000" },
  // Ataque
  { key: "visionDeJuego",      label: "Visión de juego",     group: "Ataque",   groupColor: "375623" },
  { key: "atraviesaLineas",    label: "Atraviesa líneas",    group: "Ataque",   groupColor: "375623" },
  { key: "centrosLargos",      label: "Centros largos",      group: "Ataque",   groupColor: "375623" },
  { key: "tiroAPuerta",        label: "Tiro a puerta",       group: "Ataque",   groupColor: "375623" },
  { key: "segundasJugadas",    label: "Segundas jugadas",    group: "Ataque",   groupColor: "375623" },
  { key: "controlOrientado",   label: "Control orientado",   group: "Ataque",   groupColor: "375623" },
  // Físico
  { key: "velocidad",          label: "Velocidad",           group: "Físico",  groupColor: "2E75B6" },
  { key: "fuerza",             label: "Fuerza",              group: "Físico",  groupColor: "2E75B6" },
  { key: "altura",             label: "Altura",              group: "Físico",  groupColor: "2E75B6" },
];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function playerIsGk(p: PoolPlayer): boolean {
  if (p.isGoalkeeper) return true;
  const pos = p.position?.toLowerCase() ?? "";
  return pos.includes("portero") || pos.includes("keeper") || pos.includes("arquero");
}

function positionRank(pos: string): number {
  const p = pos.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 99;
}

function sortPlayers(players: PoolPlayer[]): PoolPlayer[] {
  return [...players].sort((a, b) => {
    const teamCmp = (a.team ?? "").localeCompare(b.team ?? "", "es");
    if (teamCmp !== 0) return teamCmp;
    const posA = positionRank(a.position ?? "");
    const posB = positionRank(b.position ?? "");
    if (posA !== posB) return posA - posB;
    return (a.name ?? "").localeCompare(b.name ?? "", "es");
  });
}

// â”€â”€ Build worksheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCORES_LIST = '"1,2,3,4,5,6,7,8,9,10"';

const STATIC_COLS = [
  { header: "uniqueId",     key: "uid",      width: 0,  hidden: true  },
  { header: "Equipo",       key: "team",     width: 22, hidden: false },
  { header: "Dorsal",       key: "dorsal",   width: 9,  hidden: false },
  { header: "Nombre",       key: "name",     width: 26, hidden: false },
  { header: "Demarcación",  key: "position", width: 18, hidden: false },
];

async function buildWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  players: PoolPlayer[],
  attrs: AttrDef[]
): Promise<void> {
  const ws = workbook.addWorksheet(sheetName);

  // Column definitions
  ws.columns = [
    ...STATIC_COLS.map((c) => ({ header: c.header, key: c.key, width: c.hidden ? 0.1 : c.width })),
    ...attrs.map((a) => ({ header: a.label, key: a.key, width: 14 })),
    { header: "Notas", key: "notes", width: 35 },
  ];

  // Hide uniqueId column (col 1)
  const uidCol = ws.getColumn(1);
  uidCol.hidden = true;
  uidCol.width = 0.1;

  // Style header row with group colors
  const headerRow = ws.getRow(1);
  headerRow.height = 32;

  // Static columns header style
  const STATIC_HEADER_COLOR = "1F4E79";
  for (let ci = 1; ci <= STATIC_COLS.length; ci++) {
    const cell = headerRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + STATIC_HEADER_COLOR } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } } };
  }

  // Eval columns header style (group color)
  attrs.forEach((a, i) => {
    const ci = STATIC_COLS.length + 1 + i;
    const cell = headerRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + a.groupColor } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } } };
  });

  // Notes column header
  const notesHeaderCell = headerRow.getCell(STATIC_COLS.length + attrs.length + 1);
  notesHeaderCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  notesHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + STATIC_HEADER_COLOR } };
  notesHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

  // Freeze first row
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 4 }];

  // Add data rows
  const sorted = sortPlayers(players);
  sorted.forEach((p, rowIdx) => {
    const ev = p.evaluation ?? {};
    const rowData: Record<string, string | number> = {
      uid:      p.uniqueId,
      team:     p.team ?? p.procedencia ?? "",
      dorsal:   p.jerseyNumber ?? "",
      name:     p.name,
      position: p.position ?? "",
      notes:    ev.notes ?? "",
    };
    attrs.forEach((a) => {
      const val = ev[a.key] as AttributeScore | undefined;
      rowData[a.key] = val ?? "";
    });

    const row = ws.addRow(rowData);
    row.height = 28;

    // Alternating row color
    const rowBg = rowIdx % 2 === 0 ? "F2F7FC" : "FFFFFF";
    for (let ci = 1; ci <= STATIC_COLS.length; ci++) {
      const cell = row.getCell(ci);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + rowBg } };
      cell.font = { color: { argb: "FF1F1F1F" } };
      cell.alignment = { vertical: "middle", horizontal: ci <= 2 ? "left" : "center" };
    }

    // Eval cells: dropdown + alternating bg
    attrs.forEach((_a, i) => {
      const ci = STATIC_COLS.length + 1 + i;
      const cell = row.getCell(ci);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + rowBg } };
      cell.font = { bold: true, color: { argb: "FF1F1F1F" }, size: 13 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.dataValidation = {
        type: "list",
        formulae: [SCORES_LIST],
        allowBlank: true,
        showErrorMessage: false,
        showInputMessage: true,
        promptTitle: "Valoración",
        prompt: "Selecciona del 1 (Insuficiente) al 10 (Sobresaliente)",
      };
    });

    // Notes cell
    const notesCell = row.getCell(STATIC_COLS.length + attrs.length + 1);
    notesCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + rowBg } };
    notesCell.font = { color: { argb: "FF1F1F1F" } };
    notesCell.alignment = { vertical: "middle", wrapText: true };
  });

  // Auto-filter (skip hidden col)
  ws.autoFilter = {
    from: { row: 1, column: 2 },
    to:   { row: 1, column: STATIC_COLS.length + attrs.length + 1 },
  };
}

// â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function exportEvaluationsToExcel(
  players: PoolPlayer[],
  fedSeason: string
): Promise<void> {
  const eligible = players.filter((p) => p.assignment === "eligible");
  const gkPlayers = eligible.filter(playerIsGk);
  const fpPlayers = eligible.filter((p) => !playerIsGk(p));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFFM";
  workbook.created = new Date();

  await buildWorksheet(workbook, "Porteros", gkPlayers, GK_ATTRS);
  await buildWorksheet(workbook, "Jugadores", fpPlayers, FP_ATTRS);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evaluaciones_${fedSeason || "temporada"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// â”€â”€ Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ImportResult = {
  updated: number;
  unknown: string[];
};

export function importEvaluationsFromExcel(
  file: File,
  currentPlayers: PoolPlayer[],
  onDone: (updated: PoolPlayer[], result: ImportResult) => void
): void {
  // Use exceljs to read (consistent with the writer)
  file.arrayBuffer().then((buffer) => {
    const workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(buffer).then(() => {
      const allAttrs = [...GK_ATTRS, ...FP_ATTRS];
      const attrByLabel = new Map<string, AttrDef>();
      allAttrs.forEach((a) => attrByLabel.set(a.label.toLowerCase(), a));

      const updatedMap = new Map(currentPlayers.map((p) => [p.uniqueId, { ...p }]));
      let updatedCount = 0;
      const unknownNames: string[] = [];

      workbook.eachSheet((ws) => {
        const rows: ExcelJS.Row[] = [];
        ws.eachRow((row) => rows.push(row));
        if (rows.length < 2) return;

        // Parse header row
        const headerRow = rows[0];
        const headerMap = new Map<number, string>(); // colNumber â†’ label lowercase
        headerRow.eachCell((cell, colNumber) => {
          headerMap.set(colNumber, String(cell.value ?? "").toLowerCase().trim());
        });

        const uidCol = [...headerMap.entries()].find(([, v]) => v === "uniqueid")?.[0];
        const nameCol = [...headerMap.entries()].find(([, v]) => v === "nombre")?.[0];
        const notesCol = [...headerMap.entries()].find(([, v]) => v === "notas")?.[0];
        const colAttr = new Map<number, AttrDef>();
        headerMap.forEach((label, col) => {
          const def = attrByLabel.get(label);
          if (def) colAttr.set(col, def);
        });

        for (let ri = 1; ri < rows.length; ri++) {
          const row = rows[ri];
          const uid = uidCol ? String(row.getCell(uidCol).value ?? "").trim() : "";
          const name = nameCol ? String(row.getCell(nameCol).value ?? "").trim() : "";

          let player = uid ? updatedMap.get(uid) : undefined;
          if (!player) {
            player = [...updatedMap.values()].find(
              (p) => p.name.toLowerCase().trim() === name.toLowerCase()
            );
          }
          if (!player) {
            if (name) unknownNames.push(name);
            continue;
          }

          const ev: PlayerEvaluation = { ...(player.evaluation ?? {}) };
          colAttr.forEach((def, col) => {
            const raw = row.getCell(col).value;
            const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
            if (n >= 1 && n <= 10) {
              (ev as Record<string, unknown>)[def.key] = n as AttributeScore;
            } else if (raw === null || raw === "") {
              delete (ev as Record<string, unknown>)[def.key];
            }
          });
          if (notesCol) {
            const notes = String(row.getCell(notesCol).value ?? "").trim();
            ev.notes = notes || undefined;
          }

          updatedMap.set(player.uniqueId, { ...player, evaluation: ev });
          updatedCount++;
        }
      });

      onDone(
        [...updatedMap.values()],
        { updated: updatedCount, unknown: [...new Set(unknownNames)] }
      );
    }).catch(() => onDone(currentPlayers, { updated: 0, unknown: [] }));
  }).catch(() => onDone(currentPlayers, { updated: 0, unknown: [] }));
}

