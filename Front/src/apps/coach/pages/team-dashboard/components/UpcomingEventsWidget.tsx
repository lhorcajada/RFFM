import { useEffect, useState } from "react";
import { CircularProgress, Button, Box } from "@mui/material";
import { Link } from "react-router-dom";
import sportEventService, { type SportEventResponse } from "../../../services/sportEventService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import useEventAttendanceSummaries from "../../../hooks/useEventAttendanceSummaries";
import { type ConvocationStatusName } from "../../../services/eventAttendanceSummaryService";
import convocationService from "../../../services/convocationService";
import Carousel from "../../../components/Carousel/Carousel";
import EventCard from "../../attendance/EventCard";
import type { TeamResponse } from "../../../services/teamService";
import styles from "./UpcomingEventsWidget.module.css";

interface Props {
  team: TeamResponse | null;
  isPlayer: boolean;
}

/** `Convocation.ConvocationStatusId` values (`ConvocationStatus.cs`) — mirrors
 * the ids `ConvocationCard.tsx`'s "Aceptar"/"Rechazar" actions already send. */
const ACCEPTED_STATUS_ID = 2;
const DECONVOKE_STATUS_ID = 5;

export default function UpcomingEventsWidget({ team, isPlayer }: Props) {
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [eventTypeMap, setEventTypeMap] = useState<Record<number, string>>({});
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, ConvocationStatusName>>({});

  useEffect(() => {
    if (!team?.id) return;

    setLoading(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    sportEventService
      .getSportEvents(team.id, 1, 3, today)
      .then((result) => {
        setEvents(result.items || []);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [team?.id]);

  useEffect(() => {
    sportEventTypeService
      .getSportEventTypes()
      .then((types) => {
        const map: Record<number, string> = {};
        for (const t of types) map[t.id] = t.name;
        setEventTypeMap(map);
      })
      .catch(() => setEventTypeMap({}));
  }, []);

  const { summaries, refetch } = useEventAttendanceSummaries(
    team?.id,
    events.map((e) => e.id)
  );

  const handleConfirm = async (
    eventId: string,
    convocationId: string,
    statusId: number,
    statusName: ConvocationStatusName
  ) => {
    setPendingEventId(eventId);
    setOptimistic((prev) => ({ ...prev, [eventId]: statusName }));

    try {
      await convocationService.updateConvocationStatus(eventId, convocationId, statusId);
      refetch();
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    } catch {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "No se pudo actualizar tu convocatoria.", severity: "error" },
        })
      );
    } finally {
      setPendingEventId(null);
    }
  };

  if (!team) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Próximos eventos</h3>
        <div className={styles.loadingContainer}>
          <CircularProgress size={40} />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Próximos eventos</h3>
        <p className={styles.emptyState}>No hay próximos eventos</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Próximos eventos</h3>
      <Carousel ariaLabel="Próximos eventos">
        {events.map((event) => {
          const eventTypeName = event.eventType ?? eventTypeMap[event.eventTypeId ?? 0] ?? null;

          const baseSummary = summaries[event.id];
          const optimisticStatus = optimistic[event.id];
          const displaySummary = optimisticStatus
            ? { ...(baseSummary ?? {
                eventId: event.id,
                convocados: 0,
                going: 0,
                pending: 0,
                notGoing: 0,
                attendancePercentage: 0,
                myStatus: null,
                myStatusId: null,
                myConvocationId: null,
              }), myStatus: optimisticStatus }
            : baseSummary;

          const myConvocationId = baseSummary?.myConvocationId ?? null;

          // Keep the buttons mounted (disabled) while a confirmation for this
          // event is in flight, even though the optimistic status already
          // flipped away from "Pending" — otherwise the buttons vanish
          // instantly on click instead of visibly disabling.
          const canConfirm =
            isPlayer &&
            !!myConvocationId &&
            (baseSummary?.myStatus === "Pending" || pendingEventId === event.id);

          return (
            <div key={event.id} className={styles.eventCardWrapper}>
              <Link
                to={`/coach/attendance/${event.id}?teamId=${encodeURIComponent(team.id)}`}
                className={styles.eventCardLink}
              >
                <EventCard
                  event={event}
                  eventTypeName={eventTypeName}
                  attendanceSummary={displaySummary}
                  isPlayer={isPlayer}
                  compact
                />
              </Link>
              {canConfirm && (
                <Box sx={{ display: "flex", gap: 1, marginTop: 1, justifyContent: "center" }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      myConvocationId &&
                      handleConfirm(event.id, myConvocationId, ACCEPTED_STATUS_ID, "Accepted")
                    }
                    disabled={pendingEventId === event.id}
                  >
                    Voy
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      myConvocationId &&
                      handleConfirm(event.id, myConvocationId, DECONVOKE_STATUS_ID, "Deconvoke")
                    }
                    disabled={pendingEventId === event.id}
                  >
                    No voy
                  </Button>
                </Box>
              )}
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}
