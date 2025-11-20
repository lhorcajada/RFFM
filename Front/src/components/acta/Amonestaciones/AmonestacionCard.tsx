import React from "react";
import styles from "./AmonestacionCard.module.css";
import type { CardEvent } from "../../../types/acta";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { Chip } from "@mui/material";
import {
  YellowCardIcon,
  RedCardIcon,
  DoubleYellowIcon,
} from "../../ui/CardIcons/CardIcons";

export default function AmonestacionCard({
  event,
  playerName,
  dorsal,
  teamName,
  teamType,
}: {
  event: CardEvent;
  playerName?: string;
  dorsal?: string | number;
  teamName?: string;
  teamType?: "local" | "away" | string;
}) {
  const tipo = String(event.codigo_tipo_amonestacion ?? event.codigo ?? "");
  const isSecond =
    String(event.segunda_amarilla) === "1" ||
    String(event.segunda_amarilla) === "true";
  const label = isSecond
    ? "Segunda amarilla"
    : tipo === "2"
    ? "Roja"
    : "Amarilla";
  const icon = isSecond ? (
    <DoubleYellowIcon className={styles.cardIconDouble} />
  ) : tipo === "2" ? (
    <RedCardIcon className={styles.cardIconRed} />
  ) : (
    <YellowCardIcon className={styles.cardIconYellow} />
  );
  return (
    <div className={styles.card}>
      <div className={styles.left}>
        <div className={styles.minute}>{event.minuto}'</div>
      </div>
      <div className={styles.center}>
        <div className={styles.playerRow}>
          <div className={styles.player}>{playerName}</div>
          <div
            className={styles.cardIconWrap}
            role="img"
            aria-label={label}
            title={label}
          >
            {icon}
          </div>
        </div>
        {/* label text removed; icon conveys card type (accessible via title/aria-label) */}
      </div>
      <div className={styles.right}>
        <div className={styles.rightInner}>
          {dorsal ? (
            <Chip
              size="small"
              label={
                <span className={styles.chipDorsal}>
                  <span className={styles.chipDorsalLabel}>Dorsal</span>
                  <span className={styles.chipDorsalNumber}>{dorsal}</span>
                </span>
              }
              sx={{
                backgroundColor: "transparent",
                color: "#fff",
                fontWeight: 700,
                height: 28,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "none",
              }}
            />
          ) : null}
          {teamName ? (
            <Chip
              label={<span className={styles.teamChipLabel}>{teamName}</span>}
              className={`${styles.chipTeamRoot} ${
                teamType === "local"
                  ? styles.teamLocal
                  : teamType === "away"
                  ? styles.teamAway
                  : styles.teamNeutral
              }`}
              size="small"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
