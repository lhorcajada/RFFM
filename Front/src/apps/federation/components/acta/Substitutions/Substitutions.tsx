import React from "react";
import styles from "./Substitutions.module.css";
import { Paper, Typography } from "@mui/material";
import type { Substitution } from "../../../types/acta";
import PlayerNameButton from "../../players/PlayerNameButton/PlayerNameButton";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : null;
}

function pickString(o: Record<string, unknown> | null, keys: string[]): string {
  if (!o) return "";
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

export default function Substitutions({
  local,
  away,
  onPlayerClick,
}: {
  local?: Substitution[];
  away?: Substitution[];
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
}) {
  const localList: Substitution[] = Array.isArray(local) ? local : [];
  const awayList: Substitution[] = Array.isArray(away) ? away : [];

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
                {localList.map((s, idx) => {
                  const rec = asRecord(s);
                  const minute = pickString(rec, ["minuto", "Minute"]);
                  const enteringDorsal = pickString(rec, [
                    "entradorsal",
                    "EnteringNumber",
                  ]);
                  const enteringName = pickString(rec, [
                    "nombre_jugador_entra",
                    "EnteringPlayerName",
                  ]);
                  const enteringCode = pickString(rec, [
                    "codjugador_entra",
                    "EnteringPlayerCode",
                  ]);
                  const exitingDorsal = pickString(rec, [
                    "saledorsal",
                    "ExitingNumber",
                  ]);
                  const exitingName = pickString(rec, [
                    "nombre_jugador_sale",
                    "ExitingPlayerName",
                  ]);
                  const exitingCode = pickString(rec, [
                    "codjugador_sale",
                    "ExitingPlayerCode",
                  ]);

                  return (
                    <tr key={idx} className={styles.row}>
                      <td className={styles.minuteCell}>
                        <div className={styles.minute}>
                          {minute ? `${minute}'` : ""}
                        </div>
                      </td>
                      <td className={styles.enteringCell}>
                        <div className={styles.enteringCellInner}>
                          {enteringDorsal ? (
                            <span className={styles.dorsal}>
                              {enteringDorsal}
                            </span>
                          ) : null}
                          <span className={styles.playerName}>
                            <PlayerNameButton
                              playerCode={enteringCode}
                              playerName={enteringName}
                              onPlayerClick={onPlayerClick}
                            />
                          </span>
                        </div>
                      </td>
                      <td className={styles.arrowCell}>
                        <div className={styles.arrowContainer} aria-hidden>
                          {enteringDorsal || enteringName ? (
                            <span className={styles.arrowCircleIn}>→</span>
                          ) : null}
                          {exitingDorsal || exitingName ? (
                            <span className={styles.arrowCircleOut}>←</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={styles.exitingCell}>
                        <div className={styles.exitingCellInner}>
                          {exitingDorsal ? (
                            <span className={styles.dorsalExit}>
                              {exitingDorsal}
                            </span>
                          ) : null}
                          <span className={styles.playerNameExit}>
                            <PlayerNameButton
                              playerCode={exitingCode}
                              playerName={exitingName}
                              onPlayerClick={onPlayerClick}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <Typography variant="subtitle2">Visitante</Typography>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {awayList.map((s, idx) => {
                  const rec = asRecord(s);
                  const minute = pickString(rec, ["minuto", "Minute"]);
                  const enteringDorsal = pickString(rec, [
                    "entradorsal",
                    "EnteringNumber",
                  ]);
                  const enteringName = pickString(rec, [
                    "nombre_jugador_entra",
                    "EnteringPlayerName",
                  ]);
                  const enteringCode = pickString(rec, [
                    "codjugador_entra",
                    "EnteringPlayerCode",
                  ]);
                  const exitingDorsal = pickString(rec, [
                    "saledorsal",
                    "ExitingNumber",
                  ]);
                  const exitingName = pickString(rec, [
                    "nombre_jugador_sale",
                    "ExitingPlayerName",
                  ]);
                  const exitingCode = pickString(rec, [
                    "codjugador_sale",
                    "ExitingPlayerCode",
                  ]);

                  return (
                    <tr key={idx} className={styles.row}>
                      <td className={styles.minuteCell}>
                        <div className={styles.minute}>
                          {minute ? `${minute}'` : ""}
                        </div>
                      </td>
                      <td className={styles.enteringCell}>
                        <div className={styles.enteringCellInner}>
                          {enteringDorsal ? (
                            <span className={styles.dorsal}>
                              {enteringDorsal}
                            </span>
                          ) : null}
                          <span className={styles.playerName}>
                            <PlayerNameButton
                              playerCode={enteringCode}
                              playerName={enteringName}
                              onPlayerClick={onPlayerClick}
                            />
                          </span>
                        </div>
                      </td>
                      <td className={styles.arrowCell}>
                        <div className={styles.arrowContainer} aria-hidden>
                          {enteringDorsal || enteringName ? (
                            <span className={styles.arrowCircleIn}>→</span>
                          ) : null}
                          {exitingDorsal || exitingName ? (
                            <span className={styles.arrowCircleOut}>←</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={styles.exitingCell}>
                        <div className={styles.exitingCellInner}>
                          {exitingDorsal ? (
                            <span className={styles.dorsalExit}>
                              {exitingDorsal}
                            </span>
                          ) : null}
                          <span className={styles.playerNameExit}>
                            <PlayerNameButton
                              playerCode={exitingCode}
                              playerName={exitingName}
                              onPlayerClick={onPlayerClick}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Paper>
  );
}
