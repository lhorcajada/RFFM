import jsPDF from "jspdf";
import type { PlayerRating } from "../../types/playerRating";
import { getAnswerLevel } from "../../types/playerRating";
import {
  getConceptForLevel,
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  getCategoryLabel,
  type CharacteristicDef,
} from "./rating/ratingConcepts";

// ─── Public types ─────────────────────────────────────────────────────────────

export type RatingSortKey = "physical" | "technical" | "tactical" | "competitiveness";

export type PdfPlayerEntry = {
  teamPlayerId: string;
  displayName: string;
  position?: string | null;
  dorsal?: number | null;
};

// ─── Sub-rating group definitions ─────────────────────────────────────────────

type SubItem = { key: string; label: string };

type RatGroup = {
  catKey: "physical" | "technical" | "tactical" | "competitiveness";
  catLabel: string;
  items: SubItem[];
};

const FIELD_GROUPS: RatGroup[] = [
  {
    catKey: "physical",
    catLabel: "Físico",
    items: [
      { key: "physicalSpeed", label: "Velocidad" },
      { key: "physicalEndurance", label: "Resistencia" },
      { key: "physicalStrength", label: "Fuerza" },
    ],
  },
  {
    catKey: "technical",
    catLabel: "Técnica",
    items: [
      { key: "technicalDribbling", label: "Regate" },
      { key: "technicalPassing", label: "Pase" },
      { key: "technicalControl", label: "Conducción" },
      { key: "technicalShooting", label: "Tiro" },
      { key: "technicalTackling", label: "Entradas" },
      { key: "technicalInterceptions", label: "Intercepciones" },
      { key: "technicalHeading", label: "Cabeceo" },
    ],
  },
  {
    catKey: "tactical",
    catLabel: "Táctica",
    items: [
      { key: "tacticalDefensiveAwareness", label: "Vigilancias def." },
      { key: "tacticalMarking", label: "Marcaje" },
      { key: "tacticalTrackBack", label: "Repliegue" },
      { key: "tacticalPressing", label: "Pressing" },
      { key: "tacticalGeneratesAdvantage", label: "Ventaja ataque" },
      { key: "tacticalOffMovement", label: "Desmarque" },
      { key: "tacticalBeatsOpponents", label: "Supera rivales" },
      { key: "tacticalAttackParticipation", label: "Partic. ataque" },
    ],
  },
  {
    catKey: "competitiveness",
    catLabel: "Competitividad",
    items: [
      { key: "competDuelWinning", label: "Ganar duelos" },
      { key: "competLooseBalls", label: "Bal. divididos" },
      { key: "competRecoveries", label: "Recuperaciones" },
      { key: "competDecisiveActions", label: "Acc. decisivas" },
      { key: "competResponsibility", label: "Responsabilidad" },
      { key: "competConstantEffort", label: "Esfuerzo const." },
    ],
  },
];

const KEEPER_GROUPS: RatGroup[] = [
  {
    catKey: "physical",
    catLabel: "Físico",
    items: [
      { key: "keeperReactionSpeed", label: "Reflejos/vel." },
      { key: "keeperAgility", label: "Agilidad" },
      { key: "keeperJumpPower", label: "Potencia salto" },
      { key: "keeperStrength", label: "Fuerza" },
      { key: "keeperEndurance", label: "Resistencia" },
    ],
  },
  {
    catKey: "technical",
    catLabel: "Técnica",
    items: [
      { key: "keeperHandSecurity", label: "Seguridad manos" },
      { key: "keeperSaves", label: "Paradas" },
      { key: "keeperAerialPlay", label: "Juego aéreo" },
      { key: "keeperHandDistribution", label: "Saque mano" },
      { key: "keeperKickDistribution", label: "Saque pie" },
      { key: "keeperFirstTouch", label: "Primer toque" },
      { key: "keeperPlayUnderPressure", label: "Bajo presión" },
    ],
  },
  {
    catKey: "tactical",
    catLabel: "Táctica",
    items: [
      { key: "keeperPositioning", label: "Colocación" },
      { key: "keeperGameReading", label: "Lectura de juego" },
      { key: "keeperOneOnOne", label: "1 contra 1" },
      { key: "keeperBackCoverage", label: "Cob. espalda" },
      { key: "keeperSallyTiming", label: "Timing salidas" },
      { key: "keeperBuildupPlay", label: "Salida balón" },
      { key: "keeperDefensiveOrganization", label: "Orden def." },
    ],
  },
  {
    catKey: "competitiveness",
    catLabel: "Competitividad",
    items: [
      { key: "keeperValor", label: "Valentía" },
      { key: "keeperConcentration", label: "Concentración" },
      { key: "keeperKeyMoments", label: "Momentos clave" },
      { key: "keeperErrorManagement", label: "Gestión error" },
      { key: "keeperResponsibility", label: "Responsabilidad" },
      { key: "keeperConsistency", label: "Regularidad" },
    ],
  },
];

// Groups arranged in left/right sub-column order: [Physical, Tactical] | [Technical, Competitiveness]
const LEFT_INDICES = [0, 2];
const RIGHT_INDICES = [1, 3];

// ─── Shared utilities ─────────────────────────────────────────────────────────

function isGoalkeeper(pos?: string | null): boolean {
  if (!pos) return false;
  const p = pos.toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

function positionCat(pos?: string | null): number {
  if (!pos) return 4;
  const p = pos.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (
    p.includes("defensa") || p.includes("central") || p.includes("lateral") ||
    p.includes("libero") || p.includes("stopper")
  ) return 1;
  if (
    p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") ||
    p.includes("interior") || p.includes("volante")
  ) return 2;
  if (
    p.includes("delantero") || p.includes("extremo") || p.includes("punta") ||
    p.includes("ariete") || p.includes("winger")
  ) return 3;
  return 4;
}

const POS_LABELS = ["Portero", "Defensa", "Centrocampista", "Delantero", "Sin posición"];

function sortedPlayers(players: PdfPlayerEntry[], sortKey?: RatingSortKey, latestRatings?: Record<string, PlayerRating>): PdfPlayerEntry[] {
  const base = [...players].sort((a, b) => {
    const ca = positionCat(a.position);
    const cb = positionCat(b.position);
    if (ca !== cb) return ca - cb;
    return (a.position ?? "").localeCompare(b.position ?? "", "es");
  });

  if (!sortKey || !latestRatings) return base;

  // Secondary sort within each position group by the chosen metric (desc)
  return base.sort((a, b) => {
    const ca = positionCat(a.position);
    const cb = positionCat(b.position);
    if (ca !== cb) return ca - cb;
    const ra = latestRatings[a.teamPlayerId];
    const rb = latestRatings[b.teamPlayerId];
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return Number(rb[sortKey]) - Number(ra[sortKey]);
  });
}

function calcAvg(r: PlayerRating): number {
  return (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
}

function fmtNum(v: number | null | undefined): string {
  return v != null ? String(Math.round(v)) : "—";
}

function fmtAvg(v: number): string {
  // Standard rounding to one decimal
  const rounded = Math.round(v * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

function scoreRgb(v: number): [number, number, number] {
  if (v >= 8.5) return [21, 101, 192];
  if (v >= 7) return [46, 125, 50];
  if (v >= 5) return [230, 81, 0];
  return [198, 40, 40];
}

function todayStr(): string {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeDateStr(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + "…") > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + "…";
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const MH = 25;  // horizontal margin (pts)
const MV = 25;  // vertical margin (pts)

// Card drawing constants
const GROUP_HEADER_H = 9;
const ITEM_H = 14;
const NAME_BAR_H = 16;
const AGG_BAR_H = 13;
const CARD_PAD_BOTTOM = 6;
const CARD_GAP = 7;  // gap between 2 side-by-side cards

// Concept-detail page constants (individual player PDF)
const CD_PAGE_HEADER_H = 18;
const CD_COL_GAP = 8;
const CD_GROUP_HEADER_H = 10;
const CD_CHAR_LABEL_H = 8;
const CD_LEVEL_ROW_H = 7;
const CD_BOX_W = 9;
const CD_BOX_H = 5;

// ─── Card height calculation ──────────────────────────────────────────────────

function subColH(groups: RatGroup[], indices: number[]): number {
  return indices.reduce(
    (sum, i) => sum + GROUP_HEADER_H + groups[i].items.length * ITEM_H,
    0,
  );
}

function calcCardHeight(rating: PlayerRating | null): number {
  if (!rating) return NAME_BAR_H + AGG_BAR_H + 18 + CARD_PAD_BOTTOM;

  if (rating.answers.length === 0) return NAME_BAR_H + AGG_BAR_H + 18 + CARD_PAD_BOTTOM;

  const groups = rating.isGoalkeeper ? KEEPER_GROUPS : FIELD_GROUPS;
  const subH = Math.max(subColH(groups, LEFT_INDICES), subColH(groups, RIGHT_INDICES));
  return NAME_BAR_H + AGG_BAR_H + subH + CARD_PAD_BOTTOM;
}

// ─── Card drawing ─────────────────────────────────────────────────────────────

function drawPlayerCard(
  doc: jsPDF,
  player: PdfPlayerEntry,
  rating: PlayerRating | null,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
): void {
  // Card outer border
  doc.setDrawColor(215, 215, 215);
  doc.setLineWidth(0.4);
  doc.setFillColor(252, 252, 252);
  doc.rect(x, y, cardW, cardH, "FD");

  // ── Name bar ──
  doc.setFillColor(200, 75, 0);
  doc.rect(x, y, cardW, NAME_BAR_H, "F");

  doc.setFont("helvetica", "bold");

  // Dorsal (small, left, accent color)
  const dorsalStr = player.dorsal != null ? `${player.dorsal}` : "";
  let nameX = x + 5;
  if (dorsalStr) {
    doc.setFontSize(7);
    doc.setTextColor(255, 215, 160);
    doc.text(dorsalStr, nameX, y + NAME_BAR_H - 4.5);
    nameX += doc.getTextWidth(dorsalStr) + 4;
  }

  // Player name
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const nameMaxW = cardW - (nameX - x) - (player.position ? cardW * 0.35 + 4 : 6);
  doc.text(truncate(doc, player.displayName, nameMaxW), nameX, y + NAME_BAR_H - 4.5);

  // Position (right-aligned, subtle)
  if (player.position) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(255, 195, 150);
    doc.text(
      truncate(doc, player.position, cardW * 0.34),
      x + cardW - 4,
      y + NAME_BAR_H - 4.5,
      { align: "right" },
    );
  }

  // ── Aggregate bar ──
  const aggY = y + NAME_BAR_H;
  doc.setFillColor(242, 242, 242);
  doc.rect(x, aggY, cardW, AGG_BAR_H, "F");
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(x, aggY + AGG_BAR_H, x + cardW, aggY + AGG_BAR_H);

  if (rating) {
    const aggW = cardW / 4;
    const aggItems = [
      { label: "FÍS", value: rating.physical },
      { label: "TÉC", value: rating.technical },
      { label: "TÁC", value: rating.tactical },
      { label: "COM", value: rating.competitiveness },
    ];
    for (let i = 0; i < aggItems.length; i++) {
      const { label, value } = aggItems[i];
      const ax = x + i * aggW;
      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(130, 130, 130);
      doc.text(label, ax + aggW / 2, aggY + 4.5, { align: "center" });
      // Value
      const [rr, gg, bb] = scoreRgb(value);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(rr, gg, bb);
      doc.text(fmtNum(value), ax + aggW / 2, aggY + AGG_BAR_H - 2.5, { align: "center" });
      // Vertical separator
      if (i < 3) {
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.3);
        doc.line(ax + aggW, aggY + 2, ax + aggW, aggY + AGG_BAR_H - 2);
      }
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 160);
    doc.text("Sin valoración", x + cardW / 2, aggY + AGG_BAR_H / 2 + 2.5, { align: "center" });
  }

  // ── Sub-ratings section ──
  const subY = y + NAME_BAR_H + AGG_BAR_H;
  if (!rating) return;

  if (rating.answers.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(170, 170, 170);
    doc.text("Sin desglose de subvaloraciones", x + cardW / 2, subY + 10, { align: "center" });
    return;
  }

  const groups = rating.isGoalkeeper ? KEEPER_GROUPS : FIELD_GROUPS;
  const subColWidth = (cardW - 5) / 2;
  const subColDefs = [
    { indices: LEFT_INDICES, x: x + 1 },
    { indices: RIGHT_INDICES, x: x + 1 + subColWidth + 3 },
  ];

  for (const col of subColDefs) {
    let cy = subY;
    for (const gi of col.indices) {
      const group = groups[gi];
      const aggVal = Number(rating[group.catKey as keyof typeof rating]);

      // Group header
      doc.setFillColor(228, 228, 228);
      doc.rect(col.x, cy, subColWidth, GROUP_HEADER_H, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(55, 55, 55);
      doc.text(group.catLabel, col.x + 3, cy + GROUP_HEADER_H - 2.5);
      const [hr, hg, hb] = scoreRgb(aggVal);
      doc.setTextColor(hr, hg, hb);
      doc.text(fmtNum(aggVal), col.x + subColWidth - 3, cy + GROUP_HEADER_H - 2.5, { align: "right" });
      cy += GROUP_HEADER_H;

      // Items
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      for (let ii = 0; ii < group.items.length; ii++) {
        const { key, label } = group.items[ii];
        const val = getAnswerLevel(rating, key);
        const bgEven = ii % 2 === 0;

        doc.setFillColor(bgEven ? 255 : 247, bgEven ? 255 : 247, bgEven ? 255 : 247);
        doc.rect(col.x, cy, subColWidth, ITEM_H, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(60, 60, 60);
        doc.text(truncate(doc, label, subColWidth - 20), col.x + 3, cy + 5);

        if (val != null) {
          const [vr, vg, vb] = scoreRgb(val);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(vr, vg, vb);
          doc.text(String(Math.round(val)), col.x + subColWidth - 3, cy + 5, { align: "right" });
          doc.setFont("helvetica", "normal");
          const concept = getConceptForLevel(key, Math.round(val));
          if (concept) {
            doc.setFontSize(5);
            doc.setTextColor(110, 110, 110);
            doc.text(truncate(doc, concept, subColWidth - 6), col.x + 3, cy + ITEM_H - 3);
          }
        } else {
          doc.setTextColor(185, 185, 185);
          doc.text("—", col.x + subColWidth - 3, cy + 5, { align: "right" });
        }

        cy += ITEM_H;
      }
    }
  }

  // Vertical divider between sub-columns
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  const divX = x + 1 + subColWidth + 1.5;
  const divH = Math.max(subColH(groups, LEFT_INDICES), subColH(groups, RIGHT_INDICES));
  doc.line(divX, subY, divX, subY + divH);
}

// ─── Concept detail pages (individual player PDF) ─────────────────────────────

function drawConceptGroup(
  doc: jsPDF,
  group: RatGroup,
  rating: PlayerRating,
  x: number,
  y: number,
  colW: number,
): void {
  let cy = y;
  const aggVal = Number(rating[group.catKey as keyof typeof rating]);
  const conceptMaxW = colW - CD_BOX_W - 4;

  // Group header
  doc.setFillColor(228, 228, 228);
  doc.rect(x, cy, colW, CD_GROUP_HEADER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(55, 55, 55);
  doc.text(group.catLabel.toUpperCase(), x + 4, cy + CD_GROUP_HEADER_H - 3);
  const [hr, hg, hb] = scoreRgb(aggVal);
  doc.setTextColor(hr, hg, hb);
  doc.text(fmtNum(aggVal), x + colW - 4, cy + CD_GROUP_HEADER_H - 3, { align: "right" });
  cy += CD_GROUP_HEADER_H;

  for (let ii = 0; ii < group.items.length; ii++) {
    const { key, label } = group.items[ii];
    const val = getAnswerLevel(rating, key);
    const selectedLevel = val != null ? Math.round(val) : null;
    const evenChar = ii % 2 === 0;

    // Characteristic label row
    doc.setFillColor(evenChar ? 245 : 240, evenChar ? 245 : 240, evenChar ? 245 : 240);
    doc.rect(x, cy, colW, CD_CHAR_LABEL_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(40, 40, 40);
    doc.text(label, x + 4, cy + CD_CHAR_LABEL_H - 2);
    if (selectedLevel != null) {
      const [sr, sg, sb] = scoreRgb(selectedLevel);
      doc.setTextColor(sr, sg, sb);
      doc.text(`• ${selectedLevel}`, x + colW - 4, cy + CD_CHAR_LABEL_H - 2, { align: "right" });
    } else {
      doc.setTextColor(185, 185, 185);
      doc.text("—", x + colW - 4, cy + CD_CHAR_LABEL_H - 2, { align: "right" });
    }
    cy += CD_CHAR_LABEL_H;

    // Level rows (1–10)
    for (let lvl = 1; lvl <= 10; lvl++) {
      const isSelected = selectedLevel === lvl;
      const concept = getConceptForLevel(key, lvl);
      const rowBg = lvl % 2 === 0 ? 252 : 255;
      doc.setFillColor(rowBg, rowBg, rowBg);
      doc.rect(x, cy, colW, CD_LEVEL_ROW_H, "F");

      const bx = x + 2;
      const boxY = cy + (CD_LEVEL_ROW_H - CD_BOX_H) / 2;
      const textY = cy + CD_LEVEL_ROW_H - 1.5;

      if (isSelected) {
        const [r, g, b] = scoreRgb(lvl);
        doc.setFillColor(r, g, b);
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.6);
        doc.rect(bx, boxY, CD_BOX_W, CD_BOX_H, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.text(String(lvl), bx + CD_BOX_W / 2, boxY + CD_BOX_H - 0.8, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(r, g, b);
        doc.text(truncate(doc, concept, conceptMaxW), x + CD_BOX_W + 4, textY);
      } else {
        doc.setFillColor(238, 238, 238);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(bx, boxY, CD_BOX_W, CD_BOX_H, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(160, 160, 160);
        doc.text(String(lvl), bx + CD_BOX_W / 2, boxY + CD_BOX_H - 0.8, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(175, 175, 175);
        doc.text(truncate(doc, concept, conceptMaxW), x + CD_BOX_W + 4, textY);
      }

      cy += CD_LEVEL_ROW_H;
    }
  }
}

function conceptGroupH(group: RatGroup): number {
  return CD_GROUP_HEADER_H + group.items.length * (CD_CHAR_LABEL_H + 10 * CD_LEVEL_ROW_H);
}

function addPlayerConceptPages(
  doc: jsPDF,
  player: PdfPlayerEntry,
  rating: PlayerRating,
  teamName?: string,
  firstPageY?: number,
): void {
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const colW = (CW - CD_COL_GAP) / 2;
  const groups = rating.isGoalkeeper ? KEEPER_GROUPS : FIELD_GROUPS;

  const pairs: [RatGroup, RatGroup][] = [
    [groups[0], groups[1]],
    [groups[2], groups[3]],
  ];

  for (let pi = 0; pi < pairs.length; pi++) {
    const [leftGroup, rightGroup] = pairs[pi];
    const pairH = Math.max(conceptGroupH(leftGroup), conceptGroupH(rightGroup));

    let y: number;
    if (pi === 0 && firstPageY != null) {
      // Check if it fits on the current page
      if (firstPageY + pairH <= PAGE_H - MV) {
        y = firstPageY;
      } else {
        doc.addPage();
        y = MV;
      }
    } else {
      doc.addPage();
      y = MV;
    }

    drawConceptGroup(doc, leftGroup, rating, MH, y, colW);
    drawConceptGroup(doc, rightGroup, rating, MH + colW + CD_COL_GAP, y, colW);
  }
}

// ─── Summary page ─────────────────────────────────────────────────────────────

function drawSummaryPage(
  doc: jsPDF,
  players: PdfPlayerEntry[],
  latestRatings: Record<string, PlayerRating>,
  teamName: string | undefined,
  sortKey?: RatingSortKey,
): void {
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const BOTTOM_LIMIT = PAGE_H - MV - 8;
  let y = MV;

  // Title block
  doc.setFillColor(30, 30, 30);
  doc.rect(MH, y, CW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("VALORACIONES DE LA PLANTILLA", W / 2, y + 14.5, { align: "center" });
  y += 22;

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const subtitle = teamName ? `${teamName}  ·  ${todayStr()}` : todayStr();
  doc.text(subtitle, W / 2, y + 8, { align: "center" });
  y += 16;

  // Table column definitions — widths sum exactly to CW = 545.28
  const cols = [
    { label: "#",        w: 18,    align: "center" as const },
    { label: "Jugador",  w: 148,   align: "left" as const },
    { label: "D.",       w: 32,    align: "center" as const },
    { label: "Posición", w: 80,    align: "left" as const },
    { label: "Físico",   w: 52.07, align: "center" as const },
    { label: "Técnica",  w: 52.07, align: "center" as const },
    { label: "Táctica",  w: 52.07, align: "center" as const },
    { label: "Compet.",  w: 52.07, align: "center" as const },
    { label: "Media",    w: 59,    align: "center" as const },
  ];

  const HEADER_H = 15;
  const ROW_H = 12;
  const POS_ROW_H = 13;

  function drawTableHeader(yy: number): void {
    doc.setFillColor(45, 45, 45);
    doc.rect(MH, yy, CW, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let cx = MH;
    for (const col of cols) {
      const tx = col.align === "center" ? cx + col.w / 2 : cx + 4;
      doc.text(col.label, tx, yy + HEADER_H - 4, { align: col.align });
      cx += col.w;
    }
  }

  // Highlight active sort column header
  if (sortKey) {
    const sortColIndex = ["physical", "technical", "tactical", "competitiveness"].indexOf(sortKey);
    if (sortColIndex >= 0) {
      const highlightCol = cols[4 + sortColIndex];
      let hx = MH;
      for (let ci = 0; ci < 4 + sortColIndex; ci++) hx += cols[ci].w;
      doc.setFillColor(200, 75, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
      doc.rect(hx, y, highlightCol.w, HEADER_H, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    }
  }

  drawTableHeader(y);
  y += HEADER_H;

  const sorted = sortedPlayers(players, sortKey, latestRatings);
  let rowIdx = 0;
  let currentCat = -1;

  for (const p of sorted) {
    const cat = positionCat(p.position);

    // Position group separator
    if (cat !== currentCat) {
      if (y + POS_ROW_H > BOTTOM_LIMIT) {
        doc.addPage();
        y = MV;
        drawTableHeader(y);
        y += HEADER_H;
      }
      doc.setFillColor(230, 230, 230);
      doc.rect(MH, y, CW, POS_ROW_H, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 60);
      doc.text(POS_LABELS[cat].toUpperCase(), MH + 6, y + 9);
      y += POS_ROW_H;
      currentCat = cat;
    }

    // Page overflow
    if (y + ROW_H > BOTTOM_LIMIT) {
      doc.addPage();
      y = MV;
      drawTableHeader(y);
      y += HEADER_H;
    }

    // Row background
    doc.setFillColor(rowIdx % 2 === 0 ? 251 : 255, rowIdx % 2 === 0 ? 251 : 255, rowIdx % 2 === 0 ? 251 : 255);
    doc.rect(MH, y, CW, ROW_H, "F");

    const r = latestRatings[p.teamPlayerId];
    const rowVals: string[] = [
      String(rowIdx + 1),
      p.displayName,
      p.dorsal != null ? String(p.dorsal) : "—",
      p.position ?? "—",
      r ? fmtNum(r.physical) : "—",
      r ? fmtNum(r.technical) : "—",
      r ? fmtNum(r.tactical) : "—",
      r ? fmtNum(r.competitiveness) : "—",
      r ? fmtAvg(calcAvg(r)) : "—",
    ];

    let cx = MH;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const val = rowVals[i];

      if (i >= 4 && r && val !== "—") {
        const numVal = parseFloat(val);
        const [rr, gg, bb] = scoreRgb(numVal);
        doc.setTextColor(rr, gg, bb);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
      } else {
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
      }

      const display = truncate(doc, val, col.w - 6);
      const tx = col.align === "center" ? cx + col.w / 2 : cx + 4;
      doc.text(display, tx, y + ROW_H - 3, { align: col.align });
      cx += col.w;
    }

    // Row divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(MH, y + ROW_H, MH + CW, y + ROW_H);

    y += ROW_H;
    rowIdx++;
  }

  // Footer count
  y += 5;
  if (y + 10 > PAGE_H - MV) {
    doc.addPage();
    y = MV;
  }
  const rated = players.filter((p) => latestRatings[p.teamPlayerId]).length;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${players.length} jugador${players.length !== 1 ? "es" : ""}  ·  ${rated} valorado${rated !== 1 ? "s" : ""}`,
    MH,
    y + 6,
  );
}

// ─── Detail pages (2 cards per row) ──────────────────────────────────────────

function drawDetailPages(
  doc: jsPDF,
  players: PdfPlayerEntry[],
  latestRatings: Record<string, PlayerRating>,
  teamName: string | undefined,
  sortKey?: RatingSortKey,
): void {
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const CARD_W = (CW - CARD_GAP) / 2;
  const BOTTOM_LIMIT = PAGE_H - MV - 6;

  const PAGE_HEADER_H = 20;
  const PAGE_HEADER_INNER = 6; // gap after header

  function startNewPage(): number {
    doc.addPage();
    const yy = MV;
    doc.setFillColor(30, 30, 30);
    doc.rect(MH, yy, CW, PAGE_HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Valoraciones detalladas", MH + 6, yy + PAGE_HEADER_H - 6);
    if (teamName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text(teamName, W - MH - 4, yy + PAGE_HEADER_H - 6, { align: "right" });
    }
    return yy + PAGE_HEADER_H + PAGE_HEADER_INNER;
  }

  const sorted = sortedPlayers(players, sortKey, latestRatings);
  let y = 0;
  let firstPage = true;

  for (let i = 0; i < sorted.length; i += 2) {
    const left = sorted[i];
    const right = i + 1 < sorted.length ? sorted[i + 1] : null;

    const leftRating = latestRatings[left.teamPlayerId] ?? null;
    const rightRating = right ? (latestRatings[right.teamPlayerId] ?? null) : null;

    const rowH = Math.max(
      calcCardHeight(leftRating),
      right ? calcCardHeight(rightRating) : 0,
    );

    if (firstPage || y + rowH > BOTTOM_LIMIT) {
      y = startNewPage();
      firstPage = false;
    }

    drawPlayerCard(doc, left, leftRating, MH, y, CARD_W, rowH);

    if (right !== null) {
      drawPlayerCard(doc, right, rightRating, MH + CARD_W + CARD_GAP, y, CARD_W, rowH);
    }

    y += rowH + 5;
  }
}

// ─── Concepts legend pages ───────────────────────────────────────────────────

function drawConceptsLegendPages(doc: jsPDF, teamName?: string): void {
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const COL_GAP = 8;
  const COL_W = (CW - COL_GAP) / 2;
  const BOTTOM_LIMIT = PAGE_H - MV - 8;

  const SECTION_H = 16;   // section title bar
  const CHAR_HDR_H = 11;  // characteristic header
  const LEVEL_H = 8;      // each level row
  const CHAR_H = CHAR_HDR_H + 10 * LEVEL_H; // total height per characteristic

  const sections: { title: string; chars: CharacteristicDef[] }[] = [
    { title: "JUGADORES DE CAMPO", chars: FIELD_PLAYER_CHARACTERISTICS },
    { title: "PORTEROS", chars: GOALKEEPER_CHARACTERISTICS },
  ];

  function startPage(): number {
    doc.addPage();
    const yy = MV;
    doc.setFillColor(30, 30, 30);
    doc.rect(MH, yy, CW, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Guía de conceptos de valoración", MH + 6, yy + 13);
    if (teamName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text(teamName, W - MH - 4, yy + 13, { align: "right" });
    }
    return yy + 20 + 6;
  }

  let y = startPage();
  // Two-column cursor
  let colIdx = 0;
  const colX = [MH, MH + COL_W + COL_GAP];
  let colY = [y, y];

  function advanceToNextCol(): void {
    if (colIdx === 0) {
      colIdx = 1;
    } else {
      colIdx = 0;
      y = startPage();
      colY = [y, y];
    }
  }

  function needsNewColOrPage(neededH: number): void {
    if (colY[colIdx] + neededH > BOTTOM_LIMIT) {
      advanceToNextCol();
    }
  }

  for (const section of sections) {
    // Group characteristics by category
    const byCategory = new Map<string, CharacteristicDef[]>();
    for (const ch of section.chars) {
      const k = ch.categoryKey;
      if (!byCategory.has(k)) byCategory.set(k, []);
      byCategory.get(k)!.push(ch);
    }

    for (const [catKey, chars] of byCategory) {
      // Section header for this category
      needsNewColOrPage(SECTION_H + CHAR_H);
      const cx = colX[colIdx];
      let cy = colY[colIdx];

      doc.setFillColor(45, 45, 45);
      doc.rect(cx, cy, COL_W, SECTION_H, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `${section.title} — ${getCategoryLabel(catKey as any).toUpperCase()}`,
        cx + 5,
        cy + SECTION_H - 4,
      );
      cy += SECTION_H;
      colY[colIdx] = cy;

      for (const char of chars) {
        needsNewColOrPage(CHAR_H);
        const cx2 = colX[colIdx];
        let cy2 = colY[colIdx];

        // Characteristic header
        doc.setFillColor(210, 210, 210);
        doc.rect(cx2, cy2, COL_W, CHAR_HDR_H, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(30, 30, 30);
        doc.text(char.label, cx2 + 4, cy2 + CHAR_HDR_H - 3);
        cy2 += CHAR_HDR_H;

        // 10 levels
        for (const lv of char.levels) {
          const bg = lv.level % 2 === 0 ? 252 : 246;
          doc.setFillColor(bg, bg, bg);
          doc.rect(cx2, cy2, COL_W, LEVEL_H, "F");

          // Level badge
          const [lr, lg, lb] = scoreRgb(lv.level);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(lr, lg, lb);
          doc.text(String(lv.level), cx2 + 4, cy2 + LEVEL_H - 2);

          // Concept text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          doc.setTextColor(55, 55, 55);
          doc.text(
            truncate(doc, lv.concept, COL_W - 14),
            cx2 + 12,
            cy2 + LEVEL_H - 2,
          );

          cy2 += LEVEL_H;
        }

        // Border around characteristic
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(cx2, colY[colIdx], COL_W, CHAR_H, "S");

        colY[colIdx] = cy2 + 3;
      }
    }
  }
}

// ─── Page numbers ─────────────────────────────────────────────────────────────

function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(165, 165, 165);
    doc.text(`${p} / ${total}`, W / 2, H - 10, { align: "center" });
  }
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
}

// ─── Public export functions ──────────────────────────────────────────────────

export function exportAllPlayersPdf(
  players: PdfPlayerEntry[],
  latestRatings: Record<string, PlayerRating>,
  teamName?: string,
  sortKey?: RatingSortKey,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  drawSummaryPage(doc, players, latestRatings, teamName, sortKey);
  drawDetailPages(doc, players, latestRatings, teamName, sortKey);
  drawConceptsLegendPages(doc, teamName);
  addPageNumbers(doc);
  const datePart = todayStr().replace(/\//g, "-");
  const namePart = teamName ? safeFilename(teamName) : "plantilla";
  doc.save(`valoraciones_${namePart}_${datePart}.pdf`);
}

export function exportPlayerPdf(
  player: PdfPlayerEntry,
  rating: PlayerRating | null,
  teamName?: string,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 2 * MH;
  let y = MV;

  // Page header
  doc.setFillColor(30, 30, 30);
  doc.rect(MH, y, CW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(truncate(doc, player.displayName, CW * 0.6), MH + 6, y + 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  const headerRight = teamName ? `${teamName}  ·  ${todayStr()}` : todayStr();
  doc.text(headerRight, W - MH - 4, y + 14.5, { align: "right" });
  y += 22;

  // Info row: dorsal · position · rated date
  const infoH = 15;
  doc.setFillColor(242, 242, 242);
  doc.rect(MH, y, CW, infoH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  const infoParts = [
    player.dorsal != null ? `Dorsal: ${player.dorsal}` : null,
    player.position ? `Posición: ${player.position}` : null,
    rating ? `Valorado: ${safeDateStr(rating.ratedAt)}` : "Sin valoración registrada",
  ].filter(Boolean);
  doc.text(infoParts.join("    ·    "), MH + 6, y + infoH - 4);
  y += infoH + 8;

  // Notes (on first page, below header)
  if (rating?.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Notas", MH, y + 6);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(rating.notes, CW - 6) as string[];
    doc.text(noteLines, MH + 4, y);
  }

  // Concept detail pages: all levels + descriptions per characteristic
  if (rating) {
    addPlayerConceptPages(doc, player, rating, teamName, y);
  }
  addPageNumbers(doc);
  const datePart = todayStr().replace(/\//g, "-");
  doc.save(`valoracion_${safeFilename(player.displayName)}_${datePart}.pdf`);
}
