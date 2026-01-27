import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import styles from "./Matchday.module.css";
import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { useUser } from "../../../../shared/context/UserContext";
import {
  getCalendarMatchDay,
  getSettingsForUser,
} from "../../services/federationApi";
import MatchCard from "../../../../shared/components/ui/MatchCard/MatchCard";
import type { SavedComboResponse } from "../../services/Federation/SettingsService";
import { endOfWeek, startOfWeek, isValid, parse, parseISO } from "date-fns";
import type { MatchApiMatch, MatchEntry } from "../../types/match";
import type {
  CalendarMatch,
  CalendarRoundInfo,
} from "../../types/calendarMatchDay";

type MatchdayCombo = {
  team: { id: string; name?: string };
  competition?: { id?: string; name?: string };
  group?: { id?: string; name?: string };
};

type TeamMatchItem = {
  date?: string | null;
  match: MatchApiMatch | MatchEntry;
  team?: { id: string; name?: string };
  competition?: { id?: string; name?: string };
  group?: { id?: string; name?: string };
} & Record<string, unknown>;

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function parseMatchDateTime(raw?: unknown, rawTime?: unknown): Date | null {
  const rawDate = asTrimmedString(raw);
  if (!rawDate) return null;

  const normalized = rawDate.replace(/\//g, "-").trim();
  const time = asTrimmedString(rawTime);
  const withTime = time ? `${normalized} ${time}` : normalized;

  const isoCandidate = parseISO(normalized);
  if (isValid(isoCandidate)) return isoCandidate;

  const dt1 = parse(withTime, "dd-MM-yyyy HH:mm", new Date());
  if (isValid(dt1)) return dt1;
  const dt2 = parse(withTime, "dd-MM-yyyy H:mm", new Date());
  if (isValid(dt2)) return dt2;
  const dt3 = parse(normalized, "dd-MM-yyyy", new Date());
  if (isValid(dt3)) return dt3;

  const fallback = new Date(withTime);
  return isValid(fallback) ? fallback : null;
}

function buildMatchKey(item: TeamMatchItem, parsedDate: Date | null): string {
  const m = item.match as MatchApiMatch & MatchEntry;

  const id =
    asTrimmedString(m.matchRecordCode) ||
    asTrimmedString(m.codacta) ||
    asTrimmedString((m as Record<string, unknown>).cod_acta) ||
    asTrimmedString((m as Record<string, unknown>).id_acta) ||
    asTrimmedString((m as Record<string, unknown>).idacta) ||
    asTrimmedString((m as Record<string, unknown>).actaId) ||
    asTrimmedString((m as Record<string, unknown>).acta_id) ||
    asTrimmedString((m as Record<string, unknown>).acta);
  if (id) return `id:${id}`;

  const local =
    asTrimmedString(m.localTeamCode) || asTrimmedString(m.codigo_equipo_local);
  const visitor =
    asTrimmedString(m.visitorTeamCode) ||
    asTrimmedString(m.codigo_equipo_visitante);
  const dt = parsedDate ? parsedDate.toISOString() : asTrimmedString(item.date);
  const t = asTrimmedString(m.time) || asTrimmedString(m.hora);
  const field = asTrimmedString(m.fieldCode) || asTrimmedString(m.codigo_campo);

  return `cmp:${local}|${visitor}|${dt}|${t}|${field}`;
}

function asMatchEntryFromCalendarMatch(m: CalendarMatch): MatchEntry {
  return {
    codacta: (m.matchRecordCode || "") as string,

    codigo_equipo_local: (m.localTeamCode || "") as string,
    equipo_local: (m.localTeamName || "") as string,
    escudo_equipo_local: (m.localTeamImageUrl || "") as string,
    escudo_equipo_local_url: (m.localTeamImageUrl || "") as string,
    goles_casa: (m.localGoals || "") as unknown as string,

    codigo_equipo_visitante: (m.visitorTeamCode || "") as string,
    equipo_visitante: (m.visitorTeamName || "") as string,
    escudo_equipo_visitante: (m.visitorTeamImageUrl || "") as string,
    escudo_equipo_visitante_url: (m.visitorTeamImageUrl || "") as string,
    goles_visitante: (m.visitorGoals || "") as unknown as string,

    codigo_campo: (m.fieldCode || "") as unknown as string,
    campo: (m.field || "") as string,
    fecha: (m.date || "") as string,
    hora: (m.time || "") as string,

    raw: m,
  } as MatchEntry;
}

function pickRoundForWeek(params: {
  rounds: CalendarRoundInfo[];
  weekStart: Date;
  weekEnd: Date;
  today: Date;
}): number {
  const { rounds, weekStart, weekEnd, today } = params;
  if (!Array.isArray(rounds) || rounds.length === 0) return 1;

  for (const r of rounds) {
    const dt = parseMatchDateTime(r.date, null);
    if (!dt) continue;
    if (dt >= weekStart && dt <= weekEnd) return r.matchDayNumber;
  }

  let best: { round: number; diff: number } | null = null;
  for (const r of rounds) {
    const dt = parseMatchDateTime(r.date, null);
    if (!dt) continue;
    const diff = Math.abs(dt.getTime() - today.getTime());
    if (!best || diff < best.diff) best = { round: r.matchDayNumber, diff };
  }

  return best?.round ?? rounds[0].matchDayNumber ?? 1;
}

export default function Matchday() {
  const { user } = useUser();
  const [matches, setMatches] = useState<TeamMatchItem[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      try {
        // Cargar los settings desde la API
        const savedSettings = (await getSettingsForUser(
          user?.id,
        )) as SavedComboResponse[];
        // logging removed
        if (!savedSettings || savedSettings.length === 0) {
          setHasData(false);
          setMatches([]);
          setLoading(false);
          return;
        }

        // Convertir settings a formato de combos para getTeamMatches
        const combosAll: MatchdayCombo[] = (savedSettings || [])
          .map((setting) => ({
            team: { id: String(setting.teamId ?? ""), name: setting.teamName },
            competition: {
              id: setting.competitionId,
              name: setting.competitionName,
            },
            group: { id: setting.groupId, name: setting.groupName },
          }))
          .filter((c) => Boolean(c.team?.id));

        const combosMap = new Map<string, MatchdayCombo>();
        for (const c of combosAll) {
          const key = `${c.team.id}|${c.competition?.id ?? ""}|${
            c.group?.id ?? ""
          }`;
          if (!combosMap.has(key)) combosMap.set(key, c);
        }
        const combos = Array.from(combosMap.values());
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

        const season = "21";
        const byGroup = new Map<string, MatchdayCombo[]>();
        for (const combo of combos) {
          const groupId = asTrimmedString(combo.group?.id);
          if (!groupId) continue;
          const list = byGroup.get(groupId) ?? [];
          list.push(combo);
          byGroup.set(groupId, list);
        }

        const groupMatches = await Promise.all(
          Array.from(byGroup.entries()).map(async ([groupId, groupCombos]) => {
            const teamIds = new Set(
              groupCombos
                .map((c) => asTrimmedString(c.team?.id))
                .filter(Boolean),
            );
            if (teamIds.size === 0) return [] as TeamMatchItem[];

            const first = await getCalendarMatchDay({
              group: groupId,
              round: 1,
              season,
            });

            const activeRound = pickRoundForWeek({
              rounds: first.rounds,
              weekStart,
              weekEnd,
              today,
            });

            const active =
              activeRound === 1
                ? first
                : await getCalendarMatchDay({
                    group: groupId,
                    round: activeRound,
                    season,
                  });

            const compName = active.competitionName;
            const groupName = active.groupName;

            const items: TeamMatchItem[] = [];
            for (const match of active.matchDay?.matches ?? []) {
              const localId = asTrimmedString(match.localTeamCode);
              const visitorId = asTrimmedString(match.visitorTeamCode);
              if (!teamIds.has(localId) && !teamIds.has(visitorId)) continue;

              items.push({
                date: match.date ?? active.matchDay?.date ?? null,
                match: asMatchEntryFromCalendarMatch(match),
                competition: { name: compName },
                group: { id: groupId, name: groupName },
              });
            }

            return items;
          }),
        );

        const flatMatches = groupMatches.flat() as TeamMatchItem[];
        setHasData(flatMatches.length > 0);

        const unique = new Map<string, { item: TeamMatchItem; dt: Date }>();

        for (const item of flatMatches) {
          const m = item.match as MatchApiMatch & MatchEntry;
          const rawDate =
            (m.date as unknown) ??
            (m.fecha as unknown) ??
            (item.date as unknown) ??
            null;
          const rawTime = (m.time as unknown) ?? (m.hora as unknown) ?? null;
          const dt = parseMatchDateTime(rawDate, rawTime);
          if (!dt) continue;
          if (dt < weekStart || dt > weekEnd) continue;

          const key = buildMatchKey(item, dt);
          if (!unique.has(key)) unique.set(key, { item, dt });
        }

        const matchdayMatches = Array.from(unique.values())
          .sort((a, b) => a.dt.getTime() - b.dt.getTime())
          .map((x) => x.item);

        setMatches(matchdayMatches);
      } catch (error) {
        // error logging removed
        setHasData(false);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();

    // Escuchar cambios en los settings
    window.addEventListener("rffm.saved_combinations_changed", fetchMatches);
    return () => {
      window.removeEventListener(
        "rffm.saved_combinations_changed",
        fetchMatches,
      );
    };
  }, [user]);

  return (
    <BaseLayout>
      <div className={styles.container}>
        <ContentLayout title="Partidos de la Jornada">
          <div className={styles.cards}>
            {loading ? (
              <div className={styles.loading}>
                <CircularProgress />
              </div>
            ) : matches.length === 0 ? (
              <EmptyState description={"No hay partidos para mostrar."} />
            ) : (
              matches.map((match) => {
                const m = match.match as MatchApiMatch & MatchEntry;
                const rec = match as Record<string, unknown>;
                const rawDate =
                  (m.date as unknown) ??
                  (m.fecha as unknown) ??
                  (match.date as unknown) ??
                  null;
                const rawTime =
                  (m.time as unknown) ?? (m.hora as unknown) ?? null;
                const parsedDate = parseMatchDateTime(rawDate, rawTime);
                const matchKey = buildMatchKey(match, parsedDate);
                // Mejorar robustez: buscar nombre en más variantes
                const competitionObj = rec["competition"];
                const groupObj = rec["group"];
                let comp =
                  asTrimmedString(match.competition?.name) ||
                  asTrimmedString(rec["competitionName"]) ||
                  (competitionObj && typeof competitionObj === "object"
                    ? asTrimmedString(
                        (competitionObj as Record<string, unknown>)["name"],
                      )
                    : "") ||
                  asTrimmedString(rec["competitionId"]) ||
                  "";
                let group =
                  asTrimmedString(match.group?.name) ||
                  asTrimmedString(rec["groupName"]) ||
                  (groupObj && typeof groupObj === "object"
                    ? asTrimmedString(
                        (groupObj as Record<string, unknown>)["name"],
                      )
                    : "") ||
                  asTrimmedString(rec["groupId"]) ||
                  "";
                // Si sigue vacío, mostrar id si existe
                if (
                  !comp &&
                  match.competition &&
                  typeof match.competition === "object" &&
                  match.competition.id
                )
                  comp = `Comp. ${match.competition.id}`;
                if (
                  !group &&
                  match.group &&
                  typeof match.group === "object" &&
                  match.group.id
                )
                  group = `Grupo ${match.group.id}`;
                // Extraer y formatear la fecha
                const matchDate =
                  match.match?.fecha || match.match?.date || match.date;
                let dateStr = "";
                if (parsedDate) {
                  dateStr = parsedDate.toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                } else if (matchDate) {
                  try {
                    const date = new Date(matchDate);
                    dateStr = date.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                  } catch {}
                }

                return (
                  <div key={matchKey} className={styles.matchCardWrapper}>
                    <div className={styles.chipsContainer}>
                      <span className={styles.competitionChip}>{comp}</span>
                      {group && (
                        <span className={styles.groupChip}>{group}</span>
                      )}
                    </div>
                    {dateStr && (
                      <div className={styles.matchDate}>{dateStr}</div>
                    )}
                    <MatchCard item={match} />
                  </div>
                );
              })
            )}
          </div>
        </ContentLayout>
      </div>
    </BaseLayout>
  );
}
