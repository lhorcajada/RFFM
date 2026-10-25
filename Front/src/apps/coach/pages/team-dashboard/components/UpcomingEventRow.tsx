import { IconButton } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
  timeLine,
} from "../utils/eventDisplay";
import { PLAYER_ACTION_LABELS, type PlayerActions } from "../utils/playerActions";
import StatusChip from "./StatusChip";
import styles from "./UpcomingEventRow.module.css";

type Props = {
  event: SportEventResponse;
  eventTypeName: string | null;
  summary: EventAttendanceSummaryDto | undefined;
  variant: "player" | "coach";
  detailHref: string;
  actions: PlayerActions | null;
};

function CoachAttendance({ summary }: { summary: EventAttendanceSummaryDto | undefined }) {
  if (!summary || summary.convocados === 0) {
    return <StatusChip label={{ text: "Sin convocar", tone: "pending" }} />;
  }
  return <span className={styles.percentage}>{`${Math.round(summary.attendancePercentage)}%`}</span>;
}

export default function UpcomingEventRow({ event, eventTypeName, summary, variant, detailHref, actions }: Props) {
  const start = eventStart(event);
  const badge = start ? dateBadge(start) : null;
  const status = variant === "player" ? myStatusLabel(summary) : null;
  const labels = actions ? PLAYER_ACTION_LABELS[actions.kind] : null;
  const detail = [eventKindLabel(event, eventTypeName), matchSideLabel(event), timeLine(event)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={styles.row}>
      <div className={styles.date} aria-hidden="true">
        <span className={styles.month}>{badge?.weekday ?? ""}</span>
        <span className={styles.day}>{badge?.day ?? "–"}</span>
        <span className={styles.month}>{badge?.month ?? ""}</span>
      </div>
      <div className={styles.info}>
        <Link to={detailHref} className={styles.name}>
          {eventTitle(event)}
        </Link>
        <span className={styles.detail}>{detail}</span>
      </div>
      {variant === "coach" && <CoachAttendance summary={summary} />}
      {actions && labels ? (
        <div className={styles.actions}>
          <IconButton aria-label={labels.yes} className={styles.yes} onClick={actions.onYes} disabled={actions.busy}>
            <CheckRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label={labels.no} className={styles.no} onClick={actions.onNo} disabled={actions.busy}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </div>
      ) : (
        status && <StatusChip label={status} />
      )}
    </li>
  );
}
