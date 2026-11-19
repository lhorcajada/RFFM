import type { Habilidad, Nota, Principle, SetPieceRule, SubSubPrincipio, Subprincipio, Zona } from "../../../types/gameModel";

/** Query parameter that carries the address of the node a direct link points to. */
export const NODE_LINK_PARAM = "nodo";

export const SET_PIECES_ADDRESS = "set-pieces";

/** The single definition of a game-model node's address. Principles, subprincipios, zonas and
 * sub-subprincipios use the stable key the backend derives (`GameModelKeys`) when the entity exposes
 * one, and the hierarchical number path otherwise. Habilidades and notas have no key, so they hang
 * from their parent's address. The read view, direct links and pending-change decorations all
 * address nodes through these helpers. */
export function phaseAddress(gameMomentId: number): string {
  return `moment-${gameMomentId}`;
}

export function principleAddress(principle: Pick<Principle, "key" | "gameMomentId" | "numero">): string {
  return principle.key ?? `${phaseAddress(principle.gameMomentId)}/${principle.numero}`;
}

export function subprincipioAddress(subprincipio: Pick<Subprincipio, "key" | "numero">, parentAddress: string): string {
  return subprincipio.key ?? `${parentAddress}/${subprincipio.numero}`;
}

export function zonaAddress(zona: Pick<Zona, "key" | "zoneKeys" | "label">, parentAddress: string): string {
  if (zona.key) return zona.key;
  const label = zona.label ? `:${zona.label}` : "";
  return `${parentAddress}/zona:${zona.zoneKeys.join("+")}${label}`;
}

export function subSubPrincipioAddress(ssp: Pick<SubSubPrincipio, "key" | "numero">, parentAddress: string): string {
  return ssp.key ?? `${parentAddress}/${ssp.numero}`;
}

export function habilidadAddress(habilidad: Pick<Habilidad, "id" | "apiId">, parentAddress: string): string {
  return `${parentAddress}/hab:${habilidad.apiId ?? habilidad.id}`;
}

export function notaAddress(nota: Pick<Nota, "id" | "apiId">, parentAddress: string): string {
  return `${parentAddress}/nota:${nota.apiId ?? nota.id}`;
}

export function setPieceRuleAddress(rule: Pick<SetPieceRule, "id" | "apiId">): string {
  return `${SET_PIECES_ADDRESS}/${rule.apiId ?? rule.id}`;
}
