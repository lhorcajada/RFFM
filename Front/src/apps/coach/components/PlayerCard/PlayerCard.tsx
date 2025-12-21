import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import styles from "./PlayerCard.module.css";
import type { Player } from "../../types/player";

type Props = {
  player: Player;
  photoSrc?: string | null;
  to?: string;
};

export default function PlayerCard({ player, photoSrc, to }: Props) {
  const navigate = useNavigate();
  const displayName =
    ((player.name ?? "") + " " + (player.lastName ?? "")).trim() || "Jugador";
  const dorsalText = player.dorsal ? `#${player.dorsal}` : "sin dorsal";
  const positionText = player.position ? player.position : "sin posición";
  const meta: string[] = [dorsalText, positionText];
  const dob = player.birthDate ? new Date(player.birthDate) : null;
  const dobText = dob
    ? dob.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const avatarNode = photoSrc ? (
    // eslint-disable-next-line jsx-a11y/img-redundant-alt
    <img src={photoSrc} alt={displayName} className={styles.avatar} />
  ) : (
    <Avatar className={styles.avatar}>
      {(player.name || "").charAt(0).toUpperCase()}
    </Avatar>
  );

  const content = (
    <div
      className={styles.card}
      role="group"
      aria-label={`Jugador ${displayName}`}
    >
      <div className={styles.left}>
        {avatarNode}
        {player.alias ? (
          <div className={styles.subtitle}>{player.alias}</div>
        ) : (
          <div className={styles.subtitle} />
        )}
      </div>
      <div className={styles.info} style={{ flex: 1 }}>
        <div className={styles.title}>{displayName}</div>
        <div className={styles.subtitle}>
          {player.licenseNumber ?? ""}
          {dobText ? ` • ${dobText}` : ""}
        </div>
        {meta.length > 0 && (
          <div className={styles.meta}>
            {meta.map((m, i) => (
              <div key={i} className={styles.metaItem}>
                {m}
              </div>
            ))}
          </div>
        )}
        {!to && player.id && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              size="small"
              onClick={() => {
                if (!player.id) return;
                navigate(`/coach/player/${player.id}`);
              }}
              aria-label="Ver ficha"
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );

  if (to)
    return (
      <Link to={to} className={styles.link}>
        {content}
      </Link>
    );
  return content;
}
