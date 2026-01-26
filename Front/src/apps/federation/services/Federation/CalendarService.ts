import { client } from "../../../../core/api/client";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { settingsService } from "../Federation";
import type {
  CalendarResponse,
  MatchEntry,
  Round,
  MatchApiResponse,
} from "../../types/match";
import type { CalendarMatchDayWithRoundsResponse } from "../../types/calendarMatchDay";

export class CalendarService {
  async getCalendar(params?: {
    season?: string;
    competition?: string;
    group?: string;
    playType?: string;
  }): Promise<CalendarResponse | MatchApiResponse> {
    const q = new URLSearchParams();
    if (params?.season) q.append("season", params.season);
    if (params?.competition) q.append("competitionId", params.competition);
    if (params?.group) q.append("groupId", params.group);
    if (params?.playType) q.append("playType", params.playType);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await client.get(`calendar${qs}`);
    const raw = res.data as any;

    // If the API returns the new `matchDays` payload we can return it directly
    if (raw && (raw.matchDays || raw.matchDays === null)) {
      // ensure it's typed as MatchApiResponse
      return raw as MatchApiResponse;
    }

    // Otherwise fall back to previous `rounds`/`jornadas` normalization
    function normalizeMatch(r: any): MatchEntry {
      if (!r) return {} as MatchEntry;
      return {
        codacta:
          r.codacta ??
          r.cod_acta ??
          r.id_acta ??
          r.idacta ??
          r.actaId ??
          r.acta_id ??
          r.acta,
        codigo_equipo_local:
          r.codigo_equipo_local ??
          r.codigo_local ??
          r.cod_equipo_local ??
          r.localTeamId ??
          r.localCode,
        escudo_equipo_local:
          r.escudo_equipo_local ?? r.escudo_local ?? r.localImage ?? "",
        escudo_equipo_local_url:
          r.escudo_equipo_local_url ??
          r.escudo_equipo_local ??
          r.localImage ??
          "",
        equipo_local:
          r.equipo_local ?? r.localTeamName ?? r.local ?? r.nombre ?? "",
        goles_casa: r.goles_casa ?? r.LocalGoals ?? r.goles ?? null,

        codigo_equipo_visitante:
          r.codigo_equipo_visitante ??
          r.codigo_visitante ??
          r.cod_equipo_visitante ??
          r.awayTeamId ??
          r.awayCode,
        escudo_equipo_visitante:
          r.escudo_equipo_visitante ?? r.escudo_visitante ?? r.awayImage ?? "",
        escudo_equipo_visitante_url:
          r.escudo_equipo_visitante_url ??
          r.escudo_equipo_visitante ??
          r.awayImage ??
          "",
        equipo_visitante:
          r.equipo_visitante ??
          r.awayTeamName ??
          r.visitante ??
          r.nombre_visitante ??
          "",
        goles_visitante: r.goles_visitante ?? r.AwayGoals ?? r.goles_v ?? null,

        codigo_campo: r.codigo_campo ?? r.codigo_campo ?? r.codigoCampo ?? null,
        campo: r.campo ?? r.field ?? "",
        fecha: r.fecha ?? r.date ?? "",
        hora: r.hora ?? r.time ?? r.hour ?? "",

        // keep the original raw object for any other use
        raw: r,
      } as MatchEntry;
    }

    const normalized: CalendarResponse = {
      estado: raw?.estado ?? raw?.status,
      sesion_ok: raw?.sesion_ok,
      competicion: raw?.competicion,
      tipo_competicion: raw?.tipo_competicion,
      grupo: raw?.grupo,
      temporada: raw?.temporada,
      rounds: (raw?.rounds ?? raw?.jornadas ?? []).map((rr: any) => {
        const equipos = (rr.equipos ??
          rr.partidos ??
          rr.matches ??
          []) as any[];
        return {
          codjornada: rr.codjornada ?? rr.cod_jornada ?? rr.id ?? undefined,
          jornada: rr.jornada ?? rr.jornada ?? undefined,
          equipos: (equipos || []).map(normalizeMatch),
          raw: rr,
        } as Round;
      }),
    };

    return normalized;
  }

  async getCalendarMatchDay(params: {
    group: string;
    round: number;
    season?: string;
    playType?: string;
  }): Promise<CalendarMatchDayWithRoundsResponse> {
    const q = new URLSearchParams();
    q.append("groupId", params.group);
    q.append("round", String(params.round));
    if (params.season) q.append("season", params.season);
    if (params.playType) q.append("playType", params.playType);
    const res = await client.get(`calendar/matchday?${q.toString()}`);
    return res.data as CalendarMatchDayWithRoundsResponse;
  }

  async getTeamMatches(
    teamId: string,
    params?: {
      season?: string;
      competition?: string;
      group?: string;
      playType?: string;
    },
  ) {
    // Reuse getCalendar and filter matches where team appears (by id or name)
    // If params are not provided, try to load the saved calendar selection from localStorage
    let finalParams: Record<string, any> = params ? { ...params } : {};
    try {
      // Prefer loading saved selection from API for the authenticated user
      const userId = coachAuthService.getUserId();
      if (userId && !params) {
        const combos = await settingsService.getSettingsForUser(userId);
        if (Array.isArray(combos) && combos.length > 0) {
          const primary = combos.find((c: any) => c.isPrimary) || combos[0];
          if (primary) {
            finalParams = Object.assign(
              {},
              {
                season: primary.seasonId ?? primary.season,
                competition: primary.competitionId ?? primary.competition?.id,
                group: primary.groupId ?? primary.group?.id,
                playType: primary.playType ?? primary.play_type,
              },
              finalParams || {},
            );
          }
        }
      } else {
        // No authenticated user or params supplied: keep previous behavior (do not read localStorage)
      }
    } catch (err) {
      // ignore and proceed
    }
    // Ensure we pass primitive IDs/strings to getCalendar (avoid objects like { id: '123' })
    const coerce = (v: any) => {
      if (v == null) return undefined;
      if (typeof v === "object")
        return String(v.id ?? v.value ?? v.code ?? "").trim() || undefined;
      const s = String(v ?? "").trim();
      return s === "" ? undefined : s;
    };

    const safeParams: Record<string, any> = {
      season: coerce(finalParams.season),
      competition: coerce(finalParams.competition),
      group: coerce(finalParams.group),
      playType: coerce(finalParams.playType),
    };

    const cal = await this.getCalendar(safeParams);
    const rounds: any[] = [];
    if (!cal) return [];
    // support both MatchApiResponse and CalendarResponse
    if ((cal as any).matchDays) {
      const md = (cal as any).matchDays as any[];
      for (const day of md || []) {
        for (const m of day.matches || []) {
          const localId = String(m.localTeamCode ?? m.localTeamId ?? "").trim();
          const visitorId = String(
            m.visitorTeamCode ?? m.visitorTeamId ?? "",
          ).trim();
          const localName = String(m.localTeamName ?? "").trim();
          const visitorName = String(m.visitorTeamName ?? "").trim();
          if (
            localId === String(teamId) ||
            visitorId === String(teamId) ||
            localName === String(teamId) ||
            visitorName === String(teamId)
          ) {
            rounds.push({ date: day.date, match: m });
          }
        }
      }
    } else if ((cal as any).rounds) {
      for (const r of (cal as any).rounds || []) {
        const matches = r.equipos ?? r.partidos ?? r.matches ?? [];
        for (const m of matches) {
          const localId = String(
            m.codigo_equipo_local ?? m.codigo_local ?? m.localTeamId ?? "",
          ).trim();
          const visitorId = String(
            m.codigo_equipo_visitante ??
              m.codigo_visitante ??
              m.awayTeamId ??
              "",
          ).trim();
          const localName = String(
            m.equipo_local ?? m.localTeamName ?? m.local ?? "",
          ).trim();
          const visitorName = String(
            m.equipo_visitante ?? m.awayTeamName ?? m.visitante ?? "",
          ).trim();
          if (
            localId === String(teamId) ||
            visitorId === String(teamId) ||
            localName === String(teamId) ||
            visitorName === String(teamId)
          ) {
            rounds.push({ date: m.fecha ?? m.date ?? null, match: m });
          }
        }
      }
    }
    return rounds;
  }
}

export const calendarService = new CalendarService();
