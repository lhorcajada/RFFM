import { Box, Button, CircularProgress, Pagination } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SportEventDialog from "./components/SportEventDialog";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { useIsPlayerRole } from "../../hooks/useIsPlayerRole";
import useEventAttendanceSummaries from "../../hooks/useEventAttendanceSummaries";
import useAutoRefresh from "../../hooks/useAutoRefresh";
import sportEventService, {
  SportEventResponse,
} from "../../services/sportEventService";
import EventCard from "./EventCard";
import sportEventTypeService from "../../services/sportEventTypeService";
import seasonService, {
  COACH_ACTIVE_SEASON_CHANGED_EVENT,
  Season,
} from "../../services/seasonService";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { coachAuthService } from "../../services/authService";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import styles from "./Attendance.module.css";
import { useEffect, useState } from "react";
import EventsFilterBar, {
  EventsSegment,
  EventTypeFilter,
} from "./components/EventsFilterBar";
import { getSegmentFilter } from "./attendanceUtils";
import { groupEventsByWeek } from "./utils/groupEventsByWeek";

const FILTER_KEY = "attendance_filter";

interface DateFilter {
  start: string | null;
  end: string | null;
  descending: boolean;
}

interface SavedFilter {
  segment: EventsSegment | null;
  filter: DateFilter;
  page: number;
}

function readSavedFilter(): SavedFilter {
  const defaults: SavedFilter = {
    segment: "upcoming",
    filter: getSegmentFilter("upcoming", null),
    page: 1,
  };
  try {
    const saved = sessionStorage.getItem(FILTER_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    const hasDates = parsed.startDate != null || parsed.endDate != null;
    const segment: EventsSegment | null =
      parsed.segment ?? (hasDates ? null : "upcoming");
    return {
      segment,
      filter: hasDates
        ? {
            start: parsed.startDate ?? null,
            end: parsed.endDate ?? null,
            descending: parsed.descending ?? false,
          }
        : defaults.filter,
      page: parsed.page ?? 1,
    };
  } catch {
    return defaults;
  }
}

function matchesType(typeName: string, type: EventTypeFilter): boolean {
  const name = typeName.toLowerCase();
  if (type === "match") return name.includes("partido");
  if (type === "training") return name.includes("entrenamiento");
  return name.includes("torneo") || name.includes("competici");
}

export default function Attendance() {
  useAuditPageAccess('Events');
  const goToTeamDashboard = useTeamDashboardBack();
  const {
    team,
    teamTitleNode,
    loading: teamLoading,
  } = useTeamAndClub();
  const isPlayer = useIsPlayerRole();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [initial] = useState(readSavedFilter);
  const [page, setPage] = useState(initial.page);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [eventTypeMap, setEventTypeMap] = useState<Record<number, string>>({});
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [segment, setSegment] = useState<EventsSegment | null>(initial.segment);
  const [filter, setFilter] = useState<DateFilter>(initial.filter);
  const [activeTypes, setActiveTypes] = useState<EventTypeFilter[]>([]);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreateEvent =
    coachAuthService.hasRole("Administrator") ||
    coachAuthService.hasRole("Coach") ||
    coachAuthService.hasRole("ClubDirector") ||
    coachAuthService.hasRole("ClubMember");
  const { summaries, refetch: refetchSummaries } = useEventAttendanceSummaries(team?.id, events.map((e) => e.id));
  useAutoRefresh(refetchSummaries);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const types = await sportEventTypeService.getSportEventTypes();
        if (!mounted) return;
        const map: Record<number, string> = {};
        types.forEach((t) => (map[t.id] = t.name));
        setEventTypeMap(map);
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    seasonService.getActiveSeason().then((season) => {
      if (mounted) setActiveSeason(season);
    });
    function onActiveSeasonChanged(event: Event) {
      const detail = (event as CustomEvent<{ season: Season | null }>).detail;
      setActiveSeason(detail?.season ?? null);
    }
    window.addEventListener(COACH_ACTIVE_SEASON_CHANGED_EVENT, onActiveSeasonChanged);
    return () => {
      mounted = false;
      window.removeEventListener(COACH_ACTIVE_SEASON_CHANGED_EVENT, onActiveSeasonChanged);
    };
  }, []);

  // A segment follows the active season; a custom range (segment === null) never does.
  useEffect(() => {
    if (segment === null) return;
    const next = getSegmentFilter(segment, activeSeason);
    setFilter((current) =>
      current.start === next.start && current.end === next.end && current.descending === next.descending
        ? current
        : { start: next.start, end: next.end, descending: next.descending }
    );
  }, [activeSeason, segment]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!team) {
        setEvents([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await sportEventService.getSportEvents(
          team.id,
          page,
          pageSize,
          filter.start ?? undefined,
          filter.end ?? undefined,
          filter.descending
        );
        if (!mounted) return;
        setEvents(resp.items ?? []);
        setTotalPages(resp.totalPages ?? 1);
      } catch (e) {
        setEvents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [team, page, pageSize, filter, searchTrigger]);

  function saveFilter(nextSegment: EventsSegment | null, next: DateFilter, p: number) {
    try {
      sessionStorage.setItem(
        FILTER_KEY,
        JSON.stringify({
          segment: nextSegment,
          startDate: next.start,
          endDate: next.end,
          descending: next.descending,
          page: p,
        })
      );
    } catch { /* ignore */ }
  }

  function onSegmentChange(next: EventsSegment) {
    const range = getSegmentFilter(next, activeSeason);
    const nextFilter = { start: range.start, end: range.end, descending: range.descending };
    setSegment(next);
    setFilter(nextFilter);
    setPage(1);
    saveFilter(next, nextFilter, 1);
  }

  function onApplyRange(start: string | null, end: string | null) {
    const nextFilter = { start, end, descending: false };
    setSegment(null);
    setFilter(nextFilter);
    setPage(1);
    saveFilter(null, nextFilter, 1);
  }

  function onToggleType(type: EventTypeFilter) {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  }

  const typeNameOf = (e: SportEventResponse) => e.eventType ?? eventTypeMap[e.eventTypeId ?? 0] ?? "";
  const visibleEvents =
    activeTypes.length === 0
      ? events
      : events.filter((e) => activeTypes.some((type) => matchesType(typeNameOf(e), type)));
  const groups = groupEventsByWeek(visibleEvents);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Eventos"
        subtitle={teamTitleNode ?? "Control de asistencias de jugadores"}
        actionBar={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {!!team && canCreateEvent && (
              <Button
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
                variant="contained"
                size="small"
              >
                Nuevo evento
              </Button>
            )}
          </Box>
        }
      >
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <EventsFilterBar
            segment={segment}
            activeTypes={activeTypes}
            startDate={filter.start}
            endDate={filter.end}
            onSegmentChange={onSegmentChange}
            onToggleType={onToggleType}
            onApplyRange={onApplyRange}
          />
          {teamLoading ? (
            <CircularProgress />
          ) : !team ? (
            <EmptyState
              title={"Seleccione un equipo"}
              description={
                "Añada el parámetro ?teamId=... en la URL o seleccione un equipo en el selector."
              }
            />
          ) : loading ? (
            <CircularProgress />
          ) : visibleEvents.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState
                title={"No hay eventos"}
                description={"No se han encontrado eventos para este equipo."}
              />
              {activeTypes.length > 0 && (
                <Button variant="outlined" size="small" onClick={() => setActiveTypes([])}>
                  Quitar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.groups}>
              {groups.map((group) => (
                <section key={group.key} className={styles.group}>
                  <div className={styles.groupHeader}>
                    <h2 className={styles.groupTitle}>{group.label}</h2>
                    {group.range && <span className={styles.groupRange}>{group.range}</span>}
                  </div>
                  <div className={styles.list}>
                    {group.events.map((e) => (
                      <div key={e.id} className={styles.item}>
                        <EventCard
                          event={{ ...e, teamId: e.teamId ?? team?.id }}
                          eventTypeName={typeNameOf(e) || undefined}
                          attendanceSummary={summaries[e.id]}
                          isPlayer={isPlayer}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              siblingCount={0}
              size="small"
              onChange={(_, v) => { setPage(v); saveFilter(segment, filter, v); }}
            />
          </Box>
        </Box>
      </ContentLayout>
      {team && canCreateEvent && (
        <SportEventDialog
          open={dialogOpen}
          teamId={team.id}
          onClose={() => setDialogOpen(false)}
          onSaved={() => setSearchTrigger((s) => s + 1)}
        />
      )}
    </BaseLayout>
  );
}
