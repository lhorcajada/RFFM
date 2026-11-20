import type { PlayerResponse } from "../../../services/teamplayerService";
import type { DeconvokeProposal, PlayerProposal, ProposalOrderEntry } from "./deconvokeProposal";
import { evaluateRequirements, ROLE_MINIMUMS, roleLabel, toPositionPlayer, type RoleMinimums } from "./positionRequirements";
import { DEFAULT_RULES } from "./rules/defaultRules";
import { resolveRule, type DeconvocationRuleConfig } from "./rules/ruleCatalog";

export type ManualOrderContext = {
  players: PlayerResponse[];
  /** Team's deconvocation rules; the default set when omitted. */
  rules?: DeconvocationRuleConfig[];
};

/** Players held back by a protection rule that are not goalkeepers: the coach may still choose them. */
function heldPlayers(proposal: DeconvokeProposal): PlayerProposal[] {
  return proposal.players.filter((p) => p.decision.group === "protected" && !p.locked && !p.forced);
}

/**
 * Ids of the manual order by default: who the proposal deconvokes first, so that applying it unchanged
 * gives the same selection, then the rest of its order and the protected players.
 */
export function manualOrderIdsOf(proposal: DeconvokeProposal): string[] {
  const inOrder = new Set(proposal.order.map((o) => o.playerId));
  const held = heldPlayers(proposal)
    .map((p) => p.playerId)
    .filter((id) => !inOrder.has(id));
  const goingOut = proposal.order.filter((o) => o.outcome === "proposed");
  const staying = proposal.order.filter((o) => o.outcome !== "proposed");
  return [...goingOut, ...staying].map((o) => o.playerId).concat(held);
}

/**
 * The proposal once the coach has chosen the deconvocation order: the first players of the order go out
 * (as many as the target leaves free after the mandatory ones) and everything else follows from that
 * selection. A protected player or a position minimum is only warned about, never blocked.
 */
export function applyManualOrder(
  proposal: DeconvokeProposal,
  orderIds: string[],
  { players, rules }: ManualOrderContext,
): DeconvokeProposal {
  const baseIds = manualOrderIdsOf(proposal);
  const known = new Set(baseIds);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of [...orderIds, ...baseIds]) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  const byId = new Map(proposal.players.map((p) => [p.playerId, p]));
  const forced = proposal.players.filter((p) => p.forced && p.decision.group === "proposed");
  const slots = Math.max(0, proposal.targetCount - forced.length);
  const chosenIds = ordered.slice(0, slots);
  const chosen = new Set(chosenIds);
  const selectedIds = [...forced.map((p) => p.playerId), ...chosenIds];
  const selected = new Set(selectedIds);

  const manualWarnings = chosenIds.flatMap((id) => {
    const player = byId.get(id)!;
    return player.decision.group === "protected" ? [`${player.displayName}: ${player.decision.reason}`] : [];
  });

  const nextPlayers = proposal.players.map((p): PlayerProposal => {
    if (p.forced) return p;
    if (chosen.has(p.playerId)) {
      const wasProtected = p.decision.group === "protected";
      return {
        ...p,
        isSelected: true,
        comparison: [],
        decision: {
          group: "proposed",
          reason: wasProtected
            ? `Elegido en el orden manual, aunque estaba protegido. ${p.decision.reason}`
            : "Elegido en el orden manual",
        },
      };
    }
    if (p.decision.group === "proposed") {
      return {
        ...p,
        isSelected: false,
        comparison: [],
        decision: { group: "notChosen", reason: "Lo has dejado convocado en el orden manual" },
      };
    }
    return p;
  });

  const playerById = new Map(players.map((p) => [p.id, p]));
  const remaining = proposal.players
    .filter((p) => !selected.has(p.playerId))
    .flatMap((p) => {
      const source = playerById.get(p.playerId);
      return source ? [toPositionPlayer(source)] : [];
    });
  const minimums: RoleMinimums = { ...ROLE_MINIMUMS, ...resolveRule("positionMinimums", rules ?? DEFAULT_RULES)?.points };

  const previousEntry = new Map(proposal.order.map((o) => [o.playerId, o]));
  const order = ordered.map((id, index): ProposalOrderEntry => {
    const previous = previousEntry.get(id);
    const player = byId.get(id)!;
    return {
      rank: index + 1,
      playerId: id,
      name: previous?.name ?? player.displayName,
      position: previous?.position ?? roleLabel(player.positionRole ?? null),
      outcome: chosen.has(id) ? "proposed" : "stays",
      chips: previous?.chips ?? [],
      versusNext: null,
      heldReason: player.decision.group === "protected" ? player.decision.reason : undefined,
    };
  });

  return {
    ...proposal,
    isManual: true,
    manualWarnings,
    selectedIds,
    players: nextPlayers,
    positionWarnings: evaluateRequirements(remaining, minimums).shortfalls,
    order,
  };
}
