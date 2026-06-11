import React from "react";
import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import type { Player } from "../../../types/player";
import styles from "./ClubPlayerCard.module.css";

type Props = {
  player: Player;
  to?: string;
};

export default function ClubPlayerCard({ player, to }: Props) {
  const fullName = ((player.name ?? "") + " " + (player.lastName ?? "")).trim();
  const displayName = player.alias?.trim() || fullName || "Jugador";
  const birthDate = player.birthDate ? new Date(player.birthDate) : null;
  const birthDateText = birthDate
    ? birthDate.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const card = (
    <article className={styles.card} aria-label={displayName}>
      <div className={styles.topRow}>
        <div className={styles.info}>
          <div className={styles.name}>{displayName}</div>
        </div>
        {typeof player.dorsal === "number" && Number.isFinite(player.dorsal) ? (
          <div className={styles.dorsalBadge} aria-label={`Dorsal ${player.dorsal}`}>
            {player.dorsal}
          </div>
        ) : null}
      </div>

      <div className={styles.metaRow}>
        {birthDateText ? <span className={styles.metaItem}>{birthDateText}</span> : null}
        {player.dni ? <span className={styles.metaItem}>{player.dni}</span> : null}
      </div>
    </article>
  );

  if (!to) return card;

  return (
    <Link to={to} className={styles.link}>
      {card}
    </Link>
  );
}