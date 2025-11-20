import React from "react";
import styles from "./Substitutions.module.css";
import { Paper, Typography } from "@mui/material";

export default function Substitutions({
  local,
  away,
}: {
  local: Array<{
    minuto?: string;
    entradorsal?: string;
    nombre_jugador_entra?: string;
    saledorsal?: string;
    nombre_jugador_sale?: string;
  }>;
  away: Array<{
    minuto?: string;
    entradorsal?: string;
    nombre_jugador_entra?: string;
    saledorsal?: string;
    nombre_jugador_sale?: string;
  }>;
}) {
  const localList = Array.isArray(local) ? local : [];
  const awayList = Array.isArray(away) ? away : [];

  if (localList.length === 0 && awayList.length === 0) return null;

  const renderItem = (s: any, idx: number) => {
    const minute = s.minuto || s.Minute || "";
    const enteringNumber = s.entradorsal || s.EnteringNumber || "";
    const enteringName = s.nombre_jugador_entra || s.EnteringPlayerName || "";
    const exitingNumber = s.saledorsal || s.ExitingNumber || "";
    const exitingName = s.nombre_jugador_sale || s.ExitingPlayerName || "";

    const leftNumber = enteringNumber ? (
      <span className={styles.dorsal}>{enteringNumber}</span>
    ) : null;
    const leftName = enteringName ? (
      <span className={styles.playerName}>{enteringName}</span>
    ) : null;
    const rightNumber = exitingNumber ? (
      <span className={styles.dorsalExit}>{exitingNumber}</span>
    ) : null;
    const rightName = exitingName ? (
      <span className={styles.playerNameExit}>{exitingName}</span>
    ) : null;

    return (
      <ListItem key={idx} className={styles.item}>
        <div className={styles.minuteWrap}>
          <div className={styles.minute}>{minute ? `${minute}'` : ""}</div>
        </div>

        <div className={styles.content}>
          <div className={styles.rowTop}>
            <div className={styles.entering}>
              {leftNumber}
              {leftName}
            </div>

            <div className={styles.arrowContainer} aria-hidden>
              <span className={styles.arrowCircleIn}>→</span>
              <span className={styles.arrowCircleOut}>←</span>
            </div>

            <div className={styles.exiting}>
              {rightNumber}
              {rightName}
            </div>
          </div>
        </div>
      </ListItem>
    );
  };

  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">Sustituciones</Typography>
      <div className={styles.colRow}>
        <div>
          <Typography variant="subtitle2">Local</Typography>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {localList.map((s, idx) => (
                  <tr key={idx} className={styles.row}>
                    <td className={styles.minuteCell}>
                      <div className={styles.minute}>
                        {s.minuto || s.Minute || ""
                          ? `${s.minuto || s.Minute}'`
                          : ""}
                      </div>
                    </td>
                    <td className={styles.enteringCell}>
                      <div className={styles.enteringCellInner}>
                        {s.entradorsal || s.EnteringNumber ? (
                          <span className={styles.dorsal}>
                            {s.entradorsal || s.EnteringNumber}
                          </span>
                        ) : null}
                        <span className={styles.playerName}>
                          {s.nombre_jugador_entra || s.EnteringPlayerName || ""}
                        </span>
                      </div>
                    </td>
                    <td className={styles.arrowCell}>
                      <div className={styles.arrowContainer} aria-hidden>
                        {s.entradorsal ||
                        s.EnteringNumber ||
                        s.nombre_jugador_entra ||
                        s.EnteringPlayerName ? (
                          <span className={styles.arrowCircleIn}>→</span>
                        ) : null}
                        {s.saledorsal ||
                        s.ExitingNumber ||
                        s.nombre_jugador_sale ||
                        s.ExitingPlayerName ? (
                          <span className={styles.arrowCircleOut}>←</span>
                        ) : null}
                      </div>
                    </td>
                    <td className={styles.exitingCell}>
                      <div className={styles.exitingCellInner}>
                        {s.saledorsal || s.ExitingNumber ? (
                          <span className={styles.dorsalExit}>
                            {s.saledorsal || s.ExitingNumber}
                          </span>
                        ) : null}
                        <span className={styles.playerNameExit}>
                          {s.nombre_jugador_sale || s.ExitingPlayerName || ""}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <Typography variant="subtitle2">Visitante</Typography>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {awayList.map((s, idx) => (
                  <tr key={idx} className={styles.row}>
                    <td className={styles.minuteCell}>
                      <div className={styles.minute}>
                        {s.minuto || s.Minute || ""
                          ? `${s.minuto || s.Minute}'`
                          : ""}
                      </div>
                    </td>
                    <td className={styles.enteringCell}>
                      <div className={styles.enteringCellInner}>
                        {s.entradorsal || s.EnteringNumber ? (
                          <span className={styles.dorsal}>
                            {s.entradorsal || s.EnteringNumber}
                          </span>
                        ) : null}
                        <span className={styles.playerName}>
                          {s.nombre_jugador_entra || s.EnteringPlayerName || ""}
                        </span>
                      </div>
                    </td>
                    <td className={styles.arrowCell}>
                      <div className={styles.arrowContainer} aria-hidden>
                        {s.entradorsal ||
                        s.EnteringNumber ||
                        s.nombre_jugador_entra ||
                        s.EnteringPlayerName ? (
                          <span className={styles.arrowCircleIn}>→</span>
                        ) : null}
                        {s.saledorsal ||
                        s.ExitingNumber ||
                        s.nombre_jugador_sale ||
                        s.ExitingPlayerName ? (
                          <span className={styles.arrowCircleOut}>←</span>
                        ) : null}
                      </div>
                    </td>
                    <td className={styles.exitingCell}>
                      <div className={styles.exitingCellInner}>
                        {s.saledorsal || s.ExitingNumber ? (
                          <span className={styles.dorsalExit}>
                            {s.saledorsal || s.ExitingNumber}
                          </span>
                        ) : null}
                        <span className={styles.playerNameExit}>
                          {s.nombre_jugador_sale || s.ExitingPlayerName || ""}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Paper>
  );
}
