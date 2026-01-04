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
  actions?: React.ReactNode;
};

export default function PlayerCard({ player, photoSrc, to, actions }: Props) {
  const navigate = useNavigate();
  const rawName = ((player.name ?? "") + " " + (player.lastName ?? "")).trim();
  const displayName = rawName || player.alias || "Jugador";
  const displayAlias = player.alias ?? "";
  const dorsalValue =
    typeof player.dorsal === "number"
      ? player.dorsal
      : player.dorsal
      ? Number(player.dorsal)
      : null;
  const hasDorsal =
    typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
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
    <img
      src={photoSrc}
      alt={displayAlias || displayName}
      className={styles.avatar}
    />
  ) : (
    <Avatar className={styles.avatar}>
      {String(displayAlias || displayName || "")
        .charAt(0)
        .toUpperCase()}
    </Avatar>
  );

  const content = (
    <div className={styles.card} role="group" aria-label={`${displayName}`}>
      {hasDorsal ? (
        <div
          className={styles.dorsalBadge}
          aria-label={`Dorsal ${dorsalValue}`}
        >
          {dorsalValue}
        </div>
      ) : null}

      <div className={styles.topRow}>
        <div className={styles.left}>{avatarNode}</div>
        <div className={styles.info}>
          <div className={styles.title}>{displayAlias || displayName}</div>
          <div className={styles.subtitle}>
            {player.licenseNumber ?? ""}
            {dobText ? ` • ${dobText}` : ""}
          </div>
        </div>
        {!to && player.id && (
          <div className={styles.actionCol}>
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

      {actions ? <div className={styles.actionsRow}>{actions}</div> : null}

      {player.position ? (
        <div className={styles.positionRow}>{player.position}</div>
      ) : null}
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
