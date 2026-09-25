// Pure helpers extracted out of the content-board's drag-and-drop handlers so the "what does
// dragging this ADN node mean" logic is unit-testable without simulating @dnd-kit's pointer
// machinery (same precedent as IdealLineup.test.tsx — see
// AdnDraggableTree.dragdrop.test.tsx). See openspec/changes/season-plan-content-board
// design.md F4.

import type { GameModel, Habilidad, Principle, Subprincipio, SubSubPrincipio, Zona } from "../../../../types/gameModel";
import type { SessionTargetDetail } from "../../../../types/training";
import { zonaHeading } from "../../../game-model/components/gameModelOrder";

export interface BreadcrumbCtx {
  principle: Principle;
  sp: Subprincipio;
  zona: Zona | null;
}

/** Builds a SessionTargetDetail (full ADN breadcrumb) for a single SubSubPrincipio being
 * dragged — mirrors the backend's `SessionTargetDetailLookup.ResolveAsync` shape exactly, but
 * built client-side at drag time from the GameModel tree already in scope. */
export function toTargetDetail(ssp: SubSubPrincipio, ctx: BreadcrumbCtx): SessionTargetDetail {
  return {
    subSubPrincipioId: ssp.apiId ?? "",
    rol: ssp.rol,
    numero: ssp.numero,
    subprincipioId: ctx.sp.apiId ?? "",
    subprincipioTitulo: ctx.sp.titulo,
    zonaId: ctx.zona?.apiId ?? null,
    zonaLabel: ctx.zona ? zonaHeading(ctx.zona) : null,
    principioId: ctx.principle.apiId ?? "",
    principioTitulo: ctx.principle.titulo,
    gameMomentId: ctx.principle.gameMomentId,
    gameMomentName: ctx.principle.gameMomentName ?? "",
  };
}

/** Dragging a Subprincipio adds all of its Sub-subprincipios — those in its Zonas plus its
 * general (direct) ones; a Subprincipio may hold both at the same time. */
export function flattenSubprincipioTargets(
  sp: Subprincipio,
  ctx: { principle: Principle }
): SessionTargetDetail[] {
  const inZonas = sp.zonas.flatMap((zona) =>
    zona.subSubPrincipios.map((ssp) => toTargetDetail(ssp, { principle: ctx.principle, sp, zona }))
  );
  const generals = sp.subSubPrincipios.map((ssp) => toTargetDetail(ssp, { principle: ctx.principle, sp, zona: null }));
  return [...inZonas, ...generals];
}

function allSubSubPrincipios(sp: Subprincipio): SubSubPrincipio[] {
  return [...sp.zonas.flatMap((z) => z.subSubPrincipios), ...sp.subSubPrincipios];
}

/** Removes duplicate targets by subSubPrincipioId, keeping the first occurrence — used both
 * for within-session dedup on drop (useSessionDrop) and defensively when flattening. */
export function dedupeById(targets: SessionTargetDetail[]): SessionTargetDetail[] {
  const seen = new Set<string>();
  const result: SessionTargetDetail[] = [];
  for (const target of targets) {
    if (seen.has(target.subSubPrincipioId)) continue;
    seen.add(target.subSubPrincipioId);
    result.push(target);
  }
  return result;
}

/** Breadcrumb segments describing what's being dragged, for the content-board's DragOverlay
 * (design.md F4) — full "Fase / Principio / Subprincipio / [Zona /] Rol (Numero)" breadcrumb
 * for a single SubSubPrincipio, or "Fase / Principio / Subprincipio / N sub-subprincipios" when
 * an entire Subprincipio is being dragged (its targets all share that same prefix). Kept
 * separate from the drop payload's `kind`/`targets` shape so the overlay stays legible instead
 * of showing only the bare role or a bare count, per the user's UX-refinement request. */
export function describeDragPayload(payload: {
  kind: "subprincipio" | "subsubprincipio";
  targets: SessionTargetDetail[];
}): string[] {
  const first = payload.targets[0];
  if (!first) return [];

  const base = [first.gameMomentName, first.principioTitulo, first.subprincipioTitulo];
  if (payload.kind === "subsubprincipio") {
    return [...base, ...(first.zonaLabel ? [first.zonaLabel] : []), `${first.rol} (${first.numero})`];
  }
  return [...base, `${payload.targets.length} sub-subprincipios`];
}

/** Derives a short, on-screen summary of a SubSubPrincipio's `texto` (its free-text
 * description) — the first sentence, or the text clipped to `maxLength` on a word boundary
 * with an ellipsis. Pure/UI-only: doesn't touch the GameModel edit form or backend, per the
 * user's UX-refinement request (no scope/contract change to season-plan-content-board). */
export function summarizeTexto(texto: string, maxLength = 60): string {
  const trimmed = texto.trim();
  if (!trimmed) return "";

  const firstSentenceMatch = trimmed.match(/^[^.!?\n]+[.!?]?/);
  const firstSentence = (firstSentenceMatch ? firstSentenceMatch[0] : trimmed).trim();
  if (firstSentence.length <= maxLength) return firstSentence;

  const truncated = firstSentence.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const clipped = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trimEnd();
  return `${clipped}…`;
}

/** Builds a subSubPrincipioId → texto lookup from the team's GameModel, walking every
 * Subprincipio's Zonas and its general (direct) SubSubPrincipios. Built once
 * client-side from the GameModel already in memory so a session's target detail (which only
 * carries id/rol/numero, not the free-text description) can resolve its description without a
 * new API field. Entries with no `apiId` are skipped — they aren't referenceable targets yet. */
export function buildSubSubPrincipioTextoMap(gameModel: GameModel): Map<string, string> {
  return buildSubSubPrincipioMap(gameModel, (ssp) => ssp.texto);
}

/** Same walk as `buildSubSubPrincipioTextoMap`, resolving each target's habilidades
 * imprescindibles from the GameModel already in memory. */
export function buildSubSubPrincipioHabilidadesMap(gameModel: GameModel): Map<string, Habilidad[]> {
  return buildSubSubPrincipioMap(gameModel, (ssp) => ssp.habilidades);
}

function buildSubSubPrincipioMap<T>(gameModel: GameModel, select: (ssp: SubSubPrincipio) => T): Map<string, T> {
  const map = new Map<string, T>();
  for (const principle of gameModel.principles) {
    for (const sp of principle.subprincipios) {
      for (const ssp of allSubSubPrincipios(sp)) {
        if (ssp.apiId) map.set(ssp.apiId, select(ssp));
      }
    }
  }
  return map;
}
