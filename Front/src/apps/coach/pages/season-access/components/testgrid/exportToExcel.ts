// Avoid importing exceljs types (they reference Node libs) at top-level.
// Use a dynamic import at runtime so bundlers produce an ESM chunk and
// the browser doesn't need a `require` global.
import type { Player, Demarcation } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadExcelJS(): Promise<any> {
  const mod = await import('exceljs');
  // exceljs may export as default or as the module itself depending on bundler
  return (mod as any).default ?? mod;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const normCat = (s: string) =>
  s.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

/** Blend a CSS rgba() string over the app dark background and return ARGB hex. */
function blendWithDark(rgba: string): string {
  const base = { r: 21, g: 24, b: 44 }; // #15182c
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
  if (!m) return 'FF15182C';
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  const rr = Math.round(base.r * (1 - a) + r * a);
  const gg = Math.round(base.g * (1 - a) + g * a);
  const bb = Math.round(base.b * (1 - a) + b * a);
  return 'FF' + [rr, gg, bb].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/** Convert a #rrggbb hex to ARGB (fully opaque). */
const hexToArgb = (hex: string): string =>
  'FF' + hex.replace('#', '').toUpperCase();

// ── Color palette (mirrors CAT_COLORS in TestGrid.tsx) ────────────────────────

const CAT_COLORS: Record<string, [string, string]> = {
  'SUPERLIGA INFANTIL':                              ['rgba(0,200,83,0.24)',    '#00c853'],
  'DIVISION DE HONOR INFANTIL':                      ['rgba(0,230,118,0.22)',   '#00e676'],
  'PRIMERA DIVISION AUTONOMICA INFANTIL':            ['rgba(105,240,174,0.18)', '#69f0ae'],
  'PREFERENTE INFANTIL':                             ['rgba(102,187,106,0.18)', '#66bb6a'],
  'PRIMERA INFANTIL':                                ['rgba(129,199,132,0.16)', '#81c784'],
  'SEGUNDA INFANTIL':                                ['rgba(165,214,167,0.14)', '#a5d6a7'],
  'SUPERLIGA CADETE':                                ['rgba(0,131,143,0.26)',   '#00838f'],
  'DIVISION DE HONOR CADETE':                        ['rgba(0,188,212,0.24)',   '#00bcd4'],
  'PRIMERA DIVISION AUTONOMICA CADETE':              ['rgba(0,229,255,0.20)',   '#00e5ff'],
  'PREFERENTE CADETE':                               ['rgba(79,195,247,0.18)',  '#4fc3f7'],
  'PRIMERA CADETE':                                  ['rgba(129,212,250,0.16)', '#81d4fa'],
  'SEGUNDA CADETE':                                  ['rgba(144,202,249,0.14)', '#90caf9'],
  'NACIONAL JUVENIL':                                ['rgba(25,118,210,0.28)',  '#2196f3'],
  'FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL': ['rgba(33,150,243,0.24)', '#42a5f5'],
  'PRIMERA DIVISION AUTONOMICA JUVENIL':             ['rgba(77,157,224,0.22)',  '#4d9de0'],
  'PREFERENTE JUVENIL':                              ['rgba(100,181,246,0.20)', '#64b5f6'],
  'PRIMERA JUVENIL':                                 ['rgba(144,202,249,0.18)', '#90caf9'],
  'SEGUNDA JUVENIL':                                 ['rgba(187,222,251,0.14)', '#bbdefb'],
  'SUPERLIGA ALEVIN':                                ['rgba(255,143,0,0.26)',   '#ff8f00'],
  'DIVISION DE HONOR ALEVIN':                        ['rgba(255,160,0,0.24)',   '#ffa000'],
  'PRIMERA DIVISION AUTONOMICA ALEVIN':              ['rgba(255,179,0,0.22)',   '#ffb300'],
  'PREFERENTE ALEVIN':                               ['rgba(255,202,40,0.20)',  '#ffca28'],
  'PRIMERA ALEVIN':                                  ['rgba(255,213,79,0.18)',  '#ffd54f'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO':            ['rgba(233,30,99,0.24)',   '#e91e63'],
  'PREFERENTE FUTBOL FEMENINO':                      ['rgba(236,64,122,0.22)',  '#ec407a'],
  'PRIMERA FUTBOL FEMENINO':                         ['rgba(240,98,146,0.20)',  '#f06292'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL':    ['rgba(186,73,180,0.24)',  '#ba49b4'],
  'PREFERENTE FEMENINO JUVENIL':                     ['rgba(206,147,216,0.22)', '#ce93d8'],
  'PRIMERA FEMENINO JUVENIL':                        ['rgba(225,190,231,0.18)', '#e1bee7'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO CADETE':     ['rgba(216,27,96,0.26)',   '#d81b60'],
  'PREFERENTE FEMENINO CADETE':                      ['rgba(233,30,99,0.22)',   '#e91e63'],
  'PRIMERA FEMENINO CADETE':                         ['rgba(240,98,146,0.18)',  '#f06292'],
  'TERCERA FEDERACION RFEF':                         ['rgba(229,57,53,0.28)',   '#e53935'],
  'PLAY OFF TERCERA FEDERACION':                     ['rgba(239,83,80,0.26)',   '#ef5350'],
  'COPA RFEF FASE AUTONOMICA':                       ['rgba(239,108,0,0.24)',   '#ef6c00'],
  'FINAL COPA RFEF FASE AUTONOMICA':                 ['rgba(245,124,0,0.22)',   '#f57c00'],
  'COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS': ['rgba(255,152,0,0.22)', '#ff9800'],
  'FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25': ['rgba(255,152,0,0.20)', '#ff9800'],
  'PREFERENTE AFICIONADO':                           ['rgba(255,152,0,0.22)',   '#ff9800'],
  'SEGUNDA AFICIONADO':                              ['rgba(255,183,77,0.20)',  '#ffb74d'],
  'PRIMERA DIVISION AUTONOMICA BENJAMIN':            ['rgba(255,112,67,0.24)',  '#ff7043'],
  'PREFERENTE BENJAMIN':                             ['rgba(255,138,101,0.22)', '#ff8a65'],
  'PRIMERA BENJAMIN':                                ['rgba(255,171,145,0.20)', '#ffab91'],
  'SEGUNDA BENJAMIN':                                ['rgba(255,204,188,0.18)', '#ffccbc'],
  'PRIMERA DIVISION AUTONOMICA PREBENJAMIN':         ['rgba(240,98,146,0.24)',  '#f06292'],
  'PREFERENTE PREBENJAMIN':                          ['rgba(244,143,177,0.22)', '#f48fb1'],
  'PRIMERA PREBENJAMIN':                             ['rgba(248,187,208,0.20)', '#f8bbd0'],
  'PRIMERA DIVISION AUTONOMICA DEBUTANTES':          ['rgba(171,71,188,0.24)',  '#ab47bc'],
  'PREFERENTE DEBUTANTES':                           ['rgba(186,104,200,0.22)', '#ba68c8'],
  'PRIMERA DEBUTANTES':                              ['rgba(206,147,216,0.20)', '#ce93d8'],
  'VETERANOS MASCULINO F11':                         ['rgba(120,144,156,0.20)', '#78909c'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14': ['rgba(77,157,224,0.24)', '#4d9de0'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16': ['rgba(100,181,246,0.22)', '#64b5f6'],
  'CAMPEONATO UNIVERSITARIO FEMENINO':               ['rgba(240,98,146,0.18)',  '#f06292'],
  'CAMPEONATO UNIVERSITARIO MASCULINO':              ['rgba(129,199,132,0.18)', '#81c784'],
  'CAMPEONATO UNIVERSITARIO MASCULINO 2A FASE F11':  ['rgba(165,214,167,0.16)', '#a5d6a7'],
};

// ── Status mapping ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  descartado:   'Descartado',
  poco:         'Poco interés',
  interesado:   'Interesado',
  seleccionado: 'Seleccionado',
};

const STATUS_FONT_ARGB: Record<string, string> = {
  descartado:   'FF9E9E9E',
  poco:         'FFFFB74D',
  interesado:   'FF4FC3F7',
  seleccionado: 'FF66BB6A',
};

const STATUS_FILL_ARGB: Record<string, string> = {
  descartado:   'FF1E1E2A',
  poco:         'FF201C10',
  interesado:   'FF0D1C26',
  seleccionado: 'FF0D1C12',
};

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS = [
  { header: 'Nombre',          key: 'name',                 width: 28 },
  { header: 'Ficha',           key: 'trialPlayerId',        width: 18 },
  { header: 'Código Federación', key: 'federationPlayerCode', width: 18 },
  { header: 'Año nac.',        key: 'birthYear',            width: 10 },
  { header: 'Equipo',          key: 'teamName',             width: 26 },
  { header: 'Categoría',       key: 'category',             width: 38 },
  { header: 'Estado',          key: 'status',               width: 16 },
  { header: 'Dem. ideal',      key: 'idealDemarcation',     width: 14 },
  { header: 'Dem. posibles',   key: 'possibleDemarcations', width: 28 },
  { header: 'Goles',           key: 'goals',                width: 8 },
  { header: 'Valoración',      key: 'rating',               width: 12 },
];

// ── Main export function ───────────────────────────────────────────────────────

export async function exportTestGridToExcel(
  players: Player[],
  demarcations: Demarcation[],
  filename = 'jugadores.xlsx',
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RFFM';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Jugadores', {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
    properties: { tabColor: { argb: 'FF4D9DE0' } },
  });

  ws.columns = COLUMNS;

  // ── Header row ──────────────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell({ includeEmpty: true }, (cell: any) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D0D1A' } };
    cell.font   = { bold: true, color: { argb: 'FF4D9DE0' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: '664D9DE0' } } };
  });

  // ── Data rows ────────────────────────────────────────────────────────────────
  players.forEach((p, idx) => {
    const idealDem = demarcations.find(d => d.id === p.idealDemarcationId);
    const possibleCodes = (p.possibleDemarcationIds ?? [])
      .map(id => demarcations.find(d => d.id === id)?.code ?? String(id))
      .join(', ');

    const row = ws.addRow({
      name:                 p.name,
      trialPlayerId:        p.trialPlayerId ?? '',
      federationPlayerCode: p.federationPlayerCode ?? '',
      birthYear:            p.birthYear,
      teamName:             p.teamName ?? '',
      category:             p.category ?? '',
      status:               STATUS_LABEL[p.status] ?? p.status,
      idealDemarcation:     idealDem?.code ?? '',
      possibleDemarcations: possibleCodes,
      goals:                p.totalGoals ?? '',
      rating:               p.rating,
    });

    row.height = 22;
    const rowBg = idx % 2 === 0 ? 'FF15182C' : 'FF1C1C30';

    row.eachCell({ includeEmpty: true }, (cell: any) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font      = { color: { argb: 'FFE8E8E8' }, size: 11, name: 'Calibri' };
      cell.alignment = { vertical: 'middle' };
      cell.border    = { bottom: { style: 'thin', color: { argb: '1A4D9DE0' } } };
    });

    // Category cell – colored like the app
    const catCell = row.getCell('category');
    if (p.category) {
      const match = CAT_COLORS[normCat(p.category)];
      if (match) {
        catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blendWithDark(match[0]) } };
        catCell.font = { color: { argb: hexToArgb(match[1]) }, size: 11, bold: true, name: 'Calibri' };
      }
    }

    // Status cell – tinted per status
    const statusCell = row.getCell('status');
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL_ARGB[p.status] ?? rowBg } };
    statusCell.font = { color: { argb: STATUS_FONT_ARGB[p.status] ?? 'FFE8E8E8' }, size: 11, bold: true, name: 'Calibri' };

    // Rating cell – right-aligned
    row.getCell('rating').alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // ── Data validation: Estado dropdown ────────────────────────────────────────
  const statusFormula = `"${Object.values(STATUS_LABEL).join(',')}"`;
  for (let r = 2; r <= players.length + 1; r++) {
    // Estado column (now at index 7)
    (ws.getCell(r, 7) as any).dataValidation = {
      type: 'list',
      allowBlank: true,
      showDropDown: false,
      formulae: [statusFormula],
    } as any;
  }

  // ── Data validation: Dem. ideal dropdown ────────────────────────────────────
  if (demarcations.length > 0) {
    const demFormula = `"${demarcations.map(d => d.code).join(',')}"`;
    for (let r = 2; r <= players.length + 1; r++) {
      // Dem. ideal column (now at index 8)
      (ws.getCell(r, 8) as any).dataValidation = {
        type: 'list',
        allowBlank: true,
        showDropDown: false,
        formulae: [demFormula],
      } as any;
    }
  }

  // ── Rating validation: 0-100 ─────────────────────────────────────────────────
  for (let r = 2; r <= players.length + 1; r++) {
    // Valoración column (now at index 11)
    ws.getCell(r, 11).dataValidation = {
      type: 'whole',
      allowBlank: true,
      operator: 'between',
      formulae: [0, 100],
    };
  }

  // ── AutoFilter ───────────────────────────────────────────────────────────────
  ws.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };

  // ── Download ─────────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
