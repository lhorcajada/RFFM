import React from "react";
import styles from "./ClassificationItem.module.css";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";

interface Props {
  won: number;
  drawn: number;
  lost: number;
}

export default function WinDrawLoss({ won, drawn, lost }: Props) {
  return (
    <div className={styles.statsRowInline}>
      <div className={styles.statItem} title="Ganados">
        <div className={styles.statIcon} aria-hidden>
          <EmojiEventsIcon fontSize="small" style={{ color: "#059669" }} />
        </div>
        <div className={`${styles.statCircle} ${styles.win}`}>
          <strong>{won}</strong>
        </div>
      </div>
      <div className={styles.statItem} title="Empatados">
        <div className={styles.statIcon} aria-hidden>
          <HandshakeOutlinedIcon
            fontSize="small"
            style={{ color: "#f59e0b" }}
          />
        </div>
        <div className={`${styles.statCircle} ${styles.draw}`}>{drawn}</div>
      </div>
      <div className={styles.statItem} title="Perdidos">
        <div className={styles.statIcon} aria-hidden>
          <ThumbDownOffAltIcon fontSize="small" style={{ color: "#ef4444" }} />
        </div>
        <div className={`${styles.statCircle} ${styles.loss}`}>{lost}</div>
      </div>
    </div>
  );
}
