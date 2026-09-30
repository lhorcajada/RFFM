import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import { usePlayerPhysicalEvolution } from "../hooks/usePlayerPhysicalEvolution";
import type {
  PhysicalEvolutionDays,
  PhysicalEvolutionEvent,
  PhysicalEvolutionPoint,
} from "../../../services/teamPlayerStatisticsService";
import {
  formatShortDate,
  formatTrainingTypes,
  matchTypeLabel,
} from "../../../components/MetricBreakdown/breakdownFormat";
import styles from "./PlayerPhysicalEvolution.module.css";

type Props = {
  teamId: string | undefined;
  teamPlayerId: string | undefined;
};

type MetricKey = "formStatus" | "readiness" | "fatigue";

const METRIC_LABELS: Record<MetricKey, string> = {
  formStatus: "Forma",
  readiness: "Rodaje",
  fatigue: "Cansancio",
};

const RANGES: { days: PhysicalEvolutionDays; label: string }[] = [
  { days: 28, label: "4 semanas" },
  { days: 56, label: "8 semanas" },
  { days: 84, label: "12 semanas" },
];

const dayKey = (iso: string) => iso.slice(0, 10);

// Fecha del día (UTC, sin hora) a partir del prefijo yyyy-mm-dd, igual que formatShortDate.
const toDay = (iso: string) => {
  const [y, m, d] = dayKey(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const formatAxisDate = (date: Date) => formatShortDate(date.toISOString());

function formatVariation(delta: number): string {
  if (delta === 0) return "=";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

function summaryFor(points: PhysicalEvolutionPoint[], metric: MetricKey): string {
  const values = points.map((p) => p[metric]);
  const current = values[values.length - 1];
  const first = values.find((v): v is number => v != null);
  if (current == null || first == null) return `${METRIC_LABELS[metric]} —`;
  return `${METRIC_LABELS[metric]} ${current} (${formatVariation(current - first)})`;
}

function eventDescription(event: PhysicalEvolutionEvent): string {
  if (event.kind === "Match") return `${matchTypeLabel(event.eventTypeId)} · ${event.minutesPlayed}'`;
  return event.trainingTypes.length > 0 ? `Entreno · ${formatTrainingTypes(event.trainingTypes)}` : "Entreno";
}

export default function PlayerPhysicalEvolution({ teamId, teamPlayerId }: Props) {
  const theme = useTheme();
  const { data, loading, error, days, setDays, retry } = usePlayerPhysicalEvolution(teamId, teamPlayerId);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => setSelectedIndex(null), [data]);

  const metrics = useMemo<MetricKey[]>(
    () => (data?.formStatusAvailable ? ["formStatus", "readiness", "fatigue"] : ["readiness", "fatigue"]),
    [data]
  );

  const metricColors: Record<MetricKey, string> = {
    formStatus: theme.palette.primary.main,
    readiness: theme.palette.info.main,
    fatigue: theme.palette.error.main,
  };

  const points = data?.points ?? [];
  const isEmpty =
    data != null &&
    data.events.length === 0 &&
    data.injuries.length === 0 &&
    points.every((p) => p.formStatus == null && p.readiness == null && p.fatigue === 0);

  const selected = points.length > 0 ? points[selectedIndex ?? points.length - 1] : null;
  const selectedEvents = selected ? (data?.events ?? []).filter((e) => dayKey(e.date) === dayKey(selected.date)) : [];
  const rangeStart = points.length > 0 ? dayKey(points[0].date) : null;

  const renderBody = () => {
    if (error) {
      return (
        <div className={styles.state}>
          <p>No se pudo cargar la evolución</p>
          <Button size="small" variant="outlined" onClick={retry}>
            Reintentar
          </Button>
        </div>
      );
    }
    if (loading || !data) {
      return (
        <div className={styles.state}>
          <CircularProgress size={24} />
        </div>
      );
    }
    if (isEmpty) {
      return <p className={styles.state}>Sin actividad en este periodo</p>;
    }

    return (
      <>
        <ul className={styles.summary} aria-label="Resumen del periodo">
          {metrics.map((metric) => (
            <li key={metric} className={styles.summaryItem}>
              <Box component="span" className={styles.dot} sx={{ bgcolor: metricColors[metric] }} />
              {summaryFor(points, metric)}
            </li>
          ))}
        </ul>

        <div className={styles.chart}>
          <LineChart
            height={240}
            margin={{ top: 16, right: 12, bottom: 28, left: 32 }}
            xAxis={[{ data: points.map((p) => toDay(p.date)), scaleType: "time", valueFormatter: formatAxisDate }]}
            yAxis={[{ min: 0, max: 100 }]}
            series={metrics.map((metric) => ({
              label: METRIC_LABELS[metric],
              data: points.map((p) => p[metric]),
              color: metricColors[metric],
              showMark: false,
              connectNulls: false,
            }))}
            slotProps={{ legend: { hidden: true } }}
            onAxisClick={(_, axisData) => {
              if (axisData) setSelectedIndex(axisData.dataIndex);
            }}
          >
            {data.events
              .filter((e) => e.kind === "Match")
              .map((e) => (
                <ChartsReferenceLine
                  key={e.eventId}
                  x={toDay(e.date)}
                  label={matchTypeLabel(e.eventTypeId)}
                  classes={{ line: styles.matchLine, label: styles.referenceLabel }}
                />
              ))}
            {data.injuries
              .filter((i) => rangeStart != null && dayKey(i.startDate) >= rangeStart)
              .map((i) => (
                <ChartsReferenceLine
                  key={i.startDate}
                  x={toDay(i.startDate)}
                  label="Lesión"
                  classes={{ line: styles.injuryLine, label: styles.referenceLabel }}
                />
              ))}
            {selected && (
              <ChartsReferenceLine x={toDay(selected.date)} classes={{ line: styles.selectedLine }} />
            )}
          </LineChart>
        </div>

        {selected && (
          <section className={styles.detail} aria-label="Día seleccionado">
            <span className={styles.detailDate}>{formatShortDate(selected.date)}</span>
            <ul className={styles.detailValues}>
              {metrics.map((metric) => (
                <li key={metric}>{`${METRIC_LABELS[metric]} ${selected[metric] ?? "—"}`}</li>
              ))}
            </ul>
            {selectedEvents.length === 0 ? (
              <p className={styles.detailEmpty}>Sin entrenos ni partidos</p>
            ) : (
              <ul className={styles.detailEvents}>
                {selectedEvents.map((e) => (
                  <li key={e.eventId}>{eventDescription(e)}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <p className={styles.hint}>Calculado día a día con los datos actuales.</p>
      </>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="physical-evolution-title">
      <header className={styles.header}>
        <h3 id="physical-evolution-title" className={styles.title}>
          Evolución física
        </h3>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, value: PhysicalEvolutionDays | null) => {
            if (value != null) setDays(value);
          }}
          aria-label="Rango de la evolución"
        >
          {RANGES.map((r) => (
            <ToggleButton key={r.days} value={r.days}>
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </header>
      {renderBody()}
    </section>
  );
}
