import { client } from "../../../../core/api/client";
import type { Exercise } from "../../types/training";
import { TIPO_LABELS } from "./exerciseTypeLabels";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

export function mediaUrl(urlImage: string): string {
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildModelRelationsHtml(exercise: Exercise): string {
  if (exercise.modelRelations.length === 0) return "";

  const chips: string[] = [];
  for (const relation of exercise.modelRelations) {
    chips.push(
      `<span class="chip ${relation.isFoco ? "chip-foco" : "chip-integrado"}">${escapeHtml(
        `${relation.subprincipioNumero ?? ""} · ${relation.subprincipioTitulo ?? ""}`,
      )}</span>`,
    );
    for (const item of relation.items) {
      chips.push(
        `<span class="chip ${item.isFoco ? "chip-foco" : "chip-integrado"}">${escapeHtml(
          `${item.subSubPrincipioNumero ?? ""} · ${item.subSubPrincipioRol ?? ""}`,
        )}</span>`,
      );
    }
    for (const habilidad of relation.habilidadesImprescindibles) {
      chips.push(`<span class="chip chip-habilidad">${escapeHtml(habilidad)}</span>`);
    }
  }

  return `<div class="section"><h3>Asociado al modelo de juego</h3><div class="chips">${chips.join("")}</div></div>`;
}

function buildNivelesTableHtml(exercise: Exercise): string {
  if (exercise.nivelesColumnas.length === 0) return "";

  const sortedNiveles = [...exercise.niveles].sort((a, b) => a.nivel - b.nivel);
  const headerCells = exercise.nivelesColumnas.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
  const rows = sortedNiveles
    .map((row) => {
      const cells = exercise.nivelesColumnas
        .map((col) => `<td>${escapeHtml(row.valores[col] ?? "")}</td>`)
        .join("");
      return `<tr><td class="nivel-cell">${row.nivel}</td>${cells}</tr>`;
    })
    .join("");

  return `<div class="section"><h3>Niveles</h3><table><thead><tr><th>Nivel</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function buildImageOrBoardHtml(exercise: Exercise, boardDrawingHtml?: string | null): string {
  if (exercise.urlImage) {
    return `<div><img src="${escapeHtml(mediaUrl(exercise.urlImage))}" alt="${escapeHtml(exercise.name)}" /></div>`;
  }
  if (boardDrawingHtml) {
    return `<div class="section"><h3>Pizarra táctica</h3><div class="board-drawing">${boardDrawingHtml}</div></div>`;
  }
  return "";
}

/** Builds the print-friendly HTML sheet for an exercise, embedding either the uploaded
 * image (`urlImage`) or, when absent, the tactical board's own on-screen markup + styles
 * (`boardDrawingHtml` — the board preview's live `outerHTML` plus its CSS module stylesheet,
 * captured by the caller) so the browser renders it natively rather than through a
 * screenshot library. */
export function buildExercisePrintHtml(exercise: Exercise, boardDrawingHtml?: string | null): string {
  const imageOrBoardHtml = buildImageOrBoardHtml(exercise, boardDrawingHtml);

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(exercise.name)} - PDF</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #102133; background: #fff; }
        .sheet { display: flex; flex-direction: column; gap: 14px; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .title { margin: 0; font-size: 24px; line-height: 1.1; }
        .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 12px; color: #38506b; }
        .pill { display: inline-flex; align-items: center; border: 1px solid #c9d8e6; border-radius: 999px; padding: 4px 10px; background: #f6f9fc; }
        .section h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
        .section p, .section li { margin: 0; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; font-size: 11px; border: 1px solid #c9d8e6; }
        .chip-foco { background: #fde3d0; border-color: #f0a865; }
        .chip-integrado { background: #eef2fa; }
        .chip-habilidad { background: #e7f6ec; border-color: #9bd6ac; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #c9d8e6; padding: 5px 8px; text-align: left; }
        th { background: #f6f9fc; }
        .nivel-cell { font-weight: bold; width: 48px; }
        img { display: block; width: 100%; border-radius: 14px; border: 1px solid #c9d8e6; }
        .board-drawing { width: 100%; height: 420px; border-radius: 14px; border: 1px solid #c9d8e6; overflow: hidden; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div>
            <h1 class="title">${escapeHtml(exercise.name)}</h1>
            <div class="meta">
              <span class="pill">${escapeHtml(TIPO_LABELS[exercise.tipo] ?? exercise.tipo)}</span>
              ${typeof exercise.durationMinutes === "number" ? `<span class="pill">${exercise.durationMinutes} min</span>` : ""}
            </div>
          </div>
        </div>

        <div class="section"><h3>Objetivo</h3><p>${escapeHtml(exercise.objetivo)}</p></div>
        ${exercise.objetivoPorRol ? `<div class="section"><h3>Objetivo por rol</h3><p>${escapeHtml(exercise.objetivoPorRol)}</p></div>` : ""}
        ${buildModelRelationsHtml(exercise)}
        ${buildNivelesTableHtml(exercise)}
        <div class="section"><h3>Logística</h3><p>${escapeHtml(exercise.logistica)}</p></div>
        ${exercise.porteros ? `<div class="section"><h3>Porteros</h3><p>${escapeHtml(exercise.porteros)}</p></div>` : ""}
        ${exercise.dibujo ? `<div class="section"><h3>Dibujo</h3><p>${escapeHtml(exercise.dibujo)}</p></div>` : ""}
        ${exercise.descripcion ? `<div class="section"><h3>Descripción</h3><p>${escapeHtml(exercise.descripcion)}</p></div>` : ""}

        ${imageOrBoardHtml}
      </div>
    </body>
  </html>`;
}
