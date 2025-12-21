import { Box, Button, CircularProgress, Pagination } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [eventTypeMap, setEventTypeMap] = useState<Record<number, string>>({});
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [descending, setDescending] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);
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
  function onSearch() {
    setPage(1);
    setSearchTrigger((s) => s + 1);
  }

  function onReset() {
    setStartDate(null);
    setEndDate(null);
    setDescending(false);
    setPage(1);
    setSearchTrigger((s) => s + 1);
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Asistencias"
        subtitle={teamTitleNode ?? "Control de asistencias de jugadores"}
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/dashboard")}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
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
                    event={e}
                    eventTypeName={
                      e.eventType ?? eventTypeMap[e.eventTypeId ?? 0]
                    }
                    onDeleted={() => setSearchTrigger((s) => s + 1)}
                  />
                </div>
              ))}
            </div>
          )}

          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
            />
          </Box>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
