import { useEffect, useState } from "react";
import { Button, Collapse, Dialog, DialogContent, DialogTitle, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import type { DailyLoadBreakdown, PlayerStatistics } from "../../services/teamPlayerStatisticsService";
import DailyLoadBreakdownView from "../MetricBreakdown/DailyLoadBreakdownView";
import FatigueBreakdownView from "../MetricBreakdown/FatigueBreakdownView";
import { METRIC_TEXTS } from "./metricInfoTexts";
import type { MetricKey } from "./metricInfoTexts";
import styles from "./MetricInfoDialog.module.css";

type Props = {
  metric: MetricKey;
  player: PlayerStatistics;
  open: boolean;
  onClose: () => void;
};

function dailyLoadLines(b: DailyLoadBreakdown): string[] {
  return [
    `Entrenos: ${b.trainingsAttended}`,
    `Partidos jugados: ${b.matchesPlayed} (${b.matchMinutesPlayed}')`,
    `Días seguidos sin actividad: ${b.currentRestStreakDays}`,
  ];
}

function numbersFor(metric: MetricKey, player: PlayerStatistics): string[] {
  if (metric === "formStatus") return player.formStatusBreakdown ? dailyLoadLines(player.formStatusBreakdown) : [];
  if (metric === "readiness") return player.readinessBreakdown ? dailyLoadLines(player.readinessBreakdown) : [];
  return [
    `Entrenos con carga: ${player.fatigueBreakdown.consideredTrainings.length}`,
    `Partidos con carga: ${player.fatigueBreakdown.consideredMatches.length}`,
  ];
}

function DetailView({ metric, player }: { metric: MetricKey; player: PlayerStatistics }) {
  if (metric === "formStatus" && player.formStatusBreakdown) {
    return <DailyLoadBreakdownView breakdown={player.formStatusBreakdown} />;
  }
  if (metric === "readiness" && player.readinessBreakdown) {
    return <DailyLoadBreakdownView breakdown={player.readinessBreakdown} />;
  }
  if (metric === "fatigue") {
    return <FatigueBreakdownView breakdown={player.fatigueBreakdown} value={player.fatigue} />;
  }
  return null;
}

export default function MetricInfoDialog({ metric, player, open, onClose }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [showDetail, setShowDetail] = useState(false);
  const texts = METRIC_TEXTS[metric];
  const lines = numbersFor(metric, player);

  useEffect(() => {
    if (!open) setShowDetail(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="metric-info-title"
    >
      <DialogTitle id="metric-info-title" className={styles.title}>
        <span>{texts.title}</span>
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={styles.content}>
        <p className={styles.what}>{texts.what}</p>

        <h4 className={styles.heading}>Sube si…</h4>
        <ul className={styles.list}>
          {texts.goesUp.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h4 className={styles.heading}>Baja si…</h4>
        <ul className={styles.list}>
          {texts.goesDown.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <section className={styles.numbers} aria-label="Tus números">
          <h4 className={styles.heading}>{texts.numbersTitle}</h4>
          <ul className={styles.numbersList}>
            {lines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <Button
          size="small"
          className={styles.detailButton}
          aria-expanded={showDetail}
          onClick={() => setShowDetail((v) => !v)}
        >
          {showDetail ? "Ocultar el detalle" : "Ver el detalle"}
        </Button>
        <Collapse in={showDetail} timeout="auto" unmountOnExit>
          <div className={styles.detail}>
            <DetailView metric={metric} player={player} />
          </div>
        </Collapse>
      </DialogContent>
    </Dialog>
  );
}
