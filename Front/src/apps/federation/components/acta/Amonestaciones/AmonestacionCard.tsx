import React from "react";
import styles from "./AmonestacionCard.module.css";
import type { CardEvent } from "../../../types/acta";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { Chip } from "@mui/material";
import {
  YellowCardIcon,
  RedCardIcon,
  DoubleYellowIcon,
} from "../../../../../shared/components/ui/CardIcons/CardIcons";
import PlayerNameButton from "../../players/PlayerNameButton/PlayerNameButton";

export default function AmonestacionCard({
  event,
  playerCode,
  playerName,
  dorsal,
  teamName,
  teamType,
  onPlayerClick,
}: {
  event: CardEvent;
  playerCode?: string;
  playerName?: string;
  dorsal?: string | number;
  teamName?: string;
  teamType?: "local" | "away" | string;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
}) {
  const tipo = String(event.codigo_tipo_amonestacion ?? event.codigo ?? "");
  const isSecond =
    String(event.segunda_amarilla) === "1" ||
    String(event.segunda_amarilla) === "true";

  // 100 = Amarilla, 101 = Roja, 102 = Doble amarilla
  const isRed = tipo === "101";
  const isDoubleYellow = tipo === "102" || isSecond;

  const label = isDoubleYellow
    ? "Segunda amarilla"
    : isRed
      ? "Roja"
      : "Amarilla";
  const icon = isDoubleYellow ? (
    <DoubleYellowIcon className={styles.cardIconDouble} />
  ) : isRed ? (
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
          <div className={styles.player}>
            <PlayerNameButton
              playerCode={playerCode}
              playerName={playerName}
              onPlayerClick={onPlayerClick}
            />
          </div>
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
              className={styles.chipDorsalRoot}
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
