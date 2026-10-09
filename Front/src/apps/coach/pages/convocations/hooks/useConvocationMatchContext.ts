import { useEffect, useMemo, useState } from "react";
import { getSeasonPlayerStats } from "../../../services/liveMatchService";
import { getSettingsForUser } from "../../../../federation/services/federationApi";
import federationService from "../../../services/federationService";
import attendanceSummaryService, { type TeamConvocationRow } from "../../../services/attendanceSummaryService";
import { getTeamInjuries, getPlayersByTeam, type PlayerResponse } from "../../../services/teamplayerService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import convocationService from "../../../services/convocationService";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { WeeklyTrainingStats } from "../utils/deconvokeProposal";
import { countMissedEventsDuringInjury, type InjuryWindow } from "../utils/injuryMissedEvents";
import { absencePenalty, classifyFriendlyConvocation, forcesDeconvocation, isFriendlyEvent } from "../utils/attendanceWeights";
import { getAllSportEventsInRange, previousDaysRangeIso, toIsoDay } from "../helpers/convocationMatchDetail.helpers";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";

type TrainingSummaryPlayer = {
  teamPlayerId?: string | null;
  playerId?: string | null;
  attendedTrainings?: number;
  totalTrainings?: number;
  absences?: Array<{ eventId: string; date?: string | null; excuseTypeId?: number | null }>;
};

type AttendanceAbsence = { excuseTypeId?: number | null };

function weightedAttendance(attended: number, absences: AttendanceAbsence[]): number {
  return absences.reduce((sum, absence) => sum + 1 - absencePenalty(absence.excuseTypeId), attended);
}

export type ConvocationMatchContext = {
  seasonEvents: SportEventResponse[];
  seasonStats: SeasonPlayerStats[];
  gridStartsCountMap: Map<string, number>;
  lastInjuryEndMap: Map<string, string | null>;
  lastInjuryMissedEventsMap: Map<string, number>;
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
  const [lastInjuryWindowMap, setLastInjuryWindowMap] = useState<Map<string, InjuryWindow>>(new Map());
  const [trainingAbsenceDaysMap, setTrainingAbsenceDaysMap] = useState<Map<string, string[]> | null>(null);
  const [matchDays, setMatchDays] = useState<string[]>([]);
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
      setTrainingAbsenceDaysMap(null);
      setMatchDays([]);
      return;
    }

    const matchIso = matchDate.slice(0, 10);
    const year = Number(matchIso.slice(0, 4));
    const month = Number(matchIso.slice(5, 7));
    const seasonStartYear = month >= 7 ? year : year - 1;
    const seasonStart = `${seasonStartYear}-07-01`;

    const preMatchWeek = previousDaysRangeIso(matchIso, 7);

    let mounted = true;
    setLoadingProposalContext(true);

    Promise.all([
      getAllSportEventsInRange(teamId, seasonStart, matchIso),
      getSeasonPlayerStats(teamId),
      attendanceSummaryService.getTrainingAttendanceSummary(teamId, seasonId).catch(() => null),
      import("../../../services/sportEventService").then((mod) =>
        mod.default.getSportEvents(teamId, 1, 200, preMatchWeek.from, preMatchWeek.to, false),
      ),
      sportEventTypeService.getSportEventTypes().catch(() => []),
      attendanceSummaryService.getTeamConvocationsSummary(teamId).catch(() => []),
    ])
      .then(async ([seasonEventsAll, stats, trainingSummary, weekEventsResp, eventTypes, teamConvocations]) => {
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
        setMatchDays(
          filtered
            .map((ev) => ev.start ?? ev.startTime ?? ev.eveDateTime ?? "")
            .filter(Boolean)
            .map((d) => toIsoDay(d)),
        );

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

        const now = Date.now();
        // Events not held yet have no attendance, so they can't count as attended.
        const isHeld = (ev: SportEventResponse) => {
          const startMs = new Date(ev.start ?? ev.startTime ?? ev.eveDateTime ?? "").getTime();
          return !Number.isNaN(startMs) && startMs <= now;
        };
        const isHeldTraining = (ev: SportEventResponse) => {
          const eventType = (ev.eventType ?? "").toLowerCase();
          const title = (ev.title ?? ev.name ?? "").toLowerCase();
          if (!isHeld(ev)) return false;
          return (
            (ev.eventTypeId != null && trainingTypeIds.has(ev.eventTypeId)) ||
            eventType.includes("entren") ||
            eventType.includes("training") ||
            title.includes("entren") ||
            title.includes("training")
          );
        };
        const weekTrainings = weekEventsResp.items.filter(isHeldTraining);
        setWeekTrainingCount(weekTrainings.length);
        const weekTrainingIds = new Set(weekTrainings.map((t) => t.id));
        const weekFriendlyIds = weekEventsResp.items.filter((ev) => isHeld(ev) && isFriendlyEvent(ev)).map((ev) => ev.id);
        const seasonFriendlyIds = seasonEventsAll.filter((ev) => isHeld(ev) && isFriendlyEvent(ev)).map((ev) => ev.id);
        const convocationsByPlayer = new Map<string, Map<string, TeamConvocationRow>>();
        teamConvocations.forEach((row) => {
          [row.teamPlayerId, row.playerId].forEach((key) => {
            if (!key) return;
            const byEvent = convocationsByPlayer.get(key.toLowerCase()) ?? new Map<string, TeamConvocationRow>();
            byEvent.set(row.eventId, row);
            convocationsByPlayer.set(key.toLowerCase(), byEvent);
          });
        });
        // The backend training summary spans every season, so season figures are rebuilt
        // from the trainings held in the current season only.
        const seasonTrainingIds = seasonEventsAll.filter(isHeldTraining).map((ev) => ev.id);
        const seasonTrainingIdSet = new Set(seasonTrainingIds);

        const trainingSummaryById = new Map<string, TrainingSummaryPlayer>();
        const seasonTrainingSummaryPlayers = (trainingSummary?.players ?? []) as TrainingSummaryPlayer[];
        seasonTrainingSummaryPlayers.forEach((player) => {
          const byTeamPlayerId = String(player.teamPlayerId ?? "").toLowerCase();
          const byPlayerId = String(player.playerId ?? "").toLowerCase();
          if (byTeamPlayerId) trainingSummaryById.set(byTeamPlayerId, player);
          if (byPlayerId) trainingSummaryById.set(byPlayerId, player);
        });

        const eventDayById = new Map(
          seasonEventsAll.map((ev) => [ev.id, ev.start ?? ev.startTime ?? ev.eveDateTime ?? ""]),
        );
        const absenceDays = new Map<string, string[]>();
        const playerStats = new Map<string, WeeklyTrainingStats>();
        convocationPlayers.forEach((p) => {
          const summary =
            trainingSummaryById.get(p.id.toLowerCase()) ??
            (p.playerId ? trainingSummaryById.get(p.playerId.toLowerCase()) : undefined);

          absenceDays.set(
            p.id,
            (summary?.absences ?? [])
              .map((absence) => absence.date || eventDayById.get(absence.eventId) || "")
              .filter(Boolean)
              .map((d) => toIsoDay(d)),
          );

          const playerConvocations =
            convocationsByPlayer.get(p.id.toLowerCase()) ??
            (p.playerId ? convocationsByPlayer.get(p.playerId.toLowerCase()) : undefined);
          const convocationOutcomes = (eventIds: string[]) => {
            const rows = eventIds
              .map((eventId) => playerConvocations?.get(eventId))
              .filter((row): row is TeamConvocationRow => !!row);
            return {
              attended: rows.filter((row) => classifyFriendlyConvocation(row) === "attended").length,
              absences: rows.filter((row) => classifyFriendlyConvocation(row) === "absent"),
            };
          };

          const trainingAbsences = summary?.absences ?? [];
          const weekFriendlies = convocationOutcomes(weekFriendlyIds);
          const weekTrainingAbsences = trainingAbsences.filter((absence) => weekTrainingIds.has(absence.eventId));
          const weekAbsences = [...weekTrainingAbsences, ...weekFriendlies.absences];
          const attendedTrainings =
            Math.max(0, weekTrainings.length - weekTrainingAbsences.length) + weekFriendlies.attended;
          const totalTrainings = attendedTrainings + weekAbsences.length;
          const knownUnavailableTrainings = weekAbsences.filter((absence) => forcesDeconvocation(absence.excuseTypeId)).length;

          const seasonFriendlies = convocationOutcomes(seasonFriendlyIds);
          const seasonTrainingAbsences = trainingAbsences.filter((absence) => seasonTrainingIdSet.has(absence.eventId));
          const seasonAbsences = [...seasonTrainingAbsences, ...seasonFriendlies.absences];
          const attendedTrainingsSeason = convocationOutcomes(seasonTrainingIds).attended + seasonFriendlies.attended;
          const totalTrainingsSeason = attendedTrainingsSeason + seasonAbsences.length;

          playerStats.set(p.id, {
            totalTrainings,
            attendedTrainings,
            weightedAttendedTrainings: weightedAttendance(attendedTrainings, weekAbsences),
            attendedTrainingsSeason,
            weightedAttendedTrainingsSeason: weightedAttendance(attendedTrainingsSeason, seasonAbsences),
            totalTrainingsSeason,
            knownUnavailableTrainings,
          });
        });

        setWeekTrainingStatsMap(playerStats);
        setTrainingAbsenceDaysMap(trainingSummary ? absenceDays : null);
      })
      .catch(() => {
        if (!mounted) return;
        setTrainingAbsenceDaysMap(null);
        setMatchDays([]);
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
      setLastInjuryWindowMap(new Map());
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const teamInjuries = await getTeamInjuries(teamId);
        const injuriesByPlayer = new Map(teamInjuries.map((t) => [t.teamPlayerId, t.injuries]));
        const map = new Map<string, string | null>();
        const windows = new Map<string, InjuryWindow>();
        for (const p of convocationPlayers) {
          const injuries = injuriesByPlayer.get(p.id) ?? [];
          const latest = injuries
            .filter((inj) => !!inj.endDate)
            .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];
          map.set(p.id, latest?.endDate ?? null);
          if (latest?.endDate) windows.set(p.id, { startDate: latest.startDate, endDate: latest.endDate });
        }
        if (mounted) {
          setLastInjuryEndMap(map);
          setLastInjuryWindowMap(windows);
        }
      } catch {
        if (mounted) {
          setLastInjuryEndMap(new Map());
          setLastInjuryWindowMap(new Map());
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamId, convocationPlayers, enabled]);

  const lastInjuryMissedEventsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!trainingAbsenceDaysMap) return map;
    lastInjuryWindowMap.forEach((injury, playerId) => {
      map.set(
        playerId,
        countMissedEventsDuringInjury(injury, trainingAbsenceDaysMap.get(playerId) ?? [], matchDays),
      );
    });
    return map;
  }, [lastInjuryWindowMap, trainingAbsenceDaysMap, matchDays]);

  return {
    seasonEvents,
    seasonStats,
    gridStartsCountMap,
    lastInjuryEndMap,
    lastInjuryMissedEventsMap,
    weekTrainingStatsMap,
    weekTrainingCount,
    loadingProposalContext,
  };
}