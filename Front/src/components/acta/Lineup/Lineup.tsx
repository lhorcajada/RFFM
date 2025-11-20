import React from "react";
import styles from "./Lineup.module.css";
import type { PlayerActa, GoalEvent } from "../../../types/acta";
import { Paper, Typography, List, ListItem, Avatar } from "@mui/material";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";

export default function Lineup({
  title,
  players,
  teamName,
  goals,
}: {
  title: string;
  players: PlayerActa[];
  teamName?: string;
  goals?: GoalEvent[];
}) {
  const titulares = players.filter((p) => p.titular === "1");
  const suplentes = players.filter((p) => !titulares.includes(p));
  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">
        {title} — {teamName}
      </Typography>

      <div className={styles.section}>
        <Typography variant="subtitle2">
          Titulares ({titulares.length})
        </Typography>
        <List>
          {titulares.map((p) => (
            <ListItem key={p.codjugador} className={styles.item}>
              {p.dorsal ? (
                <div className={styles.jersey}>{p.dorsal}</div>
              ) : (
                <Avatar src={p.foto} />
              )}
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span>
                    {p.nombre_jugador}
                    {p.capitan === "1" ? (
                      <MilitaryTechIcon
                        className={styles.captainBadge}
                        titleAccess="Capitán"
                        fontSize="small"
                      />
                    ) : null}
                  </span>
                  <div className={styles.meta}>
                    {p.posicion_jugador_abreviatura}
                  </div>
                  {goals && (
                    <span className={styles.goalsList}>
                      {goals
                        .filter(
                          (g) => String(g.codjugador) === String(p.codjugador)
                        )
                        .map((g, idx) => {
                          const tipo = String(g.tipo_gol ?? "");
                          const ballClass =
                            tipo === "102"
                              ? styles.goalBallRed
                              : tipo === "100"
                              ? styles.goalBallWhite
                              : styles.goalBall;
                          return (
                            <span key={idx} className={styles.goalItem}>
                              {tipo === "100" ? (
                                <span className={styles.goalBallWhite}>
                                  <SportsSoccerIcon
                                    className={styles.goalIconInside}
                                  />
                                </span>
                              ) : (
                                <SportsSoccerIcon className={ballClass} />
                              )}
                              <span className={styles.goalMinute}>
                                {g.minuto}'
                              </span>
                              {tipo === "101" && (
                                <span className={styles.goalPenalty}>pen</span>
                              )}
                            </span>
                          );
                        })}
                    </span>
                  )}
                </div>
              </div>
            </ListItem>
          ))}
        </List>
      </div>

      {suplentes.length > 0 && (
        <div className={styles.section}>
          <Typography variant="subtitle2">
            Suplentes ({suplentes.length})
          </Typography>
          <List>
            {suplentes.map((p) => (
              <ListItem key={p.codjugador} className={styles.item}>
                {p.dorsal ? (
                  <div className={styles.jersey}>{p.dorsal}</div>
                ) : (
                  <Avatar src={p.foto} />
                )}
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span>{p.nombre_jugador}</span>
                    <div className={styles.meta}>
                      {p.posicion_jugador_abreviatura}
                    </div>
                    {goals && (
                      <span className={styles.goalsList}>
                        {goals
                          .filter(
                            (g) => String(g.codjugador) === String(p.codjugador)
                          )
                          .map((g, idx) => {
                            const tipo = String(g.tipo_gol ?? "");
                            const ballClass =
                              tipo === "102"
                                ? styles.goalBallRed
                                : tipo === "100"
                                ? styles.goalBallWhite
                                : styles.goalBall;
                            return (
                              <span key={idx} className={styles.goalItem}>
                                {tipo === "100" ? (
                                  <span className={styles.goalBallWhite}>
                                    <SportsSoccerIcon
                                      className={styles.goalIconInside}
                                    />
                                  </span>
                                ) : (
                                  <SportsSoccerIcon className={ballClass} />
                                )}
                                <span className={styles.goalMinute}>
                                  {g.minuto}'
                                </span>
                                {tipo === "101" && (
                                  <span className={styles.goalPenalty}>
                                    pen
                                  </span>
                                )}
                              </span>
                            );
                          })}
                      </span>
                    )}
                  </div>
                </div>
              </ListItem>
            ))}
          </List>
        </div>
      )}
    </Paper>
  );
}
