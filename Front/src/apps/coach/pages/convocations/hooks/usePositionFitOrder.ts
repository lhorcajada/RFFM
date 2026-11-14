import { useEffect, useState } from "react";
import { getTeamPositionFit } from "../../../services/positionFitService";
import type { PositionFit } from "../../../types/positionFit";

/**
 * Fit order of each unified position, used by the deconvocation proposal. Empty while loading or when the
 * read fails (e.g. the user cannot see trait ratings): the proposal then keeps the fairness order.
 */
export function usePositionFitOrder(teamId: string): PositionFit[] {
  const [positionFit, setPositionFit] = useState<PositionFit[]>([]);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    getTeamPositionFit(teamId)
      .then((data) => {
        if (!cancelled) setPositionFit(data);
      })
      .catch(() => {
        if (!cancelled) setPositionFit([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return positionFit;
}
