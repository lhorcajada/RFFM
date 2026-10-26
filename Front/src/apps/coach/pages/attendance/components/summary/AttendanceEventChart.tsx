import { useMemo, useState } from "react";
import { Button, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { EventAttendancePoint, Summary } from "./types";

interface Props {
  title: string;
  icon: React.ReactNode;
  color: string;
  aggregate: Summary;
  events: EventAttendancePoint[];
}

const WINDOW_SIZE = 5;
const CHART_WIDTH = 300;
const CHART_TOP = 8;
const CHART_HEIGHT = 90;
const CHART_BASELINE = CHART_TOP + CHART_HEIGHT;
const GRIDLINE_PCTS = [25, 50, 75];

function rate(summary: Summary): number {
  const total = summary.attend + summary.absent;
  if (total === 0) return 0;
  return Math.round((summary.attend / total) * 100);
}

function pointRate(point: EventAttendancePoint): number {
  const total = point.attend + point.absent;
  if (total === 0) return 0;
  return Math.round((point.attend / total) * 100);
}

function formatDate(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function AttendanceEventChart({ title, icon, color, aggregate, events }: Props) {
  const maxStart = Math.max(0, events.length - WINDOW_SIZE);
  const [start, setStart] = useState(maxStart);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const windowEvents = useMemo(
    () => events.slice(start, start + WINDOW_SIZE),
    [events, start]
  );
  const hoveredPoint = windowEvents.find((point) => point.eventId === hoveredEventId) ?? null;

  const goPrev = () => setStart((s) => Math.max(0, s - WINDOW_SIZE));
  const goNext = () => setStart((s) => Math.min(maxStart, s + WINDOW_SIZE));

  const slotWidth = CHART_WIDTH / WINDOW_SIZE;
  const barWidth = slotWidth * 0.6;

  return (
    <article className={`${styles.card} ${styles.categoryCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.iconWrap} style={{ color }}>
          {icon}
        </div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <span className={styles.chartHeaderAggregate}>{rate(aggregate)}%</span>
      </div>

      <div className={styles.categoryChips}>
        <span className={styles.categoryChip}>
          <span>Eventos</span>
          <strong>{aggregate.events}</strong>
        </span>
        <span className={styles.categoryChip}>
          <span>Asisten</span>
          <strong>{aggregate.attend}</strong>
        </span>
        <span className={styles.categoryChip}>
          <span>No asisten</span>
          <strong>{aggregate.absent}</strong>
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title={`Sin datos de ${title.toLowerCase()}`}
          description="No hay eventos finalizados en esta categoría todavía."
        />
      ) : (
        <div className={styles.chartBody}>
          <div className={styles.chartPagerRow}>
            <IconButton
              size="small"
              aria-label="Eventos anteriores"
              onClick={goPrev}
              disabled={start === 0}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <span className={styles.chartWindowLabel}>
              {windowEvents.length > 0 ? `${windowEvents[0].label} – ${windowEvents[windowEvents.length - 1].label}` : ""}
            </span>
            <IconButton
              size="small"
              aria-label="Eventos siguientes"
              onClick={goNext}
              disabled={start >= maxStart}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </div>

          <div className={styles.chartSvgWrap}>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_BASELINE + 16}`}
              className={styles.chartSvg}
              role="img"
              aria-label={`Gráfico de asistencia de ${title}`}
            >
              {GRIDLINE_PCTS.map((pct) => {
                const y = CHART_BASELINE - (pct / 100) * CHART_HEIGHT;
                return (
                  <line
                    key={pct}
                    x1={0}
                    x2={CHART_WIDTH}
                    y1={y}
                    y2={y}
                    className={styles.chartGridline}
                  />
                );
              })}
              <line
                x1={0}
                x2={CHART_WIDTH}
                y1={CHART_BASELINE}
                y2={CHART_BASELINE}
                className={styles.chartAxisLine}
              />
              {windowEvents.map((point, index) => {
                const pct = pointRate(point);
                const barHeight = (pct / 100) * CHART_HEIGHT;
                const x = index * slotWidth + (slotWidth - barWidth) / 2;
                const y = CHART_BASELINE - barHeight;
                return (
                  <g
                    key={point.eventId}
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.title}: ${pct}% de asistencia`}
                    className={styles.chartBarGroup}
                    onMouseEnter={() => setHoveredEventId(point.eventId)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    onFocus={() => setHoveredEventId(point.eventId)}
                    onBlur={() => setHoveredEventId(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barHeight, 1)}
                      rx={4}
                      fill={color}
                      className={styles.chartBar}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={CHART_BASELINE + 12}
                      textAnchor="middle"
                      className={styles.chartBarLabel}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredPoint && (
              <div className={styles.chartTooltip} role="tooltip">
                <span className={styles.chartTooltipTitle}>{hoveredPoint.title}</span>
                <span>{formatDate(hoveredPoint.date)}</span>
                <span>Asisten: {hoveredPoint.attend}</span>
                <span>No asisten: {hoveredPoint.absent}</span>
                <span>{pointRate(hoveredPoint)}%</span>
              </div>
            )}
          </div>

          <Button
            size="small"
            variant="outlined"
            className={styles.chartDetailToggle}
            onClick={() => setShowDetail((v) => !v)}
          >
            {showDetail ? "Ocultar detalle" : "Ver detalle por evento"}
          </Button>

          {showDetail && (
            <ul className={styles.chartDetailList}>
              {events.map((point) => (
                <li key={point.eventId} className={styles.chartDetailRow}>
                  <div className={styles.chartDetailMain}>
                    <span className={styles.chartDetailTitle}>{point.title}</span>
                    <span className={styles.chartDetailMeta}>{formatDate(point.date)}</span>
                  </div>
                  <span className={styles.chartDetailCounts}>
                    {point.attend} asisten · {point.absent} no asisten
                  </span>
                  <strong className={styles.chartDetailRate}>{pointRate(point)}%</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
