import { client } from "../../../../core/api/client";
import type {
  ClassificationResponse,
  ClassificationTeam,
} from "../../types/classification";

export class ClassificationService {
  async getTeamsForClassification(params: {
    season?: string;
    competition?: string;
    group?: string;
    playType?: string;
  }) {
    const q = new URLSearchParams();
    if (params.season) q.append("season", params.season);
    if (params.competition) q.append("competition", params.competition);
    if (params.group) q.append("group", params.group);
    if (params.playType) q.append("playType", params.playType);
    const res = await client.get(`classification?${q.toString()}`);
    const raw = res.data as ClassificationResponse | any;
    const list: ClassificationTeam[] = Array.isArray(raw)
      ? raw
      : raw?.teams ?? raw?.classifications ?? [];

    return (list || []).map((r: ClassificationTeam) => {
      const parseNum = (v: any) => {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      return {
        color: r?.color ?? "",
        position: parseNum(r?.position ?? r?.posicion ?? 0),
        imageUrl: r?.imageUrl ?? r?.url_img ?? r?.escudo_equipo ?? "",
        teamId: r?.teamId ?? r?.codequipo ?? r?.codigo_equipo ?? "",
        teamName: r?.teamName ?? r?.nombre ?? r?.nombre_equipo ?? "",
        played: parseNum(r?.played ?? r?.jugados ?? 0),
        won: parseNum(r?.won ?? r?.ganados ?? 0),
        lost: parseNum(r?.lost ?? r?.perdidos ?? 0),
        drawn: parseNum(r?.drawn ?? r?.empatados ?? 0),
        penalties: parseNum(r?.penalties ?? r?.penaltis ?? 0),
        goalsFor: parseNum(r?.goalsFor ?? r?.goles_a_favor ?? 0),
        goalsAgainst: parseNum(r?.goalsAgainst ?? r?.goles_en_contra ?? 0),
        homePlayed: parseNum(r?.homePlayed ?? r?.jugados_casa ?? 0),
        homeWon: parseNum(r?.homeWon ?? r?.ganados_casa ?? 0),
        homeDrawn: parseNum(r?.homeDrawn ?? r?.empatados_casa ?? 0),
        homePenaltyWins: parseNum(
          r?.homePenaltyWins ?? r?.ganados_penalti_casa ?? 0
        ),
        homeLost: parseNum(r?.homeLost ?? r?.perdidos_casa ?? 0),
        awayPlayed: parseNum(r?.awayPlayed ?? r?.jugados_fuera ?? 0),
        awayWon: parseNum(r?.awayWon ?? r?.ganados_fuera ?? 0),
        awayDrawn: parseNum(r?.awayDrawn ?? r?.empatados_fuera ?? 0),
        awayPenaltyWins: parseNum(
          r?.awayPenaltyWins ?? r?.ganados_penalti_fuera ?? 0
        ),
        awayLost: parseNum(r?.awayLost ?? r?.perdidos_fuera ?? 0),
        points: parseNum(r?.points ?? r?.puntos ?? 0),
        sanctionPoints: parseNum(r?.sanctionPoints ?? r?.puntos_sancion ?? 0),
        homePoints: parseNum(r?.homePoints ?? r?.puntos_local ?? 0),
        awayPoints: parseNum(r?.awayPoints ?? r?.puntos_visitante ?? 0),
        showCoefficient: Boolean(
          r?.showCoefficient ?? r?.mostrar_coeficiente ?? false
        ),
        coefficient: parseNum(r?.coefficient ?? r?.coeficiente ?? 0),
        matchStreaks:
          (r?.matchStreaks ?? r?.racha_partidos ?? []).map((s: any) => ({
            type: s?.type ?? s?.tipo ?? "",
            color: s?.color ?? s?.color ?? "",
          })) || [],
        raw: r,
      };
    });
  }
}

export const classificationService = new ClassificationService();
