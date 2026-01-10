import React from "react";
import styles from "./PrintableSquad.module.css";
import type { TeamPlayer } from "../../../types/player";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";

import type { TeamParticipationSummaryItem } from "../../../types/participation";

type Props = {
  teamName?: string;
  players: TeamPlayer[];
  ageSummary?: Record<number, number>;
  participations?: TeamParticipationSummaryItem[];
};

export default function PrintableSquad({
  teamName,
  players,
  ageSummary,
  participations,
}: Props) {
  const today = new Date().toLocaleDateString();

  return (
    <div className={styles.root} id="rffm-printable-squad">
      <div className={styles.page} id="rffm-printable-squad-header">
        <div className={styles.header}>
          <div className={styles.teamName}>{teamName}</div>
          <div>Fecha: {today}</div>
        </div>
      </div>

      <div className={styles.page} id="rffm-printable-squad-players">
        <div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dorsal</th>
                <th>Nombre</th>
                <th>Posición</th>
                <th>Partidos</th>
                <th>Goles</th>
                <th>Titular</th>
                <th>Suplente</th>
                <th>Amarillas</th>
                <th>Rojas</th>
                <th>Doble Amarilla</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const jersey =
                  (p as any).jerseyNumber ?? (p as any).dorsal ?? "";
                const name = p.name ?? (p as any).playerName ?? "";
                const position =
                  (p as any).position ?? (p as any).posicion ?? "";
                const matches = (p as any).matches || (p as any).partidos || {};
                const played =
                  matches.played ?? matches.played ?? matches.played ?? 0;
                const goals =
                  matches.totalGoals ??
                  matches.totalGoals ??
                  matches.totalGoals ??
                  0;
                const starter =
                  matches.starter ?? matches.titular ?? matches.start ?? 0;
                const substitute =
                  matches.substitute ?? matches.suplente ?? matches.subs ?? 0;
                const cards = (p as any).cards || (p as any).tarjetas || {};
                const yellow = cards.yellow ?? cards.amarillas ?? 0;
                const red = cards.red ?? cards.rojas ?? 0;
                const doubleYellow =
                  cards.doubleYellow ?? cards.doble_amarilla ?? 0;

                return (
                  <tr key={p.id ?? name}>
                    <td>{jersey}</td>
                    <td>{name}</td>
                    <td>{position}</td>
                    <td>{played}</td>
                    <td>{goals}</td>
                    <td>{starter}</td>
                    <td>{substitute}</td>
                    <td>{yellow}</td>
                    <td>{red}</td>
                    <td>{doubleYellow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.page} id="rffm-printable-squad-ages">
        <div className={styles.sectionTitle}>Resumen de edades</div>
        <div className={styles.ageSummary}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Edad</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {ageSummary &&
                Object.keys(ageSummary)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{(ageSummary as any)[k]}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.page} id="rffm-printable-squad-participations">
        <div className={styles.sectionTitle}>Participaciones</div>
        <div className={styles.participations}>
          {participations && participations.length > 0 ? (
            <div className={styles.participationList}>
              {participations.map((p, idx) => (
                <div key={idx} className={styles.participationItem}>
                  <div className={styles.participationTitle}>
                    {p.competitionName} — {p.groupName}
                  </div>
                  <div className={styles.participationDetails}>
                    {p.teamName}
                    {p.teamCode ? ` (${p.teamCode})` : ""} — Puntos:{" "}
                    {p.teamPoints ?? ""} — Jugadores: {p.count ?? ""}
                  </div>

                  {(p.players || []).length > 0 ? (
                    <ul className={styles.playersList}>
                      {(p.players || [])
                        .filter((pl) => pl != null)
                        .map((pl, plIdx) => (
                          <li key={pl?.playerId ?? pl?.id ?? plIdx}>
                            {pl?.name ?? ""}{" "}
                            {pl?.playerId ? `(${pl.playerId})` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description={
                "No hay participaciones registradas para este equipo"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
