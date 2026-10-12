import styles from "./LiveMatchScoreboard.module.css";

interface LiveMatchScoreboardProps {
  localTeamName: string;
  localTeamShield?: string | null;
  visitorTeamName: string;
  visitorTeamShield?: string | null;
  scoreLocal: number;
  scoreVisitor: number;
}

export default function LiveMatchScoreboard({
  localTeamName,
  localTeamShield,
  visitorTeamName,
  visitorTeamShield,
  scoreLocal,
  scoreVisitor,
}: LiveMatchScoreboardProps) {
  return (
    <div className={styles.root}>
      {/* Local team */}
      <div className={`${styles.team} ${styles.local}`}>
        {localTeamShield && (
          <img
            src={localTeamShield}
            alt=""
            className={styles.shield}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <span className={styles.teamName}>{localTeamName}</span>
      </div>

      {/* Score */}
      <div className={styles.scoreBlock}>
        <span className={styles.score}>{scoreLocal}</span>
        <span className={styles.scoreSep}>:</span>
        <span className={styles.score}>{scoreVisitor}</span>
      </div>

      {/* Visitor team */}
      <div className={`${styles.team} ${styles.teamRight} ${styles.visitor}`}>
        <span className={styles.teamName}>{visitorTeamName}</span>
        {visitorTeamShield && (
          <img
            src={visitorTeamShield}
            alt=""
            className={styles.shield}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>
    </div>
  );
}
