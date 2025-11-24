import React from "react";
import styles from "./Substitutions.module.css";
import { Paper, Typography } from "@mui/material";

export default function Substitutions({
  local,
  away,
}: {
  local?: any[];
  away?: any[];
}) {
  const localList = Array.isArray(local) ? local : [];
  const awayList = Array.isArray(away) ? away : [];

  if (localList.length === 0 && awayList.length === 0) return null;

  // rendering helpers removed — table output below handles both Spanish/English fields

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
