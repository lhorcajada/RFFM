import { useCallback, useState } from "react";
import type { DemarcationOption } from "../../../services/demarcationService";
import teamplayerService from "../../../services/teamplayerService";
import { mapApiErrorToMessage } from "../../../../../shared/utils/errorMessages";

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
          enfermedades: form.enfermedades ?? null,
          alergias: form.alergias ?? null,
          procedencia: form.procedencia ?? null,
        },
        demarcation: {
          activePositionId: form.activePositionId ?? null,
          activePositionName: form.activePositionName ?? null,
          possibleDemarcations: possibleIds,
        },
        contactInfo: {
          phone: form.phone ?? null,
          email: form.email ?? null,
          address: {
            street: form.street ?? null,
            city: form.city ?? null,
            postalCode: form.postalCode ?? null,
            province: form.province ?? null,
            country: form.country ?? null,
          },
        },
        physicalInfo: {
          height: parseNumber(form.height),
          weight: parseNumber(form.weight),
          dominantFoot: form.dominantFoot ?? null,
          dominantFootId: form.dominantFootId ?? null,
        },
        // Family members are created/deleted individually via
        // createFamilyMember/deleteFamilyMember (FamilyMembersEdit.tsx), never via
        // this bulk PUT: UpdateTeamPlayer.SetFamily replaces the whole collection
        // without stable Ids, which would silently wipe out members added/removed
        // through the dedicated endpoints.
      };

      const updated = await teamplayerService.updateTeamPlayer(teamPlayer.id, payload);
      if (updated) {
        setTeamPlayer(updated);
        setEditing(false);
        notify("Jugador guardado correctamente.", "success");
      } else {
        notify("No se pudo guardar el jugador.", "error");
      }
    } catch (e) {
      notify(mapApiErrorToMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }, [teamPlayer, form, demarcationOptions, setTeamPlayer, setEditing, notify]);

  return { saving, handleSave };
}
