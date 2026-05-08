import KitSelector from "./KitSelector/KitSelector";
import type { ClubKit } from "../../../services/kitService";
import type { MatchState } from "./convocationMatchDetail.types";
import styles from "../ConvocationMatchDetail.module.css";

type Props = {
  match: MatchState | null;
  kits: ClubKit[];
  selectedKitNumber: number | null;
  onSelectKit: (kitNumber: number | null) => void;
  disabled: boolean;
};

export default function ConvocationMatchHeader({
  match,
  kits,
  selectedKitNumber,
  onSelectKit,
  disabled,
}: Props) {
  if (!match) return <span>Convocatoria</span>;

  return (
    <div className={styles.titleWrap}>
      <span className={styles.convocationLabel}>Convocatoria</span>

      <div className={styles.matchInfoRow}>
        <div className={styles.matchTeamBlock}>
          {match.localTeamShield && (
            <img
              src={match.localTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className={styles.matchTeamName}>{match.localTeamName}</span>
        </div>
        <span className={styles.matchTime}>{match.time || "--:--"}</span>
        <div className={`${styles.matchTeamBlock} ${styles.matchTeamBlockVisitor}`}>
          <span className={styles.matchTeamName}>{match.visitorTeamName}</span>
          {match.visitorTeamShield && (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.matchMeta}>
        <span className={styles.matchDateLabel}>{match.date}</span>
        {match.field && (
          <>
            <span className={styles.matchMetaSep}>·</span>
            <span className={styles.matchField}>{match.field}</span>
          </>
        )}
      </div>

      {kits.length > 0 && (
        <KitSelector
          kits={kits}
          selectedKitNumber={selectedKitNumber}
          onSelect={onSelectKit}
          disabled={disabled}
        />
      )}
    </div>
  );
}