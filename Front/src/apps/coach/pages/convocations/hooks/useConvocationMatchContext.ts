import { useEffect, useState } from "react";
import { getSeasonPlayerStats } from "../../../services/liveMatchService";
import { getSettingsForUser } from "../../../../federation/services/federationApi";
import federationService from "../../../services/federationService";
import attendanceSummaryService from "../../../services/attendanceSummaryService";
import { getTeamInjuries, getPlayersByTeam, type PlayerResponse } from "../../../services/teamplayerService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import convocationService from "../../../services/convocationService";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { WeeklyTrainingStats } from "../utils/deconvokeProposal";
import { endOfWeekIso, getAllSportEventsInRange, startOfWeekIso, toIsoDay } from "../helpers/convocationMatchDetail.helpers";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";

type TrainingSummaryPlayer = {
  teamPlayerId?: string | null;
  playerId?: string | null;
  attendedTrainings?: number;
  totalTrainings?: number;
  absences?: Array<{ eventId: string }>;
};

export type ConvocationMatchContext = {
  seasonEvents: SportEventResponse[];
  seasonStats: SeasonPlayerStats[];
  gridStartsCountMap: Map<string, number>;
  lastInjuryEndMap: Map<string, string | null>;
  weekTrainingStatsMap: Map<string, WeeklyTrainingStats>;
  weekTrainingCount: number;
  loadingProposalContext: boolean;
};

export function useConvocationMatchContext(
  teamId: string,
  matchDate: string | undefined,
  seasonId: string | null,
  convocationPlayers: PlayerResponse[],
  enabled: boolean = true,
): ConvocationMatchContext {
  const [seasonEvents, setSeasonEvents] = useState<SportEventResponse[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonPlayerStats[]>([]);
  const [gridStartsCountMap, setGridStartsCountMap] = useState<Map<string, number>>(new Map());
  const [lastInjuryEndMap, setLastInjuryEndMap] = useState<Map<string, string | null>>(new Map());
  const [weekTrainingStatsMap, setWeekTrainingStatsMap] = useState<Map<string, WeeklyTrainingStats>>(new Map());
  const [weekTrainingCount, setWeekTrainingCount] = useState(0);
  const [loadingProposalContext, setLoadingProposalContext] = useState(false);

  useEffect(() => {
    if (!teamId || !matchDate || !enabled) {
      setSeasonEvents([]);
      setSeasonStats([]);
      setGridStartsCountMap(new Map());
      setWeekTrainingStatsMap(new Map());
      setWeekTrainingCount(0);
      return;
    }

    const matchIso = matchDate.slice(0, 10);
    const year = Number(matchIso.slice(0, 4));
    const month = Number(matchIso.slice(5, 7));
    const seasonStartYear = month >= 7 ? year : year - 1;
    const seasonStart = `${seasonStartYear}-07-01`;

    let mounted = true;
    setLoadingProposalContext(true);

    Promise.all([
      getAllSportEventsInRange(teamId, seasonStart, matchIso),
      getSeasonPlayerStats(teamId),
      attendanceSummaryService.getTrainingAttendanceSummary(teamId, seasonId).catch(() => null),
      import("../../../services/sportEventService").then((mod) =>
        mod.default.getSportEvents(teamId, 1, 200, startOfWeekIso(matchIso), endOfWeekIso(matchIso), false),
      ),
      sportEventTypeService.getSportEventTypes().catch(() => []),
    ])
      .then(async ([seasonEventsAll, stats, trainingSummary, weekEventsResp, eventTypes]) => {
        if (!mounted) return;
        const trainingTypeIds = new Set<number>();
        const matchTypeIds = new Set<number>();
        eventTypes.forEach((t) => {
          const name = (t.name ?? "").toLowerCase();
          if (name.includes("entren") || name.includes("training")) {
            trainingTypeIds.add(t.id);
          }
          if (name.includes("partido") || name.includes("match") || name.includes("liga")) {
            matchTypeIds.add(t.id);
          }
        });

        const filtered = seasonEventsAll.filter((ev) => {
          const eventType = (ev.eventType ?? "").toLowerCase();
          const title = (ev.title ?? ev.name ?? "").toLowerCase();
          return (
            (ev.eventTypeId != null && matchTypeIds.has(ev.eventTypeId)) ||
            eventType.includes("partido") ||
            eventType.includes("match") ||
            eventType.includes("liga") ||
            title.includes("partido") ||
            title.includes("jornada")
          );
        });
        const officialMatches = filtered.filter((ev) => {
          const eventType = (ev.eventType ?? "").toLowerCase();
          const title = (ev.title ?? ev.name ?? "").toLowerCase();
          return !(/amist|friendly/.test(eventType) || /amist|friendly/.test(title));
        });
        setSeasonEvents(officialMatches);

        setSeasonStats(stats);
        try {
          const settings = await getSettingsForUser();
          const primary = Array.isArray(settings) && settings.length > 0 ? (settings.find((s: any) => s.isPrimary) ?? settings[0]) : null;
          const competitionId = primary?.competitionId;
          const groupId = primary?.groupId;
          const fedTeamId = primary?.teamId;
          if (competitionId && groupId && fedTeamId) {
            const fullRoster = await getPlayersByTeam(teamId).catch(() => []);
            const rosterById = new Map(fullRoster.map((p) => [p.id.toLowerCase(), p]));
            const rosterByPlayerId = new Map(
              fullRoster.filter((p) => p.playerId).map((p) => [p.playerId!.toLowerCase(), p]),
            );
            const findInRoster = (id: string, pid?: string | null) =>
              rosterById.get(id.toLowerCase()) ??
              (pid ? rosterByPlayerId.get(pid.toLowerCase()) : undefined);
            const goles = await federationService.getTeamGoleadores(competitionId, groupId, fedTeamId);
            if (Array.isArray(goles) && goles.length > 0) {
              const goalsByPid = new Map<string, number>();
              const goalsByName = new Map<string, number>();
              const normalize = (s: string | null | undefined) =>
                (s ?? "")
                  .toString()
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/\p{Diacritic}/gu, "")
                  .replace(/[^a-z0-9]/g, "");
              const normalizeWords = (s: string | null | undefined): string[] =>
                (s ?? "")
                  .toString()
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/\p{Diacritic}/gu, "")
                  .split(/[^a-z0-9]+/)
                  .filter(Boolean);
              const tokenMatch = (cand: string, fedName: string): boolean => {
                const tokens = normalizeWords(cand);
                const gn = normalize(fedName);
                return tokens.length >= 2 && tokens.every((t) => gn.includes(t));
              };
              const reverseTokenMatch = (cand: string, fedName: string): boolean => {
                const fedTokens = normalizeWords(fedName).filter((t) => t.length >= 3);
                const nc = normalize(cand);
                return fedTokens.length >= 2 && fedTokens.every((t) => nc.includes(t));
              };

              for (const g of goles) {
                const pid = String(g.playerId ?? "");
                const score = Number(g.scores ?? 0) || 0;
                if (pid) goalsByPid.set(pid, score);
                const n = normalize(g.playerName ?? "");
                if (n) goalsByName.set(n, score);
              }

              let mergedStats: SeasonPlayerStats[] = [];
              if (!Array.isArray(stats) || stats.length === 0) {
                mergedStats = convocationPlayers.map((p) => {
                  const fedPid = p.playerId ?? null;
                  let goals: number | null = null;
                  if (fedPid && goalsByPid.has(String(fedPid))) goals = goalsByPid.get(String(fedPid)) ?? null;
                  else {
                    const full = findInRoster(p.id, p.playerId);
                    const candidates: string[] = [];
                    if (p.alias) candidates.push(p.alias);
                    const fullName = [full?.name ?? p.name, full?.lastName ?? (p as any).lastName].filter(Boolean).join(" ");
                    if (fullName && !candidates.some((c) => normalize(c) === normalize(fullName))) candidates.push(fullName);
                    if (candidates.length === 0 && p.name) candidates.push(p.name);
                    for (const cand of candidates) {
                      const nc = normalize(cand);
                      if (!nc) continue;
                      if (goalsByName.has(nc)) {
                        goals = goalsByName.get(nc) ?? 0;
                        break;
                      }
                      const found = goles.find((g) => {
                        const gn = normalize(g.playerName ?? "");
                        return gn.includes(nc) || nc.includes(gn) || tokenMatch(cand, g.playerName ?? "") || reverseTokenMatch(cand, g.playerName ?? "");
                      });
                      if (found) {
                        goals = Number(found.scores ?? 0);
                        break;
                      }
                    }
                  }
                  return {
                    teamPlayerId: p.id,
                    totalGoals: goals ?? 0,
                    totalMinutes: 0,
                    totalStarts: 0,
                    totalMatches: 0,
                  } as SeasonPlayerStats;
                });
              } else {
                mergedStats = stats.map((s: any) => {
                  const player = convocationPlayers.find((p) => p.id === s.teamPlayerId);
                  const fedPid = player?.playerId ?? null;
                  if (fedPid && goalsByPid.has(String(fedPid))) {
                    const g = goalsByPid.get(String(fedPid));
                    return { ...s, totalGoals: g };
                  }
                  if (player) {
                    const full = findInRoster(player.id, player.playerId);
                    const candidates: string[] = [];
                    if (player.alias) candidates.push(player.alias);
                    const fullName = [full?.name ?? player.name, full?.lastName ?? (player as any).lastName].filter(Boolean).join(" ");
                    if (fullName && !candidates.some((c) => normalize(c) === normalize(fullName))) candidates.push(fullName);
                    if (candidates.length === 0 && player.name) candidates.push(player.name);
                    for (const cand of candidates) {
                      const nc = normalize(cand);
                      if (!nc) continue;
                      if (goalsByName.has(nc)) {
                        const g = goalsByName.get(nc);
                        return { ...s, totalGoals: g };
                      }
                      const found = goles.find((g) => {
                        const gn = normalize(g.playerName ?? "");
                        return gn.includes(nc) || nc.includes(gn) || tokenMatch(cand, g.playerName ?? "") || reverseTokenMatch(cand, g.playerName ?? "");
                      });
                      if (found) {
                        const score = Number(found.scores ?? 0);
                        return { ...s, totalGoals: score };
                      }
                    }
                  }
                  return s;
                });
              }

              setSeasonStats(mergedStats);
            }
          }
        } catch {
          /* ignore federation enrichment errors */
        }

        const startsMap = new Map<string, number>();
        await Promise.all(
          officialMatches.map(async (ev) => {
            try {
              const lineup = await import("../../../services/idealLineupService").then((mod) => mod.getIdealLineup(teamId, ev.id));
              if (!lineup) return;
              for (const slot of lineup.slots) {
                if (slot.teamPlayerId) {
                  startsMap.set(slot.teamPlayerId, (startsMap.get(slot.teamPlayerId) ?? 0) + 1);
                }
              }
            } catch {
              /* ignore individual failures */
            }
          }),
        );
        if (mounted) setGridStartsCountMap(startsMap);

        const weekTrainings = weekEventsResp.items.filter((ev) => {
          const eventType = (ev.eventType ?? "").toLowerCase();
          const title = (ev.title ?? ev.name ?? "").toLowerCase();
          return (
            (ev.eventTypeId != null && trainingTypeIds.has(ev.eventTypeId)) ||
            eventType.includes("entren") ||
            eventType.includes("training") ||
            title.includes("entren") ||
            title.includes("training")
          );
        });
        setWeekTrainingCount(weekTrainings.length);
        const weekTrainingIds = new Set(weekTrainings.map((t) => t.id));
        const todayIso = toIsoDay(new Date().toISOString());
        const pastSeasonTrainingsCount = seasonEventsAll.filter((training) => {
          const trainingDay = toIsoDay(training.start ?? training.startTime ?? training.eveDateTime ?? "");
          return !!trainingDay && !!todayIso && trainingDay <= todayIso;
        }).length;

        const trainingSummaryById = new Map<string, TrainingSummaryPlayer>();
        const seasonTrainingSummaryPlayers = (trainingSummary?.players ?? []) as TrainingSummaryPlayer[];
        seasonTrainingSummaryPlayers.forEach((player) => {
          const byTeamPlayerId = String(player.teamPlayerId ?? "").toLowerCase();
          const byPlayerId = String(player.playerId ?? "").toLowerCase();
          if (byTeamPlayerId) trainingSummaryById.set(byTeamPlayerId, player);
          if (byPlayerId) trainingSummaryById.set(byPlayerId, player);
        });

        const playerStats = new Map<string, WeeklyTrainingStats>();
        convocationPlayers.forEach((p) => {
          const summary =
            trainingSummaryById.get(p.id.toLowerCase()) ??
            (p.playerId ? trainingSummaryById.get(p.playerId.toLowerCase()) : undefined);

          const weeklyAbsences = summary?.absences?.filter((absence) => weekTrainingIds.has(absence.eventId)).length ?? 0;
          const attendedTrainings = Math.max(0, weekTrainings.length - weeklyAbsences);
          const attendedTrainingsSeason = summary?.attendedTrainings ?? 0;
          const totalTrainingsSeason = summary?.totalTrainings ?? pastSeasonTrainingsCount;
          const knownUnavailableTrainings = weeklyAbsences;
          const unresolvedTrainings = Math.max(0, weekTrainings.length - attendedTrainings - knownUnavailableTrainings);

          playerStats.set(p.id, {
            totalTrainings: weekTrainings.length,
            attendedTrainings,
            attendedTrainingsSeason,
            totalTrainingsSeason,
            knownUnavailableTrainings,
            unresolvedTrainings,
          });
        });

        setWeekTrainingStatsMap(playerStats);
      })
      .catch(() => {
        if (!mounted) return;
        setSeasonEvents([]);
        setSeasonStats([]);
        setGridStartsCountMap(new Map());
        setWeekTrainingCount(0);
        setWeekTrainingStatsMap(new Map());
      })
      .finally(() => {
        if (mounted) setLoadingProposalContext(false);
      });

    return () => {
      mounted = false;
    };
  }, [teamId, matchDate, seasonId, convocationPlayers, enabled]);

  useEffect(() => {
    if (!teamId || !enabled || convocationPlayers.length === 0) {
      setLastInjuryEndMap(new Map());
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const teamInjuries = await getTeamInjuries(teamId);
        const injuriesByPlayer = new Map(teamInjuries.map((t) => [t.teamPlayerId, t.injuries]));
        const map = new Map<string, string | null>();
        for (const p of convocationPlayers) {
          const injuries = injuriesByPlayer.get(p.id) ?? [];
          const latestEnded = injuries
            .filter((inj) => !!inj.endDate)
            .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0]?.endDate ?? null;
          map.set(p.id, latestEnded);
        }
        if (mounted) setLastInjuryEndMap(map);
      } catch {
        if (mounted) setLastInjuryEndMap(new Map());
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamId, convocationPlayers, enabled]);

  return {
    seasonEvents,
    seasonStats,
    gridStartsCountMap,
    lastInjuryEndMap,
    weekTrainingStatsMap,
    weekTrainingCount,
    loadingProposalContext,
  };
}