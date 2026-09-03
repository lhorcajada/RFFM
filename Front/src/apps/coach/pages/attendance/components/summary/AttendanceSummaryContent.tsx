import { SyntheticEvent, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import type { ConvocationItem } from "../../../../services/convocationService";
import convocationStatusService from "../../../../services/convocationStatusService";
import assistanceTypeService from "../../../../services/assistanceTypeService";
import attendanceSummaryService from "../../../../services/attendanceSummaryService";
import sportEventService, { type SportEventResponse } from "../../../../services/sportEventService";
import sportEventTypeService from "../../../../services/sportEventTypeService";
import teamplayerService from "../../../../services/teamplayerService";
import seasonService from "../../../../services/seasonService";
import liveMatchService from "../../../../services/liveMatchService";
import playerService from "../../../../services/playerService";
import { getMyProfile } from "../../../../services/coachApi";
import { coachAuthService } from "../../../../services/authService";
import excuseTypeService from "../../../../services/excuseTypeService";
import { CALLED_STATUS_IDS } from "../../../convocations/components/convocationMatchDetail.types";
import { classifyNotCalledState } from "./matchAttendanceState";
import type { MatchAttendanceCellState } from "./types";
import AttendanceDashboardTab from "./AttendanceDashboardTab";
import AttendanceMatchesTab from "./AttendanceMatchesTab";
import AttendanceTrainingsTab from "./AttendanceTrainingsTab";
import type {
  MatchAttendanceColumn,
  PlayerMatchSummary,
  PlayerTrainingSummary,
  Summary,
  SummaryByType,
} from "./types";
import styles from "../../AttendanceSummary.module.css";

type TabValue = "dashboard" | "trainings" | "matches";

const EMPTY_SUMMARY: Summary = { events: 0, attend: 0, absent: 0 };

function addSummary(base: Summary, partial: Summary): Summary {
  return {
    events: base.events + partial.events,
    attend: base.attend + partial.attend,
    absent: base.absent + partial.absent,
  };
}

function classifyEventType(name: string | null | undefined): "training" | "match" | "other" {
  const value = (name ?? "").toLowerCase();
  if (/entren|training/.test(value)) return "training";
  // Tournaments ("Torneo") are not counted yet — that event type is not fully
  // supported in the attendance summary yet, so it deliberately falls through
  // to "other" here (excluded from both the dashboard match totals and the
  // matches tab) until tournament support is added.
  if (/partido|match|jornada|amistoso|friendly/.test(value)) return "match";
  return "other";
}

function isFriendlyEvent(event: SportEventResponse): boolean {
  if (event.matchCategory) return event.matchCategory === "Friendly";
  const eventType = (event.eventType ?? "").toLowerCase();
  const title = (event.title ?? event.name ?? "").toLowerCase();
  return /amist|friendly/.test(eventType) || /amist|friendly/.test(title);
}

function getEventTypeName(event: SportEventResponse, typeMap: Record<number, string>): string {
  if (event.eventType && event.eventType.trim().length > 0) return event.eventType;
  if (event.eventTypeId && typeMap[event.eventTypeId]) return typeMap[event.eventTypeId];
  return "Sin categoría";
}

function getEventDate(event: SportEventResponse): string | null {
  return event.startTime ?? event.eveDateTime ?? event.start ?? null;
}

function isEventFinished(event: SportEventResponse): boolean {
  const raw = getEventDate(event);
  if (!raw) return false;
  const date = new Date(raw);
  if (isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isAbsentAssistanceType(name: string | null | undefined): boolean {
  const v = normalizeText(name);
  return /no\s*asist|inasist|ausen|falta|absent/.test(v);
}

function isAttendAssistanceType(name: string | null | undefined): boolean {
  const v = normalizeText(name);
  if (!v) return false;
  if (isAbsentAssistanceType(v)) return false;
  return /asist|attend|presen|llega\s*tarde|late/.test(v);
}

interface Props {
  teamId: string;
}

export default function AttendanceSummaryContent({ teamId }: Props) {
  const roles = useMemo(
    () => coachAuthService.getRoles().map((role) => role.toLowerCase()),
    []
  );
  const isPlayerOrFamily =
    roles.includes("player") ||
    roles.includes("familyplayer") ||
    roles.includes("familymember");
  const [tab, setTab] = useState<TabValue>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<SummaryByType>({
    total: { ...EMPTY_SUMMARY },
    training: { ...EMPTY_SUMMARY },
    match: { ...EMPTY_SUMMARY },
    other: { ...EMPTY_SUMMARY },
  });
  const [trainingRows, setTrainingRows] = useState<PlayerTrainingSummary[]>([]);
  const [matchColumns, setMatchColumns] = useState<MatchAttendanceColumn[]>([]);
  const [matchRows, setMatchRows] = useState<PlayerMatchSummary[]>([]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let mounted = true;
    const createdPhotoUrls: string[] = [];

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const activeSeason = await seasonService.getActiveSeason();
        if (!activeSeason) {
          if (mounted) {
            setSummary({
              total: { ...EMPTY_SUMMARY },
              training: { ...EMPTY_SUMMARY },
              match: { ...EMPTY_SUMMARY },
              other: { ...EMPTY_SUMMARY },
            });
            setTrainingRows([]);
            setMatchColumns([]);
            setMatchRows([]);
          }
          return;
        }

        const seasonId = activeSeason.id;
        const [eventTypes, statuses, assistanceTypes, teamPlayers, matchMinutesRows, seasonMinutesMap, excuseTypes] =
          await Promise.all([
            sportEventTypeService.getSportEventTypes(),
            convocationStatusService.getConvocationStatuses(),
            assistanceTypeService.getAssistanceTypes(),
            teamplayerService.getPlayersByTeam(teamId, seasonId),
            liveMatchService.getMatchMinutes(teamId),
            liveMatchService.getSeasonPlayerMinutes(teamId, seasonId),
            excuseTypeService.getExcuseTypes(),
          ]);
        const excuseTypesById = new Map(excuseTypes.map((e) => [e.id, e]));
        const getNotCalledState = (excuseTypeId: number | null | undefined) =>
          classifyNotCalledState(excuseTypeId, excuseTypesById);

        const minutesByEventAndPlayer = new Map<string, number>();
        const starterIdsByEvent = new Map<string, Set<string>>();
        matchMinutesRows.forEach((row) => {
          minutesByEventAndPlayer.set(`${row.eventId}__${row.teamPlayerId}`, row.minutesPlayed);
          if (row.isStarter) {
            const set = starterIdsByEvent.get(row.eventId) ?? new Set<string>();
            set.add(row.teamPlayerId);
            starterIdsByEvent.set(row.eventId, set);
          }
        });
        const getMinutesPlayed = (eventId: string, playerId: string, wasCalled: boolean): number | null =>
          wasCalled ? minutesByEventAndPlayer.get(`${eventId}__${playerId}`) ?? 0 : null;

        const typeMap: Record<number, string> = {};
        eventTypes.forEach((t) => {
          typeMap[t.id] = t.name;
        });

        const acceptedIds = statuses.filter((s) => /accepted|acept/i.test(s.name)).map((s) => s.id);
        const acceptedSet = new Set<number>(acceptedIds.length > 0 ? acceptedIds : [2]);
        const absenceStatusSet = new Set(
          statuses
            .filter((status) => /justified|justific|deconvoke|desconvoc/i.test(status.name))
            .map((status) => status.id)
        );

        const assistanceNameMap = new Map<number, string>();
        assistanceTypes.forEach((a) => assistanceNameMap.set(a.id, a.name));

        const isAttendById = (assistanceTypeId: number | null | undefined): boolean => {
          if (assistanceTypeId == null) return false;
          return isAttendAssistanceType(assistanceNameMap.get(assistanceTypeId));
        };

        const isAbsentById = (assistanceTypeId: number | null | undefined): boolean => {
          if (assistanceTypeId == null) return false;
          return isAbsentAssistanceType(assistanceNameMap.get(assistanceTypeId));
        };

        const pageSize = 200;
        let page = 1;
        let totalPages = 1;
        const allEvents: SportEventResponse[] = [];

        do {
          const resp = await sportEventService.getSportEvents(
            teamId,
            page,
            pageSize,
            activeSeason.startDate,
            activeSeason.endDate,
            true
          );
          allEvents.push(...(resp.items ?? []));
          totalPages = Math.max(totalPages, resp.totalPages ?? 1);
          page += 1;
        } while (page <= totalPages);

        const nextSummary: SummaryByType = {
          total: { ...EMPTY_SUMMARY },
          training: { ...EMPTY_SUMMARY },
          match: { ...EMPTY_SUMMARY },
          other: { ...EMPTY_SUMMARY },
        };

        const teamConvocations = await attendanceSummaryService.getTeamConvocationsSummary(teamId);
        const convocationsByEventId = new Map<string, ConvocationItem[]>();
        teamConvocations.forEach((row) => {
          const item: ConvocationItem = {
            id: row.convocationId,
            player: { id: row.teamPlayerId, playerId: row.playerId ?? undefined, alias: row.alias },
            status: row.statusId ?? 1,
            excuseTypeId: row.excuseTypeId,
            assistanceTypeId: row.assistanceTypeId,
          };
          const list = convocationsByEventId.get(row.eventId) ?? [];
          list.push(item);
          convocationsByEventId.set(row.eventId, list);
        });

        const eventsWithConvocations = allEvents.map((event) => ({
          event,
          convocations: convocationsByEventId.get(event.id) ?? [],
        }));

        eventsWithConvocations
          .filter(({ event }) => isEventFinished(event))
          .forEach(({ event, convocations }) => {
            const accepted = convocations.filter((c) => acceptedSet.has(c.status));
            const eventSummary: Summary = {
              events: 1,
              attend: accepted.filter((c) => isAttendById(c.assistanceTypeId)).length,
              absent: accepted.filter((c) => isAbsentById(c.assistanceTypeId)).length,
            };

            const kind = classifyEventType(getEventTypeName(event, typeMap));
            nextSummary.total = addSummary(nextSummary.total, eventSummary);
            if (kind === "training") nextSummary.training = addSummary(nextSummary.training, eventSummary);
            // A friendly is still a match for this dashboard aggregate — only the
            // Matches tab distinguishes official (J1) vs friendly (A1) jornadas.
            if (kind === "match") nextSummary.match = addSummary(nextSummary.match, eventSummary);
            if (kind === "other") nextSummary.other = addSummary(nextSummary.other, eventSummary);
          });

        const photoByKey: Record<string, string | null> = {};
        await Promise.all(
          teamPlayers.map(async (player) => {
            try {
              const photoField = player.urlPhoto ?? null;
              const resolved = photoField ? await playerService.fetchPlayerPhoto(photoField) : null;
              if (resolved) createdPhotoUrls.push(resolved);
              if (player.id) photoByKey[player.id] = resolved;
              if (player.playerId) photoByKey[player.playerId] = resolved;
            } catch {
              if (player.id) photoByKey[player.id] = null;
              if (player.playerId) photoByKey[player.playerId] = null;
            }
          })
        );

        const dorsalByKey: Record<string, number | null> = {};
        const positionByKey: Record<string, string | null> = {};
        teamPlayers.forEach((player) => {
          const dorsal = player.dorsal ?? null;
          const position = player.position ?? null;
          if (player.id) dorsalByKey[player.id] = dorsal;
          if (player.playerId) dorsalByKey[player.playerId] = dorsal;
          if (player.id) positionByKey[player.id] = position;
          if (player.playerId) positionByKey[player.playerId] = position;
        });

        const associatedPlayerId = isPlayerOrFamily
          ? (await getMyProfile().catch(() => null))?.playerId ?? null
          : null;
        const associatedTeamPlayerId = associatedPlayerId
          ? teamPlayers.find((player) => player.playerId === associatedPlayerId)?.id ?? null
          : null;

        const trainingSummary = await attendanceSummaryService.getTrainingAttendanceSummary(teamId, seasonId);
        const activeTrainingEventIds = new Set(
          allEvents
            .filter((event) => classifyEventType(getEventTypeName(event, typeMap)) === "training")
            .filter((event) => isEventFinished(event))
            .map((event) => event.id)
        );
        const nextRows: PlayerTrainingSummary[] = trainingSummary.players.map((player) => {
          const playerConvocations = teamConvocations.filter(
            (row) => row.teamPlayerId === player.teamPlayerId && activeTrainingEventIds.has(row.eventId)
          );
          const attendedTrainings = playerConvocations.filter((row) => isAttendById(row.assistanceTypeId)).length;
          const absentTrainings = playerConvocations.filter(
            (row) =>
              isAbsentById(row.assistanceTypeId) ||
              (row.assistanceTypeId == null && row.statusId != null && absenceStatusSet.has(row.statusId))
          ).length;

          return {
            playerId: player.playerId ?? player.teamPlayerId,
            teamPlayerId: player.teamPlayerId,
            playerName: player.playerName,
            photoUrl: photoByKey[player.teamPlayerId] ?? (player.playerId ? photoByKey[player.playerId] : null) ?? null,
            dorsal: dorsalByKey[player.teamPlayerId] ?? (player.playerId ? dorsalByKey[player.playerId] : null) ?? null,
            position: positionByKey[player.teamPlayerId] ?? (player.playerId ? positionByKey[player.playerId] : null) ?? null,
            totalTrainings: attendedTrainings + absentTrainings,
            attendedTrainings,
            absentTrainings,
            absences: player.absences
              .filter((absence) => activeTrainingEventIds.has(absence.eventId))
              .map((absence) => ({
                eventId: absence.eventId,
                eventTitle: absence.eventTitle,
                date: absence.date,
                reason: absence.reason,
              })),
          };
        });

        nextRows.sort((a, b) => {
          if (a.dorsal != null && b.dorsal != null) return a.dorsal - b.dorsal;
          if (a.dorsal != null) return -1;
          if (b.dorsal != null) return 1;
          return a.playerName.localeCompare(b.playerName);
        });

        if (associatedPlayerId) {
          const associatedIndex = nextRows.findIndex(
            (row) => row.playerId === associatedPlayerId || row.teamPlayerId === associatedPlayerId
          );
          if (associatedIndex > 0) {
            const [associatedRow] = nextRows.splice(associatedIndex, 1);
            nextRows.unshift(associatedRow);
          }
        }

        // Keep training totals aligned with the active-season events already loaded above.
        nextSummary.training = {
          events: activeTrainingEventIds.size,
          attend: nextRows.reduce((sum, player) => sum + player.attendedTrainings, 0),
          absent: nextRows.reduce((sum, player) => sum + player.absentTrainings, 0),
        };

        const officialMatchEvents = eventsWithConvocations
          .filter(({ event }) => classifyEventType(getEventTypeName(event, typeMap)) === "match")
          .map(({ event, convocations }) => ({ event, convocations }))
          .sort((a, b) => {
            const ad = getEventDate(a.event) ?? "";
            const bd = getEventDate(b.event) ?? "";
            return ad.localeCompare(bd);
          });

        // League matchdays are numbered "J1, J2, ..." and friendlies "A1, A2, ...",
        // each sequence counted independently (in chronological order) so a friendly
        // played between J3 and J4 doesn't get mislabeled as if it were a matchday.
        let leagueMatchIndex = 0;
        let friendlyMatchIndex = 0;
        const officialMatchColumns: MatchAttendanceColumn[] = officialMatchEvents.map(({ event }) => {
          const friendly = isFriendlyEvent(event);
          const label = friendly ? `A${++friendlyMatchIndex}` : `J${++leagueMatchIndex}`;
          return {
            eventId: event.id,
            label,
            date: getEventDate(event),
            rival: event.rivalName ?? event.rival ?? event.name ?? null,
            isFriendly: friendly,
          };
        });

        const createEmptyMatchSummary = (
          playerId: string,
          playerName: string
        ): PlayerMatchSummary & { seen: Set<string> } => ({
          playerId,
          playerName,
          totalMatches: officialMatchEvents.length,
          calledMatches: 0,
          startedMatches: 0,
          notCalledMatches: 0,
          technicalDecisionMatches: 0,
          unavailableMatches: 0,
          injuryMatches: 0,
          illnessMatches: 0,
          seasonMinutesPlayed: 0,
          cells: [],
          seen: new Set<string>(),
        });

        const bumpNotCalledBreakdown = (
          player: PlayerMatchSummary,
          state: Exclude<MatchAttendanceCellState, "starter" | "called" | "absent">
        ) => {
          if (state === "technicalDecision") player.technicalDecisionMatches += 1;
          if (state === "unavailable") player.unavailableMatches += 1;
          if (state === "injury") player.injuryMatches += 1;
          if (state === "illness") player.illnessMatches += 1;
        };

        const playerMap = new Map<string, PlayerMatchSummary & { seen: Set<string> }>();
        teamPlayers.forEach((player) => {
          const playerId = player.id;
          playerMap.set(
            playerId,
            createEmptyMatchSummary(
              playerId,
              player.alias?.trim() || `${player.name} ${player.lastName ?? ""}`.trim() || "Jugador"
            )
          );
        });
        officialMatchEvents.forEach(({ event, convocations }) => {
          // Real per-match starter status, from MatchParticipation.IsStarter (recorded when
          // the live match is saved as finished) — not a single team-wide "ideal lineup"
          // applied uniformly to every match.
          const starterIds = starterIdsByEvent.get(event.id) ?? new Set<string>();
          const convocationMap = new Map(convocations.map((c) => [c.player.id ?? c.player.playerId ?? "", c]));

          convocations.forEach((conv) => {
            const playerId = conv.player.id ?? conv.player.playerId ?? "";
            if (!playerId) return;
            const playerName = conv.player.alias ?? conv.player.playerId ?? "Jugador";
            const existing = playerMap.get(playerId) ?? createEmptyMatchSummary(playerId, playerName);
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            // A match convocation counts as "called" while Pending (awaiting the
            // player's acceptance) or Accepted — only an explicit Deconvoke means
            // the player is genuinely not called. This differs from `acceptedSet`
            // above, which is scoped to real post-event attendance for the Dashboard tab.
            const wasCalled = CALLED_STATUS_IDS.has(conv.status);
            const wasStarter = wasCalled && starterIds.has(playerId);
            const state: MatchAttendanceCellState = wasStarter
              ? "starter"
              : wasCalled
              ? "called"
              : getNotCalledState(conv.excuseTypeId);
            existing.playerName = playerName;
            existing.seen.add(event.id);
            existing.cells.push({
              eventId: event.id,
              state,
              wasCalled,
              wasStarter,
              minutesPlayed: getMinutesPlayed(event.id, playerId, wasCalled),
            });
            if (wasCalled) existing.calledMatches += 1;
            if (wasStarter) existing.startedMatches += 1;
            if (!wasCalled) {
              existing.notCalledMatches += 1;
              bumpNotCalledBreakdown(existing, state as Exclude<MatchAttendanceCellState, "starter" | "called" | "absent">);
            }
          });

          starterIds.forEach((playerId) => {
            if (!playerId) return;
            const existing = playerMap.get(playerId) ?? createEmptyMatchSummary(playerId, playerId);
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            if (!existing.seen.has(event.id)) {
              existing.cells.push({
                eventId: event.id,
                state: "starter",
                wasCalled: true,
                wasStarter: true,
                minutesPlayed: getMinutesPlayed(event.id, playerId, true),
              });
              existing.calledMatches += 1;
              existing.startedMatches += 1;
              existing.seen.add(event.id);
            }
          });

          convocationMap.forEach((conv, playerId) => {
            if (!playerId) return;
            const existing =
              playerMap.get(playerId) ??
              createEmptyMatchSummary(playerId, conv.player.alias ?? conv.player.playerId ?? "Jugador");
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            if (!existing.seen.has(event.id)) {
              const wasCalled = CALLED_STATUS_IDS.has(conv.status);
              const wasStarter = wasCalled && starterIds.has(playerId);
              const state: MatchAttendanceCellState = wasCalled
                ? wasStarter
                  ? "starter"
                  : "called"
                : getNotCalledState(conv.excuseTypeId);
              existing.cells.push({
                eventId: event.id,
                state,
                wasCalled,
                wasStarter,
                minutesPlayed: getMinutesPlayed(event.id, playerId, wasCalled),
              });
              if (wasCalled) existing.calledMatches += 1;
              if (wasStarter) existing.startedMatches += 1;
              if (!wasCalled) {
                existing.notCalledMatches += 1;
                bumpNotCalledBreakdown(existing, state as Exclude<MatchAttendanceCellState, "starter" | "called" | "absent">);
              }
              existing.seen.add(event.id);
            }
          });
        });

        const nextMatchRows = Array.from(playerMap.values())
          .map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            photoUrl: photoByKey[player.playerId] ?? null,
            dorsal: dorsalByKey[player.playerId] ?? null,
            position: positionByKey[player.playerId] ?? null,
            totalMatches: officialMatchEvents.length,
            calledMatches: player.calledMatches,
            startedMatches: player.startedMatches,
            notCalledMatches: player.notCalledMatches,
            technicalDecisionMatches: player.technicalDecisionMatches,
            unavailableMatches: player.unavailableMatches,
            injuryMatches: player.injuryMatches,
            illnessMatches: player.illnessMatches,
            seasonMinutesPlayed: seasonMinutesMap[player.playerId] ?? 0,
            cells: officialMatchColumns.map((column) => {
              const cell = player.cells.find((item) => item.eventId === column.eventId);
              return (
                cell ?? {
                  eventId: column.eventId,
                  state: "absent" as const,
                  wasCalled: false,
                  wasStarter: false,
                  minutesPlayed: null,
                }
              );
            }),
          }))
          .sort((a, b) => {
            if (a.dorsal != null && b.dorsal != null) return a.dorsal - b.dorsal;
            if (a.dorsal != null) return -1;
            if (b.dorsal != null) return 1;
            return a.playerName.localeCompare(b.playerName);
          });

        if (associatedPlayerId || associatedTeamPlayerId) {
          const associatedIndex = nextMatchRows.findIndex(
            (row) => row.playerId === associatedPlayerId || row.playerId === associatedTeamPlayerId
          );
          if (associatedIndex > 0) {
            const [associatedRow] = nextMatchRows.splice(associatedIndex, 1);
            nextMatchRows.unshift(associatedRow);
          }
        }

        if (mounted) {
          setSummary(nextSummary);
          setTrainingRows(nextRows);
          setMatchColumns(officialMatchColumns);
          setMatchRows(nextMatchRows);
        }
      } catch {
        if (mounted) setError("No se pudo cargar el resumen de asistencias.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      mounted = false;
      createdPhotoUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, [teamId, refreshKey]);

  const hasAnyData = useMemo(() => summary.total.events > 0, [summary.total.events]);

  const handleTabChange = (_event: SyntheticEvent, value: TabValue) => {
    setTab(value);
  };

  if (loading) return <CircularProgress />;

  if (error) return <Typography color="error">{error}</Typography>;

  if (!hasAnyData) {
    return (
      <EmptyState
        title="Sin datos"
        description="Todavía no hay eventos con convocatorias para mostrar el resumen de asistencias."
      />
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={handleTabChange} className={styles.tabs} variant="fullWidth">
        <Tab
          value="dashboard"
          aria-label="Dashboard"
          icon={
            <Tooltip title="Dashboard">
              <SpaceDashboardOutlinedIcon fontSize="small" />
            </Tooltip>
          }
        />
        <Tab
          value="trainings"
          aria-label="Entrenamientos"
          icon={
            <Tooltip title="Entrenamientos">
              <FitnessCenterIcon fontSize="small" />
            </Tooltip>
          }
        />
        <Tab
          value="matches"
          aria-label="Partidos"
          icon={
            <Tooltip title="Partidos">
              <SportsSoccerIcon fontSize="small" />
            </Tooltip>
          }
        />
      </Tabs>

      <div className={styles.tabPanel}>
        {tab === "dashboard" && <AttendanceDashboardTab summary={summary} />}
        {tab === "trainings" && <AttendanceTrainingsTab rows={trainingRows} />}
        {tab === "matches" && <AttendanceMatchesTab rows={matchRows} columns={matchColumns} onRefresh={handleRefresh} loading={loading} />}
      </div>
    </Box>
  );
}
