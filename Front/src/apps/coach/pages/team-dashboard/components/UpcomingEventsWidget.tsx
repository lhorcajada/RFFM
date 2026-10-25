import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import { Link } from "react-router-dom";
import sportEventService, { type SportEventResponse } from "../../../services/sportEventService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import useEventAttendanceSummaries from "../../../hooks/useEventAttendanceSummaries";
import {
  type ConvocationStatusName,
  type EventAttendanceSummaryDto,
} from "../../../services/eventAttendanceSummaryService";
import convocationService from "../../../services/convocationService";
import availabilityService from "../../../services/availabilityService";
import excuseTypeService, { type ExcuseType } from "../../../services/excuseTypeService";
import DeconvokeDialog from "../../attendance/components/DeconvokeDialog";
import type { TeamResponse } from "../../../services/teamService";
import type { PlayerActions } from "../utils/playerActions";
import NextEventCard from "./NextEventCard";
import UpcomingEventRow from "./UpcomingEventRow";
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
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);
  const [deconvokeTarget, setDeconvokeTarget] = useState<{ eventId: string; convocationId: string } | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, ConvocationStatusName>>({});
  const [unavailableTarget, setUnavailableTarget] = useState<{ eventId: string; requestId: string } | null>(null);

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

  useEffect(() => {
    excuseTypeService
      .getExcuseTypes()
      .then(setExcuseTypes)
      .catch(() => setExcuseTypes([]));
  }, []);

  const { summaries, refetch } = useEventAttendanceSummaries(
    team?.id,
    events.map((e) => e.id)
  );

  const handleConfirm = async (
    eventId: string,
    convocationId: string,
    statusId: number,
    statusName: ConvocationStatusName,
    excuseTypeId?: number
  ) => {
    setPendingEventId(eventId);
    setOptimistic((prev) => ({ ...prev, [eventId]: statusName }));

    try {
      await convocationService.updateConvocationStatus(eventId, convocationId, statusId, excuseTypeId);
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

  const handleRespondAvailability = async (eventId: string, requestId: string, available: boolean, excuseTypeId?: number) => {
    setPendingEventId(eventId);
    try {
      if (available) await availabilityService.respondAvailability(eventId, requestId, true);
      else await availabilityService.respondAvailability(eventId, requestId, false, excuseTypeId);
      refetch();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: detail || "No se pudo responder la disponibilidad.", severity: "error" },
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
      <div className={styles.placeholder}>
        <h3 className={styles.title}>Próximos eventos</h3>
        <div className={styles.loadingContainer}>
          <CircularProgress size={40} />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.placeholder}>
        <h3 className={styles.title}>Próximos eventos</h3>
        <p className={styles.emptyState}>No hay próximos eventos</p>
      </div>
    );
  }

  const detailHref = (eventId: string) =>
    `/coach/attendance/${eventId}?teamId=${encodeURIComponent(team.id)}`;

  const displaySummaryOf = (eventId: string): EventAttendanceSummaryDto | undefined => {
    const baseSummary = summaries[eventId];
    const optimisticStatus = optimistic[eventId];
    if (!optimisticStatus) return baseSummary;
    return {
      ...(baseSummary ?? {
        eventId,
        convocados: 0,
        going: 0,
        pending: 0,
        notGoing: 0,
        attendancePercentage: 0,
        myStatus: null,
        myStatusId: null,
        myConvocationId: null,
      }),
      myStatus: optimisticStatus,
    };
  };

  const actionsOf = (eventId: string): PlayerActions | null => {
    if (!isPlayer) return null;
    const baseSummary = summaries[eventId];
    const myConvocationId = baseSummary?.myConvocationId ?? null;
    const busy = pendingEventId === eventId;

    // Keep the buttons mounted (disabled) while a confirmation for this
    // event is in flight, even though the optimistic status already
    // flipped away from "Pending" — otherwise the buttons vanish
    // instantly on click instead of visibly disabling.
    const canConfirm =
      !!myConvocationId &&
      !baseSummary?.myIsInjured &&
      (baseSummary?.myStatus === "Pending" || busy);
    if (canConfirm && myConvocationId) {
      return {
        kind: "convocation",
        busy,
        onYes: () => handleConfirm(eventId, myConvocationId, ACCEPTED_STATUS_ID, "Accepted"),
        onNo: () => setDeconvokeTarget({ eventId, convocationId: myConvocationId }),
      };
    }

    const myAvailabilityRequestId = baseSummary?.myAvailabilityRequestId ?? null;
    const canAnswerAvailability =
      !myConvocationId && !!myAvailabilityRequestId && baseSummary?.myAvailabilityStatus === "Requested";
    if (canAnswerAvailability && myAvailabilityRequestId) {
      return {
        kind: "availability",
        busy,
        onYes: () => handleRespondAvailability(eventId, myAvailabilityRequestId, true),
        onNo: () => setUnavailableTarget({ eventId, requestId: myAvailabilityRequestId }),
      };
    }
    return null;
  };

  const eventTypeNameOf = (event: SportEventResponse) =>
    event.eventType ?? eventTypeMap[event.eventTypeId ?? 0] ?? null;

  const variant = isPlayer ? "player" : "coach";
  const [nextEvent, ...laterEvents] = events;

  return (
    <div className={styles.container}>
      <NextEventCard
        event={nextEvent}
        eventTypeName={eventTypeNameOf(nextEvent)}
        summary={displaySummaryOf(nextEvent.id)}
        variant={variant}
        detailHref={detailHref(nextEvent.id)}
        actions={actionsOf(nextEvent.id)}
      />
      {laterEvents.length > 0 && (
        <section aria-labelledby="upcoming-later-title" className={styles.later}>
          <div className={styles.laterHeader}>
            <h3 id="upcoming-later-title" className={styles.title}>Después</h3>
            <Link to={`/coach/attendance?teamId=${encodeURIComponent(team.id)}`} className={styles.headerLink}>
              Ver calendario
            </Link>
          </div>
          <ul aria-labelledby="upcoming-later-title" className={styles.laterList}>
            {laterEvents.map((event) => (
              <UpcomingEventRow
                key={event.id}
                event={event}
                eventTypeName={eventTypeNameOf(event)}
                summary={displaySummaryOf(event.id)}
                variant={variant}
                detailHref={detailHref(event.id)}
                actions={actionsOf(event.id)}
              />
            ))}
          </ul>
        </section>
      )}
      <DeconvokeDialog
        open={!!unavailableTarget}
        onClose={() => setUnavailableTarget(null)}
        excuseTypes={excuseTypes}
        hideCoachOnly
        title="¿Por qué no está disponible?"
        confirmLabel="No disponible"
        onConfirm={(reason) => {
          if (!unavailableTarget) return;
          handleRespondAvailability(unavailableTarget.eventId, unavailableTarget.requestId, false, Number(reason));
        }}
      />
      <DeconvokeDialog
        open={!!deconvokeTarget}
        onClose={() => setDeconvokeTarget(null)}
        excuseTypes={excuseTypes}
        hideCoachOnly
        onConfirm={(reason) => {
          if (!deconvokeTarget) return;
          handleConfirm(
            deconvokeTarget.eventId,
            deconvokeTarget.convocationId,
            DECONVOKE_STATUS_ID,
            "Deconvoke",
            Number(reason)
          );
        }}
      />
    </div>
  );
}
