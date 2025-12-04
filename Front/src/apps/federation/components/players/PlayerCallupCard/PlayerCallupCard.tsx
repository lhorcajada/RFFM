import React from "react";
import styles from "./PlayerCallupCard.module.css";
import type {
  PlayerCallupsResponse,
  CallupEntry,
} from "../../../types/callups";
import { Card, CardContent, Typography, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import StarIcon from "@mui/icons-material/Star";

function formatDate(d: string | Date) {
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleDateString();
  } catch (e) {
    return String(d);
  }
}

export default function PlayerCallupCard({
  player,
}: {
  player: PlayerCallupsResponse;
}) {
  const totalDesconv = player.callups.filter((c) => !c.called).length;
  const totalStarter = player.callups.filter((c) => c.starter).length;
  const totalShown = player.callups.length;

  return (
    <div className={styles.playerRow}>
      <div className={styles.header}>
        <div className={styles.name}>{player.playerName}</div>
        <div className={styles.totals}>
          <span className={styles.badRed}>Desconv: {totalDesconv}</span>
          <span className={styles.badGreen}>Tit: {totalStarter}</span>
          <span className={styles.bad}>J: {totalShown}</span>
        </div>
      </div>

      <div className={styles.cards}>
        {player.callups
          .slice()
          .sort((a, b) => a.matchDayNumber - b.matchDayNumber)
          .map((c) => (
            <Card
              key={c.matchDayNumber}
              className={`${styles.card} ${
                c.called ? styles.called : styles.notCalled
              }`}
            >
              <CardContent className={styles.cardContent}>
                <div className={styles.rowTop}>
                  <div className={styles.jornada}>J{c.matchDayNumber}</div>
                  <div className={styles.opponent}>{c.opponent}</div>
                </div>
                <div className={styles.rowBottom}>
                  <div className={styles.date}>{formatDate(c.date)}</div>
                  <div className={styles.icons}>
                    {c.called ? (
                      <Tooltip title="Convocado">
                        <CheckCircleIcon className={styles.icon} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Desconvocado">
                        <PersonOffIcon className={styles.icon} />
                      </Tooltip>
                    )}
                    {c.starter && (
                      <Tooltip title="Titular">
                        <StarIcon className={styles.iconStar} />
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
