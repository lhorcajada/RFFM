import type { SessionTargetDetail } from "../../../types/training";

export type SubprincipioBlock = {
  subprincipioId: string;
  titulo: string;
  context: string;
  targets: SessionTargetDetail[];
};

/** Agrupa los sub-subprincipios de una sesión por su subprincipio, en orden de aparición. */
export function groupTargetsBySubprincipio(targets: SessionTargetDetail[]): SubprincipioBlock[] {
  const blocks = new Map<string, SubprincipioBlock>();
  for (const t of targets) {
    const block = blocks.get(t.subprincipioId) ?? {
      subprincipioId: t.subprincipioId,
      titulo: t.subprincipioTitulo,
      context: `${t.gameMomentName} · ${t.principioTitulo}`,
      targets: [],
    };
    block.targets.push(t);
    blocks.set(t.subprincipioId, block);
  }
  return [...blocks.values()];
}

export function targetLine(t: SessionTargetDetail): string {
  const base = `${t.numero} ${t.rol}`;
  return t.zonaLabel ? `${base} · ${t.zonaLabel}` : base;
}
