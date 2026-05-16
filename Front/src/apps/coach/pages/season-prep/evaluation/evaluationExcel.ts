import ExcelJS from "exceljs";
import type { PoolPlayer, RecruitmentStatus } from "../SeasonPrep";
import type { PlayerRating } from "../../../../types/playerRating";
import { FP_ALL_CONCEPTS, GK_ALL_CONCEPTS, getConceptForLevel, playerIsGk, type CharacteristicDef } from "./evaluationConstants";

type RatingCategory = "physical" | "technical" | "tactical" | "competitiveness";

function roundUpToOneDecimal(value: number): number {
  return Math.ceil(value * 10) / 10;
}

function emptyRating(playerId: string, isGoalkeeper: boolean): PlayerRating {
  return {
    id: `draft-${playerId}`,
    teamPlayerId: playerId,
    isGoalkeeper,
    physical: 0,
    technical: 0,
    tactical: 0,
    competitiveness: 0,
    answers: [],
    ratedAt: new Date().toISOString(),
    notes: null,
  };
}

function buildRating(playerId: string, isGoalkeeper: boolean, answers: PlayerRating["answers"], notes?: string | null, ratedAt?: string): PlayerRating {
  const byCategory = (categoryKey: RatingCategory) => {
    const levels = answers.filter((a) => a.categoryKey === categoryKey).map((a) => a.level);
    return levels.length === 0 ? 0 : roundUpToOneDecimal(levels.reduce((sum, level) => sum + level, 0) / levels.length);
  };

  return {
    id: `draft-${playerId}`,
    teamPlayerId: playerId,
    isGoalkeeper,
    physical: byCategory("physical"),
    technical: byCategory("technical"),
    tactical: byCategory("tactical"),
    competitiveness: byCategory("competitiveness"),
    answers,
    ratedAt: ratedAt ?? new Date().toISOString(),
    notes: notes ?? null,
  };
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

const STATIC_COLS = [
  { header: "uniqueId", key: "uid", width: 0.1, hidden: true },
  { header: "Equipo", key: "team", width: 22 },
  { header: "Dorsal", key: "dorsal", width: 9 },
  { header: "Nombre", key: "name", width: 26 },
  { header: "Demarcación", key: "position", width: 18 },
  { header: "Estado", key: "status", width: 16 },
];

const HEADER_BG = "1F4E79";

async function buildConceptWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  players: PoolPlayer[],
  concepts: CharacteristicDef[],
  color: string
): Promise<void> {
  const ws = workbook.addWorksheet(sheetName);

  ws.columns = [
    ...STATIC_COLS.map((c) => ({ header: c.header, key: c.key, width: c.width })),
    ...concepts.map((c) => ({ header: c.label, key: c.key, width: 20 })),
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
  for (let i = 0; i < concepts.length; i++) {
    const cell = headerRow.getCell(STATIC_COLS.length + 1 + i);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  const notesHdr = headerRow.getCell(STATIC_COLS.length + concepts.length + 1);
  notesHdr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  notesHdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG } };
  notesHdr.alignment = { vertical: "middle", horizontal: "center" };

  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 4 }];

  const sorted = sortPlayers(players);
  sorted.forEach((p, rowIdx) => {
    const rating = p.rating ?? emptyRating(p.uniqueId, playerIsGk(p));
    const rowData: Record<string, string | number> = {
      uid: p.uniqueId,
      team: p.team ?? p.procedencia ?? "",
      dorsal: p.jerseyNumber ?? "",
      name: p.name,
      position: p.position ?? "",
      status: p.recruitmentStatus ?? "",
      notes: rating.notes ?? "",
    };

    for (const concept of concepts) {
      const answer = rating.answers.find((a) => a.characteristicKey === concept.key);
      rowData[concept.key] = answer?.level ?? "";
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
}

export async function exportEvaluationsToExcel(players: PoolPlayer[], fedSeason: string): Promise<void> {
  const eligible = players.filter((p) => p.assignment === "eligible");
  const fpPlayers = eligible.filter((p) => !playerIsGk(p));
  const gkPlayers = eligible.filter((p) => playerIsGk(p));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFFM";
  workbook.created = new Date();

  await buildConceptWorksheet(workbook, "Jugadores", fpPlayers, FP_ALL_CONCEPTS, "2E75B6");
  if (gkPlayers.length > 0) {
    await buildConceptWorksheet(workbook, "Porteros", gkPlayers, GK_ALL_CONCEPTS, "7B3F00");
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evaluaciones_${fedSeason || "temporada"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ImportResult = {
  updated: number;
  unknown: string[];
};

function extractLevel(raw: string): number | null {
  const match = raw.match(/(10|[1-9])/);
  if (!match) return null;
  const level = Number(match[1]);
  return level >= 1 && level <= 10 ? level : null;
}

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

        const uidCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "uniqueid")?.[0];
        const nameCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "nombre")?.[0];
        const notesCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "notas")?.[0];
        const statusCol = [...headerMap.entries()].find(([, v]) => v.toLowerCase() === "estado")?.[0];

        const concepts = [...FP_ALL_CONCEPTS, ...GK_ALL_CONCEPTS];
        const conceptColMap = new Map<number, CharacteristicDef>();
        headerMap.forEach((label, col) => {
          const concept = concepts.find((c) => c.label === label);
          if (concept) conceptColMap.set(col, concept);
        });

        for (let ri = 1; ri < rows.length; ri++) {
          const row = rows[ri];
          const uid = uidCol ? String(row.getCell(uidCol).value ?? "").trim() : "";
          const name = nameCol ? String(row.getCell(nameCol).value ?? "").trim() : "";

          let player = uid ? updatedMap.get(uid) : undefined;
          if (!player && name) {
            player = [...updatedMap.values()].find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
          }
          if (!player) {
            if (name) unknownNames.push(name);
            continue;
          }

          const isGk = playerIsGk(player);
          const answers: PlayerRating["answers"] = [];
          conceptColMap.forEach((concept, col) => {
            const raw = String(row.getCell(col).value ?? "").trim();
            const level = extractLevel(raw);
            if (!level) return;
            const conceptText = getConceptForLevel(concept, level) ?? raw;
            answers.push({
              characteristicKey: concept.key,
              categoryKey: concept.categoryKey,
              level,
              concept: conceptText,
            });
          });

          if (answers.length === 0) continue;

          const existing = player.rating;
          const rating = buildRating(player.uniqueId, isGk, answers, existing?.notes ?? undefined, existing?.ratedAt);
          const notes = notesCol ? String(row.getCell(notesCol).value ?? "").trim() : "";
          if (notes) rating.notes = notes;

          let mappedStatus: RecruitmentStatus | undefined;
          if (statusCol) {
            const rawStatus = String(row.getCell(statusCol).value ?? "").trim().toLowerCase();
            if (rawStatus.includes("observ")) mappedStatus = "observando";
            else if (rawStatus.includes("interes")) mappedStatus = "interesado";
            else if (rawStatus.includes("fich")) mappedStatus = "fichado";
            else if (rawStatus.includes("descar")) mappedStatus = "descartado";
          }

          updatedMap.set(player.uniqueId, { ...player, rating, recruitmentStatus: mappedStatus ?? player.recruitmentStatus });
          updatedCount++;
        }
      });

      onDone([...updatedMap.values()], { updated: updatedCount, unknown: [...new Set(unknownNames)] });
    }).catch(() => onDone(currentPlayers, { updated: 0, unknown: [] }));
  }).catch(() => onDone(currentPlayers, { updated: 0, unknown: [] }));
}