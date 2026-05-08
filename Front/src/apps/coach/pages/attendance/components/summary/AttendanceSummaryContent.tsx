import { SyntheticEvent, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import convocationService from "../../../../services/convocationService";
import convocationStatusService from "../../../../services/convocationStatusService";
import assistanceTypeService from "../../../../services/assistanceTypeService";
import attendanceSummaryService from "../../../../services/attendanceSummaryService";
import { getIdealLineup } from "../../../../services/idealLineupService";
import sportEventService, { type SportEventResponse } from "../../../../services/sportEventService";
import sportEventTypeService from "../../../../services/sportEventTypeService";
import teamplayerService from "../../../../services/teamplayerService";
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

const EMPTY_SUMMARY: Summary = { events: 0, attend: 0, absent: 0, pending: 0 };

function addSummary(base: Summary, partial: Summary): Summary {
  return {
    events: base.events + partial.events,
    attend: base.attend + partial.attend,
    absent: base.absent + partial.absent,
    pending: base.pending + partial.pending,
  };
}

function classifyEventType(name: string | null | undefined): "training" | "match" | "other" {
  const value = (name ?? "").toLowerCase();
  if (/entren|training/.test(value)) return "training";
  if (/partido|match|jornada/.test(value)) return "match";
  return "other";
}

function isFriendlyEvent(event: SportEventResponse): boolean {
  const eventType = (event.eventType ?? "").toLowerCase();
  const title = (event.title ?? event.name ?? "").toLowerCase();
  return /amist|friendly/.test(eventType) || /amist|friendly/.test(title);
}

function formatMatchLabel(index: number, _event: SportEventResponse): string {
  return `J${index + 1}`;
}

function getEventTypeName(event: SportEventResponse, typeMap: Record<number, string>): string {
  if (event.eventType && event.eventType.trim().length > 0) return event.eventType;
  if (event.eventTypeId && typeMap[event.eventTypeId]) return typeMap[event.eventTypeId];
  return "Sin categoría";
}

function getEventDate(event: SportEventResponse): string | null {
  return event.startTime ?? event.eveDateTime ?? event.start ?? null;
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

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [eventTypes, statuses, assistanceTypes, teamPlayers] = await Promise.all([
          sportEventTypeService.getSportEventTypes(),
          convocationStatusService.getConvocationStatuses(),
          assistanceTypeService.getAssistanceTypes(),
          teamplayerService.getPlayersByTeam(teamId),
        ]);

        const typeMap: Record<number, string> = {};
        eventTypes.forEach((t) => {
          typeMap[t.id] = t.name;
        });

        const acceptedIds = statuses.filter((s) => /accepted|acept/i.test(s.name)).map((s) => s.id);
        const acceptedSet = new Set<number>(acceptedIds.length > 0 ? acceptedIds : [2]);

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
          const resp = await sportEventService.getSportEvents(teamId, page, pageSize, null, null, true);
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

        const eventsWithConvocations = await Promise.all(
          allEvents.map(async (event) => {
            const convocations = await convocationService.getConvocations(event.id);
            return { event, convocations };
          })
        );

        eventsWithConvocations.forEach(({ event, convocations }) => {
          const accepted = convocations.filter((c) => acceptedSet.has(c.status));
          const eventSummary: Summary = {
            events: 1,
            attend: accepted.filter((c) => isAttendById(c.assistanceTypeId)).length,
            absent: accepted.filter((c) => isAbsentById(c.assistanceTypeId)).length,
            pending: accepted.filter((c) => !c.assistanceTypeId).length,
          };

          const kind = classifyEventType(getEventTypeName(event, typeMap));
          nextSummary.total = addSummary(nextSummary.total, eventSummary);
          if (kind === "training") nextSummary.training = addSummary(nextSummary.training, eventSummary);
          if (kind === "match" && !isFriendlyEvent(event)) nextSummary.match = addSummary(nextSummary.match, eventSummary);
          if (kind === "other") nextSummary.other = addSummary(nextSummary.other, eventSummary);
        });

        const seasonId = new URLSearchParams(window.location.search).get("seasonId");
        const trainingSummary = await attendanceSummaryService.getTrainingAttendanceSummary(teamId, seasonId);
        const nextRows: PlayerTrainingSummary[] = trainingSummary.players.map((player) => ({
          playerId: player.playerId ?? player.teamPlayerId,
          playerName: player.playerName,
          totalTrainings: player.totalTrainings,
          attendedTrainings: player.attendedTrainings,
          absentTrainings: player.absentTrainings,
          pendingTrainings: player.pendingTrainings,
          absences: player.absences.map((absence) => ({
            eventId: absence.eventId,
            eventTitle: absence.eventTitle,
            date: absence.date,
            reason: absence.reason,
          })),
        }));

        // Overwrite training summary with accurate data from the dedicated endpoint
        // (convocation assistanceTypeId is not filled for training events)
        nextSummary.training = {
          events: trainingSummary.totalTrainingEvents,
          attend: trainingSummary.players.reduce((sum, p) => sum + p.attendedTrainings, 0),
          absent: trainingSummary.players.reduce((sum, p) => sum + p.absentTrainings, 0),
          pending: trainingSummary.players.reduce((sum, p) => sum + p.pendingTrainings, 0),
        };

        const officialMatchEvents = eventsWithConvocations
          .filter(({ event }) => classifyEventType(getEventTypeName(event, typeMap)) === "match" && !isFriendlyEvent(event))
          .map(({ event, convocations }) => ({ event, convocations }))
          .sort((a, b) => {
            const ad = getEventDate(a.event) ?? "";
            const bd = getEventDate(b.event) ?? "";
            return ad.localeCompare(bd);
          });

        const matchLineups = await Promise.all(
          officialMatchEvents.map(async ({ event }) => {
            try {
              return { eventId: event.id, lineup: await getIdealLineup(teamId, event.id) };
            } catch {
              return { eventId: event.id, lineup: null };
            }
          })
        );

        const lineupByEventId = new Map(matchLineups.map((item) => [item.eventId, item.lineup]));
        const officialMatchColumns: MatchAttendanceColumn[] = officialMatchEvents.map(({ event }, index) => ({
          eventId: event.id,
          label: formatMatchLabel(index, event),
          date: getEventDate(event),
          rival: event.rivalName ?? event.rival ?? event.name ?? null,
        }));

        const playerMap = new Map<string, PlayerMatchSummary & { seen: Set<string> }>();
        teamPlayers.forEach((player) => {
          const playerId = player.id;
          playerMap.set(playerId, {
            playerId,
            playerName: (player.alias?.trim() || `${player.name} ${player.lastName ?? ""}`.trim() || "Jugador"),
            totalMatches: officialMatchEvents.length,
            calledMatches: 0,
            startedMatches: 0,
            notCalledMatches: 0,
            cells: [],
            seen: new Set<string>(),
          });
        });
        officialMatchEvents.forEach(({ event, convocations }) => {
          const lineup = lineupByEventId.get(event.id);
          const starterIds = new Set<string>((lineup?.slots ?? []).filter((slot) => slot.teamPlayerId).map((slot) => slot.teamPlayerId as string));
          const convocationMap = new Map(convocations.map((c) => [c.player.id ?? c.player.playerId ?? "", c]));

          convocations.forEach((conv) => {
            const playerId = conv.player.id ?? conv.player.playerId ?? "";
            if (!playerId) return;
            const playerName = conv.player.alias ?? conv.player.playerId ?? "Jugador";
            const existing = playerMap.get(playerId) ?? {
              playerId,
              playerName,
              totalMatches: officialMatchEvents.length,
              calledMatches: 0,
              startedMatches: 0,
              notCalledMatches: 0,
              cells: [],
              seen: new Set<string>(),
            };
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            const wasCalled = acceptedSet.has(conv.status);
            const wasStarter = wasCalled && starterIds.has(playerId);
            const state = wasStarter ? "starter" : wasCalled ? "called" : "notCalled";
            existing.playerName = playerName;
            existing.seen.add(event.id);
            existing.cells.push({ eventId: event.id, state, wasCalled, wasStarter });
            if (wasCalled) existing.calledMatches += 1;
            if (wasStarter) existing.startedMatches += 1;
            if (!wasCalled) existing.notCalledMatches += 1;
          });

          starterIds.forEach((playerId) => {
            if (!playerId) return;
            const existing = playerMap.get(playerId) ?? {
              playerId,
              playerName: playerId,
              totalMatches: officialMatchEvents.length,
              calledMatches: 0,
              startedMatches: 0,
              notCalledMatches: 0,
              cells: [],
              seen: new Set<string>(),
            };
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            if (!existing.seen.has(event.id)) {
              existing.cells.push({ eventId: event.id, state: "starter", wasCalled: true, wasStarter: true });
              existing.calledMatches += 1;
              existing.startedMatches += 1;
              existing.seen.add(event.id);
            }
          });

          convocationMap.forEach((conv, playerId) => {
            if (!playerId) return;
            const existing = playerMap.get(playerId) ?? {
              playerId,
              playerName: conv.player.alias ?? conv.player.playerId ?? "Jugador",
              totalMatches: officialMatchEvents.length,
              calledMatches: 0,
              startedMatches: 0,
              notCalledMatches: 0,
              cells: [],
              seen: new Set<string>(),
            };
            if (!playerMap.has(playerId)) playerMap.set(playerId, existing);
            if (!existing.seen.has(event.id)) {
              const wasCalled = acceptedSet.has(conv.status);
              const wasStarter = wasCalled && starterIds.has(playerId);
              existing.cells.push({ eventId: event.id, state: wasCalled ? (wasStarter ? "starter" : "called") : "notCalled", wasCalled, wasStarter });
              if (wasCalled) existing.calledMatches += 1;
              if (wasStarter) existing.startedMatches += 1;
              if (!wasCalled) existing.notCalledMatches += 1;
              existing.seen.add(event.id);
            }
          });
        });

        const nextMatchRows = Array.from(playerMap.values())
          .map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            totalMatches: officialMatchEvents.length,
            calledMatches: player.calledMatches,
            startedMatches: player.startedMatches,
            notCalledMatches: player.notCalledMatches,
            cells: officialMatchColumns.map((column) => {
              const cell = player.cells.find((item) => item.eventId === column.eventId);
              return cell ?? { eventId: column.eventId, state: "absent" as const, wasCalled: false, wasStarter: false };
            }),
          }))
          .sort((a, b) => b.startedMatches - a.startedMatches || b.calledMatches - a.calledMatches || a.playerName.localeCompare(b.playerName));

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
      <Tabs value={tab} onChange={handleTabChange} className={styles.tabs}>
        <Tab value="dashboard" label="Dashboard" />
        <Tab value="trainings" label="Entrenamientos" />
        <Tab value="matches" label="Partidos" />
      </Tabs>

      <div className={styles.tabPanel}>
        {tab === "dashboard" && <AttendanceDashboardTab summary={summary} />}
        {tab === "trainings" && <AttendanceTrainingsTab rows={trainingRows} />}
        {tab === "matches" && <AttendanceMatchesTab rows={matchRows} columns={matchColumns} onRefresh={handleRefresh} loading={loading} />}
      </div>
    </Box>
  );
}
