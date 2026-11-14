import { useCallback, useEffect, useMemo, useState } from "react";
import { getTeamPositionFit, savePositionFitOrder, savePositionTraitWeights } from "../../../services/positionFitService";
import type { PositionFit } from "../../../types/positionFit";
import type { FitPosition, TraitWeight } from "./ratingTraits";

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const valid = (i: number) => i >= 0 && i < items.length;
  if (!valid(fromIndex) || !valid(toIndex) || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

type OrderDraft = Partial<Record<FitPosition, string[]>>;

function serverOrder(position: PositionFit): string[] {
  return position.candidates.map((candidate) => candidate.teamPlayerId);
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export type PositionFitState = {
  loading: boolean;
  loadError: boolean;
  saving: boolean;
  positions: PositionFit[];
  /** Orden de trabajo (con los cambios aún sin guardar) de los candidatos de un puesto. */
  orderOf: (position: FitPosition) => string[];
  isDirty: (position: FitPosition) => boolean;
  hasUnsavedChanges: boolean;
  move: (position: FitPosition, teamPlayerId: string, direction: "up" | "down") => void;
  /** Coloca a `activeId` en el lugar que ocupa `overId` (arrastrar y soltar). */
  moveTo: (position: FitPosition, activeId: string, overId: string) => void;
  reset: (position: FitPosition) => void;
  save: (position: FitPosition) => Promise<void>;
  saveWeights: (position: FitPosition, weights: Record<string, TraitWeight>) => Promise<void>;
};

export function usePositionFit(teamId: string | null): PositionFitState {
  const [positions, setPositions] = useState<PositionFit[]>([]);
  const [draft, setDraft] = useState<OrderDraft>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getTeamPositionFit(teamId)
      .then((data) => {
        if (cancelled) return;
        setPositions(data);
        setDraft({});
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const orderOf = useCallback(
    (position: FitPosition): string[] => {
      const working = draft[position];
      if (working) return working;
      const server = positions.find((p) => p.position === position);
      return server ? serverOrder(server) : [];
    },
    [draft, positions],
  );

  const isDirty = useCallback(
    (position: FitPosition): boolean => {
      const server = positions.find((p) => p.position === position);
      return server != null && !sameOrder(orderOf(position), serverOrder(server));
    },
    [orderOf, positions],
  );

  const hasUnsavedChanges = useMemo(
    () => positions.some((p) => isDirty(p.position)),
    [positions, isDirty],
  );

  const applyOrder = useCallback((position: FitPosition, next: string[]) => {
    setDraft((prev) => ({ ...prev, [position]: next }));
  }, []);

  const move = useCallback(
    (position: FitPosition, teamPlayerId: string, direction: "up" | "down") => {
      const order = orderOf(position);
      const index = order.indexOf(teamPlayerId);
      applyOrder(position, moveItem(order, index, direction === "up" ? index - 1 : index + 1));
    },
    [orderOf, applyOrder],
  );

  const moveTo = useCallback(
    (position: FitPosition, activeId: string, overId: string) => {
      const order = orderOf(position);
      applyOrder(position, moveItem(order, order.indexOf(activeId), order.indexOf(overId)));
    },
    [orderOf, applyOrder],
  );

  const reset = useCallback((position: FitPosition) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
  }, []);

  const replacePosition = useCallback((updated: PositionFit) => {
    setPositions((prev) => prev.map((p) => (p.position === updated.position ? updated : p)));
    setDraft((prev) => {
      const next = { ...prev };
      delete next[updated.position];
      return next;
    });
  }, []);

  const save = useCallback(
    async (position: FitPosition) => {
      if (!teamId) return;
      setSaving(true);
      try {
        replacePosition(await savePositionFitOrder(teamId, position, orderOf(position)));
      } finally {
        setSaving(false);
      }
    },
    [teamId, orderOf, replacePosition],
  );

  const saveWeights = useCallback(
    async (position: FitPosition, weights: Record<string, TraitWeight>) => {
      if (!teamId) return;
      setSaving(true);
      try {
        replacePosition(await savePositionTraitWeights(teamId, position, weights));
      } finally {
        setSaving(false);
      }
    },
    [teamId, replacePosition],
  );

  return { loading, loadError, saving, positions, orderOf, isDirty, hasUnsavedChanges, move, moveTo, reset, save, saveWeights };
}
