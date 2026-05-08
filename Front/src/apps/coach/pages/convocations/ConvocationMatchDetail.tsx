import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slide,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import type { IdealLineupHandle } from "../squad/components/IdealLineup";
import ConvocationTab from "./components/ConvocationTab";
import DesconvocatoriasTab from "./components/DesconvocatoriasTab";
import { getIdealLineup } from "../../services/idealLineupService";
import AlineacionTab from "./components/AlineacionTab";
import SimulacionTab from "./components/SimulacionTab";
import PartidoEnDirectoTab from "./components/PartidoEnDirectoTab";
import KitSelector from "./components/KitSelector/KitSelector";
import ConvocatoriaPrint, { type ConvocatoriaPrintHandle } from "./components/ConvocatoriaPrint";
import type { MatchState } from "./components/convocationMatchDetail.types";
import { useConvocationManagement } from "./hooks/useConvocationManagement";
import { useDesconvocatoriasGrid } from "./hooks/useDesconvocatoriasGrid";
import type { ClubKit } from "../../services/kitService";
import { getTeamKits, updateEventKit } from "../../services/kitService";
import sportEventService, { type SportEventResponse } from "../../services/sportEventService";
import sportEventTypeService from "../../services/sportEventTypeService";
import { getSeasonPlayerStats } from "../../services/liveMatchService";
import { getSettingsForUser } from "../../../federation/services/federationApi";
import federationService from "../../services/federationService";
import attendanceSummaryService from "../../services/attendanceSummaryService";
import { getPlayerInjuries, getPlayersByTeam } from "../../services/teamplayerService";
import convocationService from "../../services/convocationService";
import assistanceTypeService from "../../services/assistanceTypeService";
import { buildDeconvokeProposal } from "./utils/deconvokeProposal";
import type { SeasonPlayerStats } from "./components/simulation/liveMatch.types";
import type { WeeklyTrainingStats } from "./utils/deconvokeProposal";
import styles from "./ConvocationMatchDetail.module.css";

function toIsoDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - offset);
  return toIsoDay(date.toISOString());
}

function endOfWeekIso(isoDate: string): string {
  const start = new Date(`${startOfWeekIso(isoDate)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return toIsoDay(start.toISOString());
}

async function getAllSportEventsInRange(
  teamId: string,
  startDate: string,
  endDate: string,
): Promise<SportEventResponse[]> {
  const pageSize = 200;
  let page = 1;
  const all: SportEventResponse[] = [];

  while (true) {
    const resp = await sportEventService.getSportEvents(teamId, page, pageSize, startDate, endDate, false);
    all.push(...(resp.items ?? []));

    const reachedLastPageByCount = (resp.items?.length ?? 0) < pageSize;
    const reachedLastPageByMeta = resp.totalPages > 0 && page >= resp.totalPages;
    if (reachedLastPageByCount || reachedLastPageByMeta) break;

    page += 1;
    if (page > 50) break;
  }

  // Deduplicate in case the backend returns overlapping pages.
  const byId = new Map<string, SportEventResponse>();
  all.forEach((ev) => byId.set(ev.id, ev));
  return Array.from(byId.values());
}

export default function ConvocationMatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = (location.state as { match?: MatchState } | null)?.match ?? null;

  // Team ID  from URL or fallback to coach configuration
  const params = new URLSearchParams(location.search);
  const [teamId, setTeamId] = useState(params.get("teamId") ?? "");
  const seasonId = params.get("seasonId");
  useEffect(() => {
    if (teamId) return;
    let mounted = true;
    configurationCoachService
      .getAll()
      .then((configs) => {
        if (!mounted) return;
        const preferred = configs[0]?.preferredTeamId ?? "";
        if (preferred) setTeamId(preferred);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const [tab, setTab] = useState(1);
  const lineupRef = useRef<IdealLineupHandle>(null);
  const [lineupSaving, setLineupSaving] = useState(false);

  // Deconvoke reason dialog (Alineación tab)
  const [pendingDeconvokeId, setPendingDeconvokeId] = useState<string | null>(null);
  const [pendingDeconvokeExcuse, setPendingDeconvokeExcuse] = useState<number | "">("");

  const handleDeconvokeRequest = useCallback((playerId: string) => {
    setPendingDeconvokeExcuse("");
    setPendingDeconvokeId(playerId);
  }, []);

  // PDF print
  const printRef = useRef<ConvocatoriaPrintHandle>(null);
  const [printing, setPrinting] = useState(false);
  const handlePrint = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printRef.current?.print();
    } finally {
      setPrinting(false);
    }
  }, [printing]);

  const handlePrintProposal = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printRef.current?.printProposal();
    } finally {
      setPrinting(false);
    }
  }, [printing]);

  // WhatsApp copy
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappCopying, setWhatsappCopying] = useState(false);
  const handleWhatsAppCopy = useCallback(async () => {
    if (whatsappCopying) return;
    setWhatsappCopying(true);
    try {
      const ok = await printRef.current?.copyForWhatsApp();
      if (ok) {
        setWhatsappCopied(true);
        setTimeout(() => setWhatsappCopied(false), 2500);
      }
    } finally {
      setWhatsappCopying(false);
    }
  }, [whatsappCopying]);

  // Kit state
  const [kits, setKits] = useState<ClubKit[]>([]);
  const [selectedKitNumber, setSelectedKitNumber] = useState<number | null>(match?.selectedKitNumber ?? null);
  const [kitUpdating, setKitUpdating] = useState(false);
  const [seasonStats, setSeasonStats] = useState<SeasonPlayerStats[]>([]);
  const [seasonEvents, setSeasonEvents] = useState<SportEventResponse[]>([]);
  const [gridStartsCountMap, setGridStartsCountMap] = useState<Map<string, number>>(new Map());
  const [lastInjuryEndMap, setLastInjuryEndMap] = useState<Map<string, string | null>>(new Map());
  const [weekTrainingStatsMap, setWeekTrainingStatsMap] = useState<Map<string, WeeklyTrainingStats>>(new Map());
  const [weekTrainingCount, setWeekTrainingCount] = useState(0);
  const [loadingProposalContext, setLoadingProposalContext] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    getTeamKits(teamId).then((data) => {
      if (mounted) setKits(data);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [teamId]);

  // Data hooks
  const convocation = useConvocationManagement(teamId, match?.date);
  const grid = useDesconvocatoriasGrid(teamId);

  // Season-level context used by the deconvoke proposal algorithm.
  useEffect(() => {
    if (!teamId || !match?.date) {
      setSeasonEvents([]);
      setSeasonStats([]);
      setGridStartsCountMap(new Map());
      return;
    }

    const matchIso = match.date.slice(0, 10);
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
      sportEventService.getSportEvents(teamId, 1, 200, startOfWeekIso(matchIso), endOfWeekIso(matchIso), false),
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
          const isFriendly = /amist|friendly/.test(eventType) || /amist|friendly/.test(title);
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

        // Try to enrich season stats with federation 'goleadores' for our team.
        setSeasonStats(stats);
        try {
          const settings = await getSettingsForUser();
          const primary = Array.isArray(settings) && settings.length > 0 ? (settings.find((s: any) => s.isPrimary) ?? settings[0]) : null;
          const competitionId = primary?.competitionId;
          const groupId = primary?.groupId;
          const fedTeamId = primary?.teamId;
          if (competitionId && groupId && fedTeamId) {
            // Fetch full player roster to get name+lastName for players whose alias differs from their real name
            const fullRoster = await getPlayersByTeam(teamId).catch(() => []);
            // Build two maps to handle GUID casing mismatches and different ID fields between endpoints
            const rosterById = new Map(fullRoster.map((p) => [p.id.toLowerCase(), p]));
            const rosterByPlayerId = new Map(
              fullRoster.filter((p) => p.playerId).map((p) => [p.playerId!.toLowerCase(), p])
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
              // Split into individual word tokens (keeps spaces as separators before stripping)
              const normalizeWords = (s: string | null | undefined): string[] =>
                (s ?? "")
                  .toString()
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/\p{Diacritic}/gu, "")
                  .split(/[^a-z0-9]+/)
                  .filter(Boolean);
              // Token match: all tokens of candidate must appear in the federation concatenated name
              const tokenMatch = (cand: string, fedName: string): boolean => {
                const tokens = normalizeWords(cand);
                const gn = normalize(fedName);
                return tokens.length >= 2 && tokens.every((t) => gn.includes(t));
              };
              // Reverse token match: federation tokens (len>=3) all appear in local concatenated name.
              // Handles nicknames like "Josete" → "Jose" ("josetegarcia".includes("jose") = true)
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
                // No local season stats available: build a minimal seasonStats from convocation players using federation goles
                mergedStats = convocation.players.map((p) => {
                  const fedPid = p.playerId ?? null;
                  let goals: number | null = null;
                  if (fedPid && goalsByPid.has(String(fedPid))) goals = goalsByPid.get(String(fedPid)) ?? null;
                  else {
                    const full = findInRoster(p.id, p.playerId);
                    const candidates: string[] = [];
                    if (p.alias) candidates.push(p.alias);
                    // Full name from roster (may differ from alias)
                    const fullName = [full?.name ?? p.name, full?.lastName ?? (p as any).lastName].filter(Boolean).join(" ");
                    if (fullName && !candidates.some((c) => normalize(c) === normalize(fullName))) candidates.push(fullName);
                    // Only fall back to name alone if no more specific candidate exists
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
                  const player = convocation.players.find((p) => p.id === s.teamPlayerId);
                  const fedPid = player?.playerId ?? null;
                  if (fedPid && goalsByPid.has(String(fedPid))) {
                    const g = goalsByPid.get(String(fedPid));
                    return { ...s, totalGoals: g };
                  }

                  // Fallback: try matching by normalized name (alias, name + lastName)
                  if (player) {
                    const full = findInRoster(player.id, player.playerId);
                    const candidates: string[] = [];
                    if (player.alias) candidates.push(player.alias);
                    // Full name from roster (may differ from alias)
                    const fullName = [full?.name ?? player.name, full?.lastName ?? (player as any).lastName].filter(Boolean).join(" ");
                    if (fullName && !candidates.some((c) => normalize(c) === normalize(fullName))) candidates.push(fullName);
                    // Only fall back to name alone if no more specific candidate exists
                    if (candidates.length === 0 && player.name) candidates.push(player.name);

                    for (const cand of candidates) {
                      const nc = normalize(cand);
                      if (!nc) continue;
                      if (goalsByName.has(nc)) {
                        const g = goalsByName.get(nc);
                        return { ...s, totalGoals: g };
                      }
                      // Try loose inclusion or token-based match against goleadores list
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
        } catch (e) {
          // ignore federation enrichment errors
        }

        // Load starts count from saved match lineups for each past match event.
        // AlineacionTab saves the lineup using the eventId as the seasonId key,
        // so getIdealLineup(teamId, eventId) returns the starters for that match.
        const startsMap = new Map<string, number>();
        await Promise.all(
          officialMatches.map(async (ev) => {
            try {
              const lineup = await getIdealLineup(teamId, ev.id);
              if (!lineup) return;
              for (const slot of lineup.slots) {
                if (slot.teamPlayerId) {
                  startsMap.set(slot.teamPlayerId, (startsMap.get(slot.teamPlayerId) ?? 0) + 1);
                }
              }
            } catch {
              // Ignore individual failures
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
        const seasonTrainings = seasonEventsAll.filter((ev) => {
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
        const todayIso = toIsoDay(new Date().toISOString())!;
        const pastSeasonTrainingsCount = seasonTrainings.filter((training) => {
          const trainingDay = toIsoDay(training.start ?? training.startTime ?? training.eveDateTime ?? "");
          return !!trainingDay && trainingDay <= todayIso;
        }).length;

        type TrainingSummaryPlayer = {
          teamPlayerId?: string | null;
          playerId?: string | null;
          attendedTrainings?: number;
          totalTrainings?: number;
          absences?: Array<{ eventId: string }>;
        };

        const trainingSummaryById = new Map<string, TrainingSummaryPlayer>();
        const seasonTrainingSummaryPlayers = (trainingSummary?.players ?? []) as TrainingSummaryPlayer[];
        seasonTrainingSummaryPlayers.forEach((player) => {
          const byTeamPlayerId = String(player.teamPlayerId ?? "").toLowerCase();
          const byPlayerId = String(player.playerId ?? "").toLowerCase();
          if (byTeamPlayerId) trainingSummaryById.set(byTeamPlayerId, player);
          if (byPlayerId) trainingSummaryById.set(byPlayerId, player);
        });

        const playerStats = new Map<string, WeeklyTrainingStats>();
        convocation.players.forEach((p) => {
          const summary =
            trainingSummaryById.get(p.id.toLowerCase()) ??
            (p.playerId ? trainingSummaryById.get(p.playerId.toLowerCase()) : undefined);

          const weeklyAbsences =
            summary?.absences?.filter((absence) => weekTrainingIds.has(absence.eventId)).length ?? 0;
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
  }, [teamId, match?.date, convocation.players]);

  useEffect(() => {
    if (convocation.players.length === 0) {
      setLastInjuryEndMap(new Map());
      return;
    }
    let mounted = true;
    (async () => {
      const map = new Map<string, string | null>();
      await Promise.all(
        convocation.players.map(async (p) => {
          try {
            const injuries = await getPlayerInjuries(p.id);
            const latestEnded = injuries
              .filter((inj) => !!inj.endDate)
              .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0]?.endDate ?? null;
            map.set(p.id, latestEnded);
          } catch {
            map.set(p.id, null);
          }
        }),
      );
      if (mounted) setLastInjuryEndMap(map);
    })();
    return () => {
      mounted = false;
    };
  }, [convocation.players]);

  const handleDeconvokeConfirm = useCallback(async () => {
    if (!pendingDeconvokeId || !pendingDeconvokeExcuse) return;
    const pid = pendingDeconvokeId;
    const excuseId = pendingDeconvokeExcuse as number;
    setPendingDeconvokeId(null);
    await convocation.moveToNotCalled(pid, excuseId);
  }, [pendingDeconvokeId, pendingDeconvokeExcuse, convocation]);

  const handleKitSelect = useCallback(async (kitNumber: number | null) => {
    if (!convocation.mgmtEventId || kitUpdating) return;
    setKitUpdating(true);
    try {
      await updateEventKit(convocation.mgmtEventId, kitNumber);
      setSelectedKitNumber(kitNumber);
    } catch {
      // silently ignore — UI stays in previous state
    } finally {
      setKitUpdating(false);
    }
  }, [convocation.mgmtEventId, kitUpdating]);

  // Per-player streak: consecutive past matches since the last "Decisión técnica" deconvocation
  const playerStreaks = useMemo(() => {
    const result = new Map<string, number>();
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    for (const player of convocation.players) {
      let streak = 0;
      for (const col of grid.matchColumns) {
        const cell = grid.enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName)) {
          const isTechDecision =
            !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTechDecision) break;
        }
        streak++;
      }
      result.set(player.id, streak);
    }
    return result;
  }, [convocation.players, grid.matchColumns, grid.enrichedGrid]);

  // Per-player total technical-decision deconvocations
  const playerTechnicalTotals = useMemo(() => {
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    const result = new Map<string, number>();
    for (const player of convocation.players) {
      let total = 0;
      for (const col of grid.matchColumns) {
        const cell = grid.enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName) && cell.statusName !== "No disponible") {
          const isTech = !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTech) total++;
        }
      }
      result.set(player.id, total);
    }
    return result;
  }, [convocation.players, grid.matchColumns, grid.enrichedGrid]);

  const proposalRivalName = useMemo(() => {
    if (!match) return null;
    return match.isHomeTeam ? match.visitorTeamName : match.localTeamName;
  }, [match]);

  const proposal = useMemo(() => {
    const seasonColumns = grid.matchColumns.filter((col) => {
      if (!match?.date) return true;
      return col.date.slice(0, 10) < match.date.slice(0, 10);
    });
    const castano = convocation.players.find(p => (p.alias ?? p.name ?? "").toLowerCase().includes("castaño"));
    if (castano) {
      const inCalled = convocation.mgmtCalled.includes(castano.id);
      const wStats = weekTrainingStatsMap.get(castano.id);
      console.log("[PROPUESTA] Castaño en mgmtCalled:", inCalled, "| weekStats:", wStats, "| weekTrainingCount:", weekTrainingCount);
    }
    return buildDeconvokeProposal({
      players: convocation.players,
      calledIds: convocation.mgmtCalled,
      ratings: convocation.mgmtRatings,
      streaks: playerStreaks,
      technicalTotals: playerTechnicalTotals,
      seasonEvents,
      seasonColumns,
      enrichedGrid: grid.enrichedGrid,
      seasonStats,
      lastInjuryEndMap,
      currentDate: match?.date,
      currentEventId: convocation.mgmtEventId,
      currentRival: proposalRivalName,
      weekTrainingStats: weekTrainingStatsMap,
      weekTrainingCount,
      maxCalledPlayers: 18,
      gridStartsCountMap,
    });
  }, [
    convocation.players,
    convocation.mgmtCalled,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
    seasonEvents,
    grid.matchColumns,
    grid.enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    weekTrainingStatsMap,
    weekTrainingCount,
    gridStartsCountMap,
    match?.date,
    convocation.mgmtEventId,
    proposalRivalName,
  ]);

  const handleApplyProposal = useCallback(
    async (ids: string[]) => {
      const technicalExcuseId =
        convocation.excuseTypes.find((e) => e.name.toLowerCase().includes("decisi"))?.id ?? null;
      for (const id of ids) {
        await convocation.moveToNotCalled(id, technicalExcuseId);
      }
    },
    [convocation],
  );

  

  // Players for the Alineacion tab (accepted non-injured players only)
  const lineupPlayers = useMemo(() => {
    const notCalledSet = new Set(convocation.mgmtNotCalled);
    const pendingSet = new Set(convocation.mgmtPending);
    return convocation.players
      .filter((p) => p.isInjured !== true && !notCalledSet.has(p.id) && !pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtNotCalled,
    convocation.mgmtPending,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const notCalledPlayers = useMemo(() => {
    const notCalledSet = new Set(convocation.mgmtNotCalled);
    return convocation.players
      .filter((p) => notCalledSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: p.isInjured ?? false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtNotCalled,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const pendingPlayers = useMemo(() => {
    const pendingSet = new Set(convocation.mgmtPending);
    return convocation.players
      .filter((p) => pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador",
        alias: p.alias ?? null,
        photoSrc: convocation.mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: convocation.mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [
    convocation.players,
    convocation.mgmtPending,
    convocation.mgmtPhotos,
    convocation.mgmtRatings,
    playerStreaks,
    playerTechnicalTotals,
  ]);

  const matchTitle = match ? (
    <div className={styles.titleWrap}>
      <span className={styles.convocationLabel}>Convocatoria</span>

      {/* Teams + time */}
      <div className={styles.matchInfoRow}>
        <div className={styles.matchTeamBlock}>
          {match.localTeamShield && (
            <img
              src={match.localTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className={styles.matchTeamName}>{match.localTeamName}</span>
        </div>
        <span className={styles.matchTime}>{match.time || "--:--"}</span>
        <div className={`${styles.matchTeamBlock} ${styles.matchTeamBlockVisitor}`}>
          <span className={styles.matchTeamName}>{match.visitorTeamName}</span>
          {match.visitorTeamShield && (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      {/* Date + field */}
      <div className={styles.matchMeta}>
        <span className={styles.matchDateLabel}>{match.date}</span>
        {match.field && (
          <>
            <span className={styles.matchMetaSep}>·</span>
            <span className={styles.matchField}>{match.field}</span>
          </>
        )}
      </div>

      {/* Kit selector */}
      {kits.length > 0 && (
        <KitSelector
          kits={kits}
          selectedKitNumber={selectedKitNumber}
          onSelect={handleKitSelect}
          disabled={kitUpdating || !convocation.mgmtEventId}
        />
      )}
    </div>
  ) : "Convocatoria";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={matchTitle}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/coach/convocations${teamId ? `?teamId=${teamId}` : ""}`)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {convocation.mgmtEventId && (
              <Button
                startIcon={<PeopleAltIcon />}
                variant="outlined"
                size="small"
                onClick={() => navigate(`/coach/attendance/${convocation.mgmtEventId}`)}
              >
                Ir al evento
              </Button>
            )}
            {tab === 2 && convocation.mgmtEventId && (
              <Button
                variant="contained"
                size="small"
                startIcon={
                  convocation.mgmtSaving ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <SaveIcon />
                  )
                }
                disabled={convocation.mgmtSaving}
                onClick={convocation.handleSave}
              >
                Guardar
              </Button>
            )}
            {tab === 1 && convocation.mgmtEventId && lineupPlayers.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={
                  lineupSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
                }
                disabled={lineupSaving}
                onClick={() => lineupRef.current?.save()}
              >
                Guardar
              </Button>
            )}
            {match && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  printing ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <PictureAsPdfIcon />
                  )
                }
                disabled={printing}
                onClick={handlePrint}
              >
                PDF
              </Button>
            )}
            {match && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  whatsappCopying ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : whatsappCopied ? (
                    <CheckIcon />
                  ) : (
                    <WhatsAppIcon />
                  )
                }
                disabled={whatsappCopying}
                onClick={handleWhatsAppCopy}
                sx={{
                  borderColor: whatsappCopied ? "#4caf50" : "#25D366",
                  color: whatsappCopied ? "#4caf50" : "#25D366",
                  "&:hover": {
                    borderColor: whatsappCopied ? "#4caf50" : "#25D366",
                    backgroundColor: "rgba(37,211,102,0.08)",
                  },
                }}
              >
                {whatsappCopied ? (
                  <>
                    <ContentCopyIcon sx={{ fontSize: 14, mr: 0.5 }} />
                    ¡Copiado!
                  </>
                ) : (
                  "WhatsApp"
                )}
              </Button>
            )}

            

          </>
        }
      >
        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", px: 1 }}
        >
          <Tab label="Desconvocatorias" />
          <Tab label="Alineación" />
          <Tab label="Convocatoria" />
          <Tab label="Simular Partido" />
          <Tab label="Partido en Directo" />
        </Tabs>

        {/* Tab 2: Convocatoria */}
        {tab === 2 && (
          <ConvocationTab
            mgmtEventId={convocation.mgmtEventId}
            mgmtLoadingConv={convocation.mgmtLoadingConv}
            loadingPlayers={convocation.loadingPlayers}
            teamAvgRating={convocation.teamAvgRating}
            mgmtCalled={convocation.mgmtCalled}
            mgmtAvailable={convocation.mgmtAvailable}
            mgmtNotCalled={convocation.mgmtNotCalled}
            players={convocation.players}
            mgmtRatings={convocation.mgmtRatings}
            mgmtPhotos={convocation.mgmtPhotos}
            mgmtExcuseMap={convocation.mgmtExcuseMap}
            excuseTypes={convocation.excuseTypes}
            mgmtDragPlayer={convocation.mgmtDragPlayer}
            mgmtDragOver={convocation.mgmtDragOver}
            onDragStart={convocation.handleDragStart}
            onDragEnd={() => {
              convocation.setMgmtDragOver(null);
            }}
            onDragOver={convocation.setMgmtDragOver}
            onDragLeave={() => convocation.setMgmtDragOver(null)}
            onDrop={convocation.handleDrop}
            onExcuseChange={(pid, excuseId) =>
              convocation.setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }))
            }
            playerStreaks={playerStreaks}
            proposal={proposal}
            proposalLoading={loadingProposalContext || grid.isLoading || convocation.loadingPlayers}
            onApplyProposal={handleApplyProposal}
            onPrintProposal={handlePrintProposal}
          />
        )}

        {/* Save snackbar */}
        <Snackbar
          open={convocation.mgmtSaveResult !== null}
          autoHideDuration={4500}
          onClose={() => convocation.setMgmtSaveResult(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          TransitionComponent={(props) => <Slide {...props} direction="down" />}
        >
          <Alert
            severity={convocation.mgmtSaveResult === "success" ? "success" : "error"}
            onClose={() => convocation.setMgmtSaveResult(null)}
            sx={{ width: "100%" }}
          >
            {convocation.mgmtSaveResult === "success"
              ? "Convocatoria guardada correctamente"
              : convocation.mgmtSaveResult ??
                "Error al guardar la convocatoria. Inténtalo de nuevo."}
          </Alert>
        </Snackbar>

        {/* Tab 0: Desconvocatorias */}
        {tab === 0 && (
          <DesconvocatoriasTab
            players={convocation.players}
            matchColumns={grid.matchColumns}
            enrichedGrid={grid.enrichedGrid}
            isLoading={grid.isLoading}
            teamId={teamId}
            onDeconvokePlayer={(playerId) => convocation.moveToNotCalled(playerId)}
            currentNotCalled={convocation.mgmtNotCalled}
          />
        )}

        {/* Tab 1: Alineacion */}
        {tab === 1 && (
          <AlineacionTab
            mgmtEventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
            notCalledPlayers={notCalledPlayers}
            pendingPlayers={pendingPlayers}
            lineupRef={lineupRef}
            teamId={teamId}
            onSavingChange={setLineupSaving}
            onDeconvoke={handleDeconvokeRequest}
            onReconvoke={(playerId) => convocation.moveToAvailable(playerId)}
            onAcceptPending={(playerId) => convocation.acceptPending(playerId)}
          />
        )}

        {/* Tab 3: Simular Partido */}
        {tab === 3 && (
          <SimulacionTab
            teamId={teamId}
            eventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
          />
        )}

        {/* Tab 4: Partido en Directo */}
        {tab === 4 && (
          <PartidoEnDirectoTab
            teamId={teamId}
            eventId={convocation.mgmtEventId}
            lineupPlayers={lineupPlayers}
            localTeamName={match?.localTeamName ?? "Local"}
            localTeamShield={match?.localTeamShield ?? null}
            visitorTeamName={match?.visitorTeamName ?? "Visitante"}
            visitorTeamShield={match?.visitorTeamShield ?? null}
            isHomeTeam={match?.isHomeTeam ?? true}
          />
        )}

        {/* Deconvoke reason dialog */}
        <Dialog
          open={pendingDeconvokeId !== null}
          onClose={() => setPendingDeconvokeId(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Motivo de desconvocatoria</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="deconvoke-reason-label">Motivo</InputLabel>
              <Select
                labelId="deconvoke-reason-label"
                label="Motivo"
                value={pendingDeconvokeExcuse}
                onChange={(e) => setPendingDeconvokeExcuse(e.target.value as number)}
              >
                {convocation.excuseTypes.map((et) => (
                  <MenuItem key={et.id} value={et.id}>
                    {et.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingDeconvokeId(null)}>Cancelar</Button>
            <Button
              variant="contained"
              disabled={!pendingDeconvokeExcuse}
              onClick={handleDeconvokeConfirm}
            >
              Desconvocar
            </Button>
          </DialogActions>
        </Dialog>

        {/* PDF print container — off-screen, captured by html2canvas */}
        <ConvocatoriaPrint
          ref={printRef}
          match={match}
          calledIds={convocation.mgmtCalled}
          notCalledIds={convocation.mgmtNotCalled}
          proposal={proposal}
          players={convocation.players}
          photos={convocation.mgmtPhotos}
          excuseMap={convocation.mgmtExcuseMap}
          excuseTypes={convocation.excuseTypes}
          kits={kits}
          selectedKitNumber={selectedKitNumber}
        />
      </ContentLayout>
    </BaseLayout>
  );
}
