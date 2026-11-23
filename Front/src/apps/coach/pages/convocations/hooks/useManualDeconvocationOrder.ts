import { useCallback, useMemo, useState } from "react";
import type { DeconvokeProposal } from "../utils/deconvokeProposal";
import { applyManualOrder, manualOrderIdsOf, type ManualOrderContext } from "../utils/manualDeconvocationOrder";

export type ManualDeconvocationOrder = {
  /** The automatic proposal, or the one that follows from the order the coach chose. */
  proposal: DeconvokeProposal;
  moveInOrder: (playerId: string, direction: "up" | "down") => void;
  /** Drops the manual order and goes back to the automatic proposal. */
  resetOrder: () => void;
};

/** The order of deconvocation the coach moves by hand, on top of the automatic proposal. */
export function useManualDeconvocationOrder(
  automatic: DeconvokeProposal,
  { players, rules }: ManualOrderContext,
): ManualDeconvocationOrder {
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  const proposal = useMemo(
    () => (manualOrder ? applyManualOrder(automatic, manualOrder, { players, rules }) : automatic),
    [automatic, manualOrder, players, rules],
  );

  const moveInOrder = useCallback(
    (playerId: string, direction: "up" | "down") => {
      const ids = manualOrderIdsOf(proposal);
      const from = ids.indexOf(playerId);
      const to = direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setManualOrder(next);
    },
    [proposal],
  );

  const resetOrder = useCallback(() => setManualOrder(null), []);

  return { proposal, moveInOrder, resetOrder };
}
