import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFormations } from "../../../services/formationService";
import { getIdealLineup, saveIdealLineup } from "../../../services/idealLineupService";
import { FORMATION_POSITIONS } from "../../../types/formation";
import type { Formation, FormationSlotDef } from "../../../types/formation";

const DEFAULT_FORMATION_NAME = "4-2-3-1";

export type LineupEditor = {
  loading: boolean;
  formations: Formation[];
  formationId: string;
  slotDefs: FormationSlotDef[];
  slots: Record<number, string | null>;
  /** Cambia el esquema recolocando a los titulares actuales, en orden, en los nuevos puestos. */
  changeFormation: (formationId: string) => void;
  /** Coloca a un jugador (del campo o del banquillo) en un puesto; si estaba ocupado, intercambia. */
  placePlayer: (playerId: string, targetSlotIndex: number) => void;
  /** Devuelve al banquillo a un jugador que estaba en el campo. */
  benchPlayer: (playerId: string) => void;
  save: () => Promise<void>;
};

function slotOf(slots: Record<number, string | null>, playerId: string): number | null {
  const entry = Object.entries(slots).find(([, pid]) => pid === playerId);
  return entry ? parseInt(entry[0]) : null;
}

/** Estado editable de la alineación de un partido: esquema + titulares por puesto. */
export function useLineupEditor(
  teamId: string,
  eventId: string | null,
  onSavingChange?: (saving: boolean) => void,
): LineupEditor {
  const [loading, setLoading] = useState(true);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState("");
  const [slots, setSlots] = useState<Record<number, string | null>>({});
  const onSavingChangeRef = useRef(onSavingChange);
  onSavingChangeRef.current = onSavingChange;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([getFormations(), teamId ? getIdealLineup(teamId, eventId) : Promise.resolve(null)])
      .then(([formationList, lineup]) => {
        if (!mounted) return;
        setFormations(formationList);
        if (lineup) {
          setFormationId(lineup.formationId);
          const slotMap: Record<number, string | null> = {};
          lineup.slots.forEach((s) => { slotMap[s.slotIndex] = s.teamPlayerId; });
          setSlots(slotMap);
        } else if (formationList.length > 0) {
          const preferred = formationList.find((f) => f.name === DEFAULT_FORMATION_NAME) ?? formationList[0];
          setFormationId(preferred.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [teamId, eventId]);

  const slotDefs = useMemo(() => {
    const formation = formations.find((f) => f.id === formationId);
    return formation ? (FORMATION_POSITIONS[formation.name] ?? []) : [];
  }, [formations, formationId]);

  const changeFormation = useCallback(
    (nextFormationId: string) => {
      const formation = formations.find((f) => f.id === nextFormationId);
      if (!formation || nextFormationId === formationId) return;
      const nextSlotDefs = FORMATION_POSITIONS[formation.name] ?? [];
      setSlots((prev) => {
        const onField = Object.entries(prev)
          .filter(([, pid]) => pid)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([, pid]) => pid as string);
        const next: Record<number, string | null> = {};
        nextSlotDefs.forEach((def, idx) => { next[def.slotIndex] = onField[idx] ?? null; });
        return next;
      });
      setFormationId(nextFormationId);
    },
    [formations, formationId],
  );

  const placePlayer = useCallback((playerId: string, targetSlotIndex: number) => {
    setSlots((prev) => {
      const fromSlotIndex = slotOf(prev, playerId);
      if (fromSlotIndex === targetSlotIndex) return prev;
      const displaced = prev[targetSlotIndex] ?? null;
      const next = { ...prev, [targetSlotIndex]: playerId };
      if (fromSlotIndex !== null) next[fromSlotIndex] = displaced;
      return next;
    });
  }, []);

  const benchPlayer = useCallback((playerId: string) => {
    setSlots((prev) => {
      const fromSlotIndex = slotOf(prev, playerId);
      if (fromSlotIndex === null) return prev;
      return { ...prev, [fromSlotIndex]: null };
    });
  }, []);

  const save = useCallback(async () => {
    if (!formationId || !teamId) return;
    onSavingChangeRef.current?.(true);
    try {
      const validSlotIndexes = new Set(slotDefs.map((d) => d.slotIndex));
      const slotPayload = Object.entries(slots)
        .filter(([idx, pid]) => pid && validSlotIndexes.has(parseInt(idx)))
        .map(([idx, pid]) => ({ slotIndex: parseInt(idx), teamPlayerId: pid as string }));
      await saveIdealLineup(teamId, { formationId, seasonId: eventId, slots: slotPayload });
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", { detail: { message: "Alineación guardada", severity: "success" } }),
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", { detail: { message: "Error al guardar la alineación", severity: "error" } }),
      );
    } finally {
      onSavingChangeRef.current?.(false);
    }
  }, [formationId, teamId, eventId, slots, slotDefs]);

  return { loading, formations, formationId, slotDefs, slots, changeFormation, placePlayer, benchPlayer, save };
}
