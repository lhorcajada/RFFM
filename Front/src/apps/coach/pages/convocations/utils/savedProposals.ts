import type { DeconvokeProposal } from "./deconvokeProposal";

/** The players the proposal leaves out, in deconvocation order; the already deconvoked are not part of it. */
export function proposedIdsInOrder({ players, order }: DeconvokeProposal): string[] {
  const rank = new Map(order.map((o) => [o.playerId, o.rank]));
  const rankOf = (playerId: string) => rank.get(playerId) ?? Number.MAX_SAFE_INTEGER;
  return players
    .filter((p) => p.decision.group === "proposed")
    .map((p) => p.playerId)
    .sort((a, b) => rankOf(a) - rankOf(b));
}

/** First «Propuesta N» not in use, counting from the number of saved proposals. */
export function nextProposalName(existing: string[]): string {
  let number = existing.length + 1;
  while (existing.includes(`Propuesta ${number}`)) number++;
  return `Propuesta ${number}`;
}
