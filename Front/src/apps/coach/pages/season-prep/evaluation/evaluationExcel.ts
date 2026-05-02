import ExcelJS from "exceljs";
import type { PoolPlayer, PlayerEvaluation, ConceptEval } from "../SeasonPrep";
import { FP_ALL_CONCEPTS, GK_ALL_CONCEPTS } from "./evaluationConstants";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Build worksheet ───────────────────────────────────────────────────────────

const STATIC_COLS = [
  { header: "uniqueId",    key: "uid",      width: 0.1, hidden: true  },
  { header: "Equipo",      key: "team",     width: 22  },
  { header: "Dorsal",      key: "dorsal",   width: 9   },
  { header: "Nombre",      key: "name",     width: 26  },
  { header: "Demarcación", key: "position", width: 18  },
  { header: "Estado",      key: "status",   width: 16  },
];

const HEADER_BG = "1F4E79";

const FP_COLOR_BY_KEY: Record<string, string> = {
  valentiaDiv: "7B3F00",      duelos: "7B3F00",          segundasJugadas: "7B3F00",
  marcajeFerreo: "C00000",    pressingTrasPerdida: "C00000",
  controlOrientado: "375623", visionFiltrados: "375623",  finalizacionCentro: "375623",
  velocidadAccion: "2E75B6",  fuerzaUso: "2E75B6",       usoAltura: "2E75B6",
};

const GK_COLOR_BY_KEY: Record<string, string> = {
  seguridadManos: "1F4E79",       gestionRechace: "1F4E79",    reflejosReaccion: "1F4E79",
  valentiaSalidas: "843C0C",      dominioAereo: "843C0C",      duelos1v1Gk: "843C0C",
  juegosDePies: "375623",         precisionSaque: "375623",
  velocidadDesplazamiento: "2E75B6", potenciaSalto: "2E75B6",
};

// ── Build worksheet (generic) ─────────────────────────────────────────────────

import type { ConceptDef } from "./evaluationConstants";

async function buildConceptWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  players: PoolPlayer[],
  concepts: ConceptDef[],
  colorByKey: Record<string, string>
): Promise<void> {
  const ws = workbook.addWorksheet(sheetName);

  const conceptCols: { header: string; key: string; conceptKey: string }[] = [];
  for (const c of concepts) {
    conceptCols.push({ header: `${c.label} — Consistencia`, key: `${String(c.key)}_c`, conceptKey: String(c.key) });
    conceptCols.push({ header: `${c.label} — Tendencia`,    key: `${String(c.key)}_t`, conceptKey: String(c.key) });
  }

  ws.columns = [
    ...STATIC_COLS.map((c) => ({ header: c.header, key: c.key, width: c.width })),
    ...conceptCols.map((c) => ({ header: c.header, key: c.key, width: 20 })),
    { header: "Notas", key: "notes", width: 35 },
  ];
  ws.getColumn(1).hidden = true;

  const headerRow = ws.getRow(1);
  headerRow.height = 36;

  for (let ci = 1; ci <= STATIC_COLS.length; ci++) {
    const cell = headerRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  conceptCols.forEach((col, i) => {
    const ci = STATIC_COLS.length + 1 + i;
    const color = colorByKey[col.conceptKey] ?? "2E75B6";
    const cell = headerRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  const notesHdr = headerRow.getCell(STATIC_COLS.length + conceptCols.length + 1);
  notesHdr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  notesHdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG } };
  notesHdr.alignment = { vertical: "middle", horizontal: "center" };

  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 4 }];

  const sorted = sortPlayers(players);
  sorted.forEach((p, rowIdx) => {
    const ev = p.evaluation ?? {};
    const rowData: Record<string, string> = {
      uid:      p.uniqueId,
      team:     p.team ?? p.procedencia ?? "",
      dorsal:   p.jerseyNumber ?? "",
      name:     p.name,
      position: p.position ?? "",
      status:   p.recruitmentStatus ?? "",
      notes:    ev.notes ?? "",
    };
    for (const c of concepts) {
      const v = ev[c.key] as ConceptEval | undefined;
      rowData[`${String(c.key)}_c`] = v?.consistencia ?? "";
      rowData[`${String(c.key)}_t`] = v?.tendencia ?? "";
    }

    const row = ws.addRow(rowData);
    row.height = 26;
    const rowBg = rowIdx % 2 === 0 ? "F2F7FC" : "FFFFFF";
    for (let ci = 1; ci <= ws.columnCount; ci++) {
      const cell = row.getCell(ci);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + rowBg } };
      cell.font = { color: { argb: "FF1F1F1F" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: ci <= STATIC_COLS.length ? "left" : "center" };
    }
  });

  ws.autoFilter = { from: { row: 1, column: 2 }, to: { row: 1, column: ws.columnCount } };

  // Add data validation (dropdown lists) per concept column using concept definitions
  for (let i = 0; i < conceptCols.length; i++) {
    const colIndex = STATIC_COLS.length + 1 + i; // 1-based column index in worksheet
    const colDef = conceptCols[i];
    const conceptKey = colDef.conceptKey;
    const isConsistencia = String(colDef.key).endsWith("_c");
    const conceptDef = concepts.find((c) => String(c.key) === conceptKey);
    const options = isConsistencia
      ? conceptDef?.consistenciaOptions
      : conceptDef?.tendenciaOptions;
    if (!options || options.length === 0) continue;
    const formula = `"${options.join(",")}"`;
    for (let r = 2; r <= ws.rowCount; r++) {
      const cell = ws.getRow(r).getCell(colIndex);
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          showInputMessage: true,
          showErrorMessage: true,
          formulae: [formula],
        } as unknown;
      } catch {
        // ignore per-cell validation errors
      }
    }
  }

  // Add data validation for the recruitment status column (Estado)
  const statusColIndex = STATIC_COLS.findIndex((c) => c.key === "status") + 1;
  if (statusColIndex > 0) {
    const statusOptions = ["Observando", "Interesado", "Fichado", "Descartado"];
    const statusFormula = `"${statusOptions.join(",")}"`;
    for (let r = 2; r <= ws.rowCount; r++) {
      const cell = ws.getRow(r).getCell(statusColIndex);
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          showInputMessage: true,
          showErrorMessage: true,
          formulae: [statusFormula],
        } as unknown;
      } catch {
        // ignore
      }
    }
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportEvaluationsToExcel(
  players: PoolPlayer[],
  fedSeason: string
): Promise<void> {
  const eligible = players.filter((p) => p.assignment === "eligible");
  const fpPlayers = eligible.filter((p) => !playerIsGk(p));
  const gkPlayers = eligible.filter((p) => playerIsGk(p));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFFM";
  workbook.created = new Date();

  await buildConceptWorksheet(workbook, "Jugadores", fpPlayers, FP_ALL_CONCEPTS, FP_COLOR_BY_KEY);
  if (gkPlayers.length > 0) {
    await buildConceptWorksheet(workbook, "Porteros", gkPlayers, GK_ALL_CONCEPTS, GK_COLOR_BY_KEY);
  }

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

// ── Import ────────────────────────────────────────────────────────────────────

export type ImportResult = {
  updated: number;
  unknown: string[];
};

export function importEvaluationsFromExcel(
  file: File,
  currentPlayers: PoolPlayer[],
  onDone: (updated: PoolPlayer[], result: ImportResult) => void
): void {
  file.arrayBuffer().then((buffer) => {
    const workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(buffer).then(() => {
      const updatedMap = new Map(currentPlayers.map((p) => [p.uniqueId, { ...p }]));
      let updatedCount = 0;
      const unknownNames: string[] = [];

      workbook.eachSheet((ws) => {
        const rows: ExcelJS.Row[] = [];
        ws.eachRow((row) => rows.push(row));
        if (rows.length < 2) return;

        const headerRow = rows[0];
        const headerMap = new Map<number, string>();
        headerRow.eachCell((cell, col) => {
          headerMap.set(col, String(cell.value ?? "").trim());
        });

        const uidCol   = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "uniqueid")?.[0];
        const nameCol  = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "nombre")?.[0];
        const notesCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "notas")?.[0];

        // Map header label → { conceptKey, dimension } (covers FP + GK)
        const allConcepts = [...FP_ALL_CONCEPTS, ...GK_ALL_CONCEPTS];
        const conceptColMap = new Map<number, { key: string; dim: "consistencia" | "tendencia" }>();
        headerMap.forEach((label, col) => {
          for (const c of allConcepts) {
            if (label === `${c.label} — Consistencia`) {
              conceptColMap.set(col, { key: String(c.key), dim: "consistencia" });
            } else if (label === `${c.label} — Tendencia`) {
              conceptColMap.set(col, { key: String(c.key), dim: "tendencia" });
            }
          }
        });

        for (let ri = 1; ri < rows.length; ri++) {
          const row = rows[ri];
          const uid  = uidCol  ? String(row.getCell(uidCol).value  ?? "").trim() : "";
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
            // determine status column index (if present)
            const statusCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "estado")?.[0];
          conceptColMap.forEach(({ key, dim }, col) => {
            const raw = String(row.getCell(col).value ?? "").trim();
            const existing = (ev as Record<string, unknown>)[key] as ConceptEval | undefined;
            if (raw) {
              // Normalize imported concept values to the allowed dropdown options
              const lr = raw.toLowerCase();
              let mapped = raw;
              if (lr.includes("nunc")) mapped = "Nunca";
              else if (lr.includes("rara")) mapped = "Rara vez";
              else if (lr.includes("inter")) mapped = "Intermitente";
              else if (lr.includes("habit")) mapped = "Habitual";
              (ev as Record<string, unknown>)[key] = { ...(existing ?? {}), [dim]: mapped };
            }
          });
          if (notesCol) {
            const notes = String(row.getCell(notesCol).value ?? "").trim();
            ev.notes = notes || undefined;
          }

          // read and map recruitment status (if provided)
          let mappedStatus: string | undefined = undefined;
          if (statusCol) {
            const rawStatus = String(row.getCell(statusCol).value ?? "").trim();
            const rs = rawStatus.toLowerCase();
            if (rs.includes("observ")) mappedStatus = "observando";
            else if (rs.includes("interes")) mappedStatus = "interesado";
            else if (rs.includes("fich")) mappedStatus = "fichado";
            else if (rs.includes("descar")) mappedStatus = "descartado";
          }

          updatedMap.set(player.uniqueId, { ...player, evaluation: ev, recruitmentStatus: mappedStatus ?? player.recruitmentStatus });
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
