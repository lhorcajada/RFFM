import { useCallback, useState } from "react";
import type { DemarcationOption } from "../../../services/demarcationService";
import teamplayerService from "../../../services/teamplayerService";

interface UsePlayerSaveParams {
  teamPlayer: any | null;
  form: any;
  demarcationOptions: DemarcationOption[];
  setTeamPlayer: React.Dispatch<React.SetStateAction<any | null>>;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  notify: (message: string, severity: "success" | "error") => void;
}

export function usePlayerSave({
  teamPlayer,
  form,
  demarcationOptions,
  setTeamPlayer,
  setEditing,
  notify,
}: UsePlayerSaveParams) {
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!teamPlayer) return;

    const possibleNames = (form.possibleDemarcations ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const nameToId = new Map<string, number>();
    demarcationOptions.forEach((o) => nameToId.set(o.name, o.id));
    const mapped: Array<number | undefined> = possibleNames.map((n: string) => nameToId.get(n));
    const possibleIds: number[] = mapped.filter((x): x is number => x !== undefined);

    if (possibleIds.length > 0 && !(form.activePositionId ?? null)) {
      notify("Seleccione la demarcación habitual antes de guardar.", "error");
      return;
    }

    setSaving(true);
    try {
      const parseNumber = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };

      const payload: any = {
        dorsal: parseNumber(form.dorsal),
        playerInfo: {
          name: form.name ?? null,
          lastName: form.lastName ?? null,
          alias: form.alias ?? null,
          urlPhoto: form.urlPhoto ?? null,
        },
        demarcation: {
          activePositionId: form.activePositionId ?? null,
          activePositionName: form.activePositionName ?? null,
          possibleDemarcations: possibleIds,
        },
        contactInfo: {
          phone: form.phone ?? null,
          email: form.email ?? null,
        },
        physicalInfo: {
          height: parseNumber(form.height),
          weight: parseNumber(form.weight),
          dominantFoot: form.dominantFoot ?? null,
          dominantFootId: form.dominantFootId ?? null,
        },
      };

      const updated = await teamplayerService.updateTeamPlayer(teamPlayer.id, payload);
      if (updated) {
        setTeamPlayer(updated);
        setEditing(false);
        notify("Jugador guardado correctamente.", "success");
      } else {
        notify("No se pudo guardar el jugador.", "error");
      }
    } catch {
      notify("Error al guardar. Inténtelo de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  }, [teamPlayer, form, demarcationOptions, setTeamPlayer, setEditing, notify]);

  return { saving, handleSave };
}
