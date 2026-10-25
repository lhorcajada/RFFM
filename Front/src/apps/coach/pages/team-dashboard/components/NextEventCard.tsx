import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { EventAttendanceSummaryDto } from "../../../services/eventAttendanceSummaryService";
import {
  dateBadge,
  eventKindLabel,
  eventStart,
  eventTitle,
  matchSideLabel,
  myStatusLabel,
  relativeDayLabel,
  timeLine,
} from "../utils/eventDisplay";
import { PLAYER_ACTION_LABELS, type PlayerActions } from "../utils/playerActions";
import EventLocation from "./EventLocation";
import StatusChip from "./StatusChip";
import styles from "./NextEventCard.module.css";

type Props = {
  event: SportEventResponse;
  eventTypeName: string | null;
  summary: EventAttendanceSummaryDto | undefined;
  variant: "player" | "coach";
  detailHref: string;
  actions: PlayerActions | null;
  today?: Date;
};

function CoachSummary({ summary, detailHref }: { summary: EventAttendanceSummaryDto | undefined; detailHref: string }) {
  const convocados = summary?.convocados ?? 0;
  return (
    <>
      {summary && convocados > 0 ? (
        <div className={styles.breakdown}>
          <div
            role="img"
            aria-label={`${convocados} convocados: ${summary.going} van, ${summary.pending} pendientes, ${summary.notGoing} no van`}
            className={styles.bar}
          >
            <Box component="span" className={styles.barGoing} sx={{ flexGrow: summary.going }} />
            <Box component="span" className={styles.barPending} sx={{ flexGrow: summary.pending }} />
            <Box component="span" className={styles.barNotGoing} sx={{ flexGrow: summary.notGoing }} />
          </div>
          <ul aria-label="Resumen de la convocatoria" className={styles.counts}>
            <li><span className={styles.count}>{convocados}</span><span className={styles.countLabel}>Convocados</span></li>
            <li><span className={`${styles.count} ${styles.countGoing}`}>{summary.going}</span><span className={styles.countLabel}>Van</span></li>
            <li><span className={`${styles.count} ${styles.countPending}`}>{summary.pending}</span><span className={styles.countLabel}>Pendientes</span></li>
            <li><span className={`${styles.count} ${styles.countNotGoing}`}>{summary.notGoing}</span><span className={styles.countLabel}>No van</span></li>
          </ul>
        </div>
      ) : (
        <p className={styles.muted}>Aún no hay convocados</p>
      )}
      <Link to={detailHref} className={styles.primaryLink}>
        Gestionar convocatoria
      </Link>
    </>
  );
}

function PlayerStatus({ summary, actions, detailHref }: Pick<Props, "summary" | "actions" | "detailHref">) {
  const status = myStatusLabel(summary);
  const labels = actions ? PLAYER_ACTION_LABELS[actions.kind] : null;
  const convocados = summary?.convocados ?? 0;
  return (
    <>
      {status && (
        <div className={`${styles.statusBand} ${styles[status.tone]}`}>
          <StatusChip label={status} />
        </div>
      )}
      {actions && labels && (
        <div className={styles.actions}>
          <button type="button" className={styles.yes} onClick={actions.onYes} disabled={actions.busy}>
            {labels.yes}
          </button>
          <button type="button" className={styles.no} onClick={actions.onNo} disabled={actions.busy}>
            {labels.no}
          </button>
        </div>
      )}
      {convocados > 0 && (
        <Link to={detailHref} className={styles.secondaryLink}>
          {`Ver convocatoria · ${convocados} convocados`}
        </Link>
      )}
    </>
  );
}

export default function NextEventCard({
  event,
  eventTypeName,
  summary,
  variant,
  detailHref,
  actions,
  today = new Date(),
}: Props) {
  const start = eventStart(event);
  const badge = start ? dateBadge(start) : null;
  const kind = [eventKindLabel(event, eventTypeName), matchSideLabel(event)].filter(Boolean).join(" · ");

  return (
    <section aria-label="Próximo evento" className={styles.card}>
      <div className={styles.top}>
        <span className={styles.when}>{start ? `Próximo · ${relativeDayLabel(start, today)}` : "Próximo"}</span>
        {kind && <span className={styles.type}>{kind}</span>}
      </div>
      <div className={styles.main}>
        {badge && (
          <div className={styles.date} aria-hidden="true">
            <span className={styles.month}>{badge.month}</span>
            <span className={styles.day}>{badge.day}</span>
          </div>
        )}
        <div className={styles.info}>
          <h2 className={styles.name}>
            <Link to={detailHref} className={styles.nameLink}>
              {eventTitle(event)}
            </Link>
          </h2>
          <span className={styles.muted}>{timeLine(event)}</span>
          <EventLocation location={event.location} mapUrl={event.locationMapUrl} />
        </div>
      </div>
      {variant === "coach" ? (
        <CoachSummary summary={summary} detailHref={detailHref} />
      ) : (
        <PlayerStatus summary={summary} actions={actions} detailHref={detailHref} />
      )}
    </section>
  );
}
