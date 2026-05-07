import { SyntheticEvent, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import convocationService from "../../../../services/convocationService";
import convocationStatusService from "../../../../services/convocationStatusService";
import assistanceTypeService from "../../../../services/assistanceTypeService";
import attendanceSummaryService from "../../../../services/attendanceSummaryService";
import sportEventService, { type SportEventResponse } from "../../../../services/sportEventService";
import sportEventTypeService from "../../../../services/sportEventTypeService";
import AttendanceDashboardTab from "./AttendanceDashboardTab";
import AttendanceTrainingsTab from "./AttendanceTrainingsTab";
import type {
  PlayerTrainingSummary,
  Summary,
  SummaryByType,
} from "./types";
import styles from "../../AttendanceSummary.module.css";

type TabValue = "dashboard" | "trainings";

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
  const [summary, setSummary] = useState<SummaryByType>({
    total: { ...EMPTY_SUMMARY },
    training: { ...EMPTY_SUMMARY },
    match: { ...EMPTY_SUMMARY },
    other: { ...EMPTY_SUMMARY },
  });
  const [trainingRows, setTrainingRows] = useState<PlayerTrainingSummary[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [eventTypes, statuses, assistanceTypes] = await Promise.all([
          sportEventTypeService.getSportEventTypes(),
          convocationStatusService.getConvocationStatuses(),
          assistanceTypeService.getAssistanceTypes(),
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
          if (kind === "match") nextSummary.match = addSummary(nextSummary.match, eventSummary);
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

        if (mounted) {
          setSummary(nextSummary);
          setTrainingRows(nextRows);
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
  }, [teamId]);

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
      </Tabs>

      <div className={styles.tabPanel}>
        {tab === "dashboard" && <AttendanceDashboardTab summary={summary} />}
        {tab === "trainings" && <AttendanceTrainingsTab rows={trainingRows} />}
      </div>
    </Box>
  );
}
