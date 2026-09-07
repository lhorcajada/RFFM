// Groups a session's flat SessionTargetDetail[] into a Fase → Principio → Subprincipio →
// Zona? → SubSubPrincipio tree so SessionTargetTree.tsx can render it hierarchically instead
// of as independent breadcrumb chips that repeat their shared ancestors. Targets that share
// Fase/Principio/Subprincipio/Zona collapse into the same branch. See openspec/changes/
// season-plan-content-board (follow-up: session-card target tree).

import type { SessionTargetDetail } from "../../../types/training";

export interface SspLeaf {
  target: SessionTargetDetail;
}

export interface ZonaNode {
  zonaId: string;
  zonaLabel: string;
  leaves: SspLeaf[];
}

export interface SubprincipioNode {
  subprincipioId: string;
  subprincipioTitulo: string;
  /** Targets grouped under a Zona (only present when the target carries a zonaId). */
  zonas: ZonaNode[];
  /** Targets with no Zona, direct children of this Subprincipio. */
  leaves: SspLeaf[];
}

export interface PrincipioNode {
  principioId: string;
  principioTitulo: string;
  subprincipios: SubprincipioNode[];
}

export interface FaseNode {
  gameMomentId: number;
  gameMomentName: string;
  principios: PrincipioNode[];
}

/** Builds the grouped tree, preserving each level's first-seen order. */
export function buildTargetTree(targets: SessionTargetDetail[]): FaseNode[] {
  const fases: FaseNode[] = [];

  for (const target of targets) {
    let fase = fases.find((f) => f.gameMomentId === target.gameMomentId);
    if (!fase) {
      fase = { gameMomentId: target.gameMomentId, gameMomentName: target.gameMomentName, principios: [] };
      fases.push(fase);
    }

    let principio = fase.principios.find((p) => p.principioId === target.principioId);
    if (!principio) {
      principio = { principioId: target.principioId, principioTitulo: target.principioTitulo, subprincipios: [] };
      fase.principios.push(principio);
    }

    let subprincipio = principio.subprincipios.find((s) => s.subprincipioId === target.subprincipioId);
    if (!subprincipio) {
      subprincipio = {
        subprincipioId: target.subprincipioId,
        subprincipioTitulo: target.subprincipioTitulo,
        zonas: [],
        leaves: [],
      };
      principio.subprincipios.push(subprincipio);
    }

    if (target.zonaId) {
      let zona = subprincipio.zonas.find((z) => z.zonaId === target.zonaId);
      if (!zona) {
        zona = { zonaId: target.zonaId, zonaLabel: target.zonaLabel ?? "", leaves: [] };
        subprincipio.zonas.push(zona);
      }
      zona.leaves.push({ target });
    } else {
      subprincipio.leaves.push({ target });
    }
  }

  return fases;
}

/** Builds a human-readable summary of a session's targets, grouped by Subprincipio, for
 * auto-filling "Objetivo general" when it's still empty but the session already has targets
 * assigned from the content board (NewSessionPage.tsx / useSessionForm.ts loadSession). One
 * line per Subprincipio, e.g. "1.1 Evitar que el rival supere nuestra primera línea de
 * presión: Delantero, Extremo, Mediocentro A." — roles deduplicated, insertion order
 * preserved. Empty input yields an empty string so callers can fall back safely. */
export function summarizeTargetsForObjetivo(targets: SessionTargetDetail[]): string {
  const order: string[] = [];
  const bySubprincipio = new Map<string, { titulo: string; roles: string[] }>();

  for (const target of targets) {
    let entry = bySubprincipio.get(target.subprincipioId);
    if (!entry) {
      entry = { titulo: target.subprincipioTitulo, roles: [] };
      bySubprincipio.set(target.subprincipioId, entry);
      order.push(target.subprincipioId);
    }
    if (!entry.roles.includes(target.rol)) entry.roles.push(target.rol);
  }

  return order
    .map((id) => {
      const entry = bySubprincipio.get(id) as { titulo: string; roles: string[] };
      return `${entry.titulo}: ${entry.roles.join(", ")}.`;
    })
    .join("\n");
}
