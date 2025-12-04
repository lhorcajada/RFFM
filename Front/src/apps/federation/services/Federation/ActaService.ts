import { client } from "../../../../core/api/client";
import type { Acta } from "../../types/acta";

export class ActaService {
  async getActa(
    codacta: string,
    params?: { temporada?: string; competicion?: string; grupo?: string }
  ) {
    // Build query params, using passed params first, then falling back
    // to localStorage selection (`rffm.current_selection`, then saved combinations)
    let temporada = params?.temporada;
    let competicion = params?.competicion;
    let grupo = params?.grupo;
    let equipo: string | undefined = undefined;

    try {
      // Try current selection first
      const cur = localStorage.getItem("rffm.current_selection");
      let combo: any = null;
      if (cur) {
        try {
          combo = JSON.parse(cur);
        } catch (e) {
          combo = null;
        }
      }

      // If no current, load saved combinations and pick primary
      if (!combo) {
        const raw = localStorage.getItem("rffm.saved_combinations_v1");
        const arr = raw ? JSON.parse(raw) : [];
        const primaryId = localStorage.getItem("rffm.primary_combination_id");
        if (Array.isArray(arr) && arr.length > 0) {
          if (primaryId)
            combo = arr.find((c: any) => String(c.id) === String(primaryId));
          if (!combo) combo = arr.find((c: any) => c.isPrimary) || arr[0];
        }
      }

      if (combo) {
        if (!competicion && combo.competition && combo.competition.id)
          competicion = String(combo.competition.id);
        if (!grupo && combo.group && combo.group.id)
          grupo = String(combo.group.id);
        if (combo.team && combo.team.id) equipo = String(combo.team.id);
      }
    } catch (e) {
      // ignore localStorage errors (e.g., SSR or parsing issues)
    }

    const q = new URLSearchParams();
    if (temporada) q.append("temporada", temporada);
    if (competicion) q.append("competicion", competicion);
    if (grupo) q.append("grupo", grupo);
    if (equipo) q.append("equipo", equipo);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await client.get(`acta/${encodeURIComponent(codacta)}${qs}`);
    return res.data as Acta;
  }
}

export const actaService = new ActaService();
