import { Box, Button, CircularProgress, Pagination } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SportEventDialog from "./components/SportEventDialog";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import sportEventService, {
  SportEventResponse,
} from "../../services/sportEventService";
import EventCard from "./EventCard";
import sportEventTypeService from "../../services/sportEventTypeService";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./Attendance.module.css";
import { useEffect, useState } from "react";
import { TextField, FormControlLabel, Switch } from "@mui/material";

function getWeekBounds(): { start: string; end: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

export default function Attendance() {
  const navigate = useNavigate();
  const {
    team,
    teamTitleNode,
    clubSubtitleNode,
    loading: teamLoading,
  } = useTeamAndClub();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [page, setPage] = useState(() => {
    try {
      const saved = sessionStorage.getItem("attendance_filter");
      if (saved) return JSON.parse(saved).page ?? 1;
    } catch { /* ignore */ }
    return 1;
  });
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [eventTypeMap, setEventTypeMap] = useState<Record<number, string>>({});
  const FILTER_KEY = "attendance_filter";
  const [startDate, setStartDate] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      if (saved) return JSON.parse(saved).startDate ?? getWeekBounds().start;
    } catch { /* ignore */ }
    return getWeekBounds().start;
  });
  const [endDate, setEndDate] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      if (saved) return JSON.parse(saved).endDate ?? getWeekBounds().end;
    } catch { /* ignore */ }
    return getWeekBounds().end;
  });
  const [descending, setDescending] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      if (saved) return JSON.parse(saved).descending ?? false;
    } catch { /* ignore */ }
    return false;
  });
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
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
          startDate ?? undefined,
          endDate ?? undefined,
          descending
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
  }, [team, page, pageSize, searchTrigger]);

  // Reset page and wait for explicit search
  function saveFilter(start: string | null, end: string | null, desc: boolean, p = 1) {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ startDate: start, endDate: end, descending: desc, page: p }));
    } catch { /* ignore */ }
  }

  function onSearch() {
    saveFilter(startDate, endDate, descending, 1);
    setPage(1);
    setSearchTrigger((s) => s + 1);
  }

  function onReset() {
    const { start, end } = getWeekBounds();
    setStartDate(start);
    setEndDate(end);
    setDescending(false);
    saveFilter(start, end, false, 1);
    setPage(1);
    setSearchTrigger((s) => s + 1);
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Eventos deportivos"
        subtitle={teamTitleNode ?? "Control de asistencias de jugadores"}
        actionBar={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {!!team && (
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
        <Box sx={{ p: 3 }}>
          <Box
            className={styles.filters}
            sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}
          >
            <TextField
              label="Desde"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value || null)}
            />
            <TextField
              label="Hasta"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value || null)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={descending}
                  onChange={(_, v) => setDescending(v)}
                  size="small"
                />
              }
              label={descending ? "Descendente" : "Ascendente"}
            />
            <Button variant="contained" size="small" onClick={onSearch}>
              Buscar
            </Button>
            <Button variant="outlined" size="small" onClick={onReset}>
              Limpiar
            </Button>
          </Box>
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
          ) : events.length === 0 ? (
            <EmptyState
              title={"No hay eventos"}
              description={"No se han encontrado eventos para este equipo."}
            />
          ) : (
            <div className={styles.list}>
              {events.map((e) => (
                <div key={e.id} className={styles.item}>
                  <EventCard
                    event={{ ...e, teamId: e.teamId ?? team?.id }}
                    eventTypeName={
                      e.eventType ?? eventTypeMap[e.eventTypeId ?? 0]
                    }
                    onDeleted={() => setSearchTrigger((s) => s + 1)}
                    onEdited={() => setSearchTrigger((s) => s + 1)}
                  />
                </div>
              ))}
            </div>
          )}

          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => { setPage(v); saveFilter(startDate, endDate, descending, v); }}
            />
          </Box>
        </Box>
      </ContentLayout>
      {team && (
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
