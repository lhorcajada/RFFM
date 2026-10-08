import { Paper, Typography } from "@mui/material";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { RedCardIcon, YellowCardIcon } from "../../../../../shared/components/ui/CardIcons/CardIcons";
import type { LiveMatchReport, ReportPlayer } from "../../../services/matchReportService";
import LiveReportPitch from "./LiveReportPitch";
import styles from "./LiveReportTab.module.css";

type Props = {
  report: LiveMatchReport;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper component="section" aria-label={title} className={styles.section} elevation={0}>
      <Typography variant="subtitle1" className={styles.sectionTitle}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function PlayerMinutesList({ players }: { players: ReportPlayer[] }) {
  return (
    <ul className={styles.list}>
      {players.map((p) => (
        <li key={p.teamPlayerId} className={styles.playerRow}>
          <span className={styles.dorsal}>{p.dorsal ?? "-"}</span>
          <span className={styles.playerName}>{p.name}</span>
          <span className={styles.minutes}>{p.minutesPlayed}'</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  );
}

export default function LiveReportTab({ report }: Props) {
  return (
    <div className={styles.root}>
      {report.formationName && (
        <Section title={`Alineación inicial · ${report.formationName}`}>
          <LiveReportPitch formationName={report.formationName} starters={report.starters} />
        </Section>
      )}

      <div className={styles.twoColumns}>
        <Section title="Titulares">
          {report.starters.length > 0 ? <PlayerMinutesList players={report.starters} /> : <EmptyLine text="Sin titulares" />}
        </Section>
        <Section title="Banquillo">
          {report.bench.length > 0 ? <PlayerMinutesList players={report.bench} /> : <EmptyLine text="Sin suplentes" />}
        </Section>
      </div>

      <Section title="Goles">
        {report.goals.length === 0 ? (
          <EmptyLine text="Sin goles" />
        ) : (
          <ul className={styles.list}>
            {report.goals.map((g, i) => (
              <li key={`${g.minute}-${i}`} className={styles.eventRow}>
                <span className={styles.minute}>{g.minute}'</span>
                <SportsSoccerIcon fontSize="small" className={g.isOwnTeam ? styles.ownGoal : styles.rivalGoal} />
                <span className={styles.eventText}>
                  {g.isOwnTeam ? g.scorerName ?? "Gol" : "Gol del rival"}
                </span>
                <span className={styles.score}>
                  {g.scoreLocal} - {g.scoreVisitor}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tarjetas">
        {report.cards.length === 0 ? (
          <EmptyLine text="Sin tarjetas" />
        ) : (
          <ul className={styles.list}>
            {report.cards.map((c, i) => (
              <li key={`${c.minute}-${i}`} className={styles.eventRow}>
                <span className={styles.minute}>{c.minute}'</span>
                {c.cardType === "red" ? <RedCardIcon className={styles.cardIcon} /> : <YellowCardIcon className={styles.cardIcon} />}
                <span className={styles.eventText}>
                  {c.isRivalPlayer ? (c.rivalDorsal != null ? `Rival #${c.rivalDorsal}` : "Rival") : c.playerName ?? "Jugador"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cambios">
        {report.substitutionWindows.length === 0 ? (
          <EmptyLine text="Sin cambios" />
        ) : (
          <div className={styles.windows}>
            {report.substitutionWindows.map((w, i) => (
              <article key={`${w.windowIndex}-${i}`} className={styles.window}>
                <div className={styles.windowHeader}>
                  <span className={styles.windowTitle}>{w.isHalftime ? "Descanso" : `Ventana ${w.windowIndex}`}</span>
                  <span className={styles.minute}>{w.minute}'</span>
                </div>
                <ul className={styles.list}>
                  {w.swaps.map((s, j) => (
                    <li key={j} className={styles.swap}>
                      <span className={styles.swapIn}>Entra {s.inPlayerName}</span>
                      {s.outPlayerName && <span className={styles.swapOut}>Sale {s.outPlayerName}</span>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
