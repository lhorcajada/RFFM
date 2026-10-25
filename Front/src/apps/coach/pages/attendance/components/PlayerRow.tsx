import React from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@mui/material";
import defaultAvatar from "../../../../../assets/avatar.svg";
import styles from "./PlayerRow.module.css";

export type PlayerRowTone = "accepted" | "pending" | "declined" | "waiting" | "available";

export type PlayerRowStatus = { label: string; tone: PlayerRowTone };

type Props = {
  name: string;
  photoSrc?: string | null;
  dorsal?: number | null;
  positionTag?: string | null;
  secondary?: string | null;
  status?: PlayerRowStatus | null;
  detailHref?: string | null;
  dimmed?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  selectLabel?: string;
  actions?: React.ReactNode;
  testId?: string;
};

const TONE_CLASS: Record<PlayerRowTone, string> = {
  accepted: styles.chipAccepted,
  pending: styles.chipPending,
  declined: styles.chipDeclined,
  waiting: styles.chipWaiting,
  available: styles.chipAccepted,
};

export default function PlayerRow({
  name,
  photoSrc,
  dorsal,
  positionTag,
  secondary,
  status,
  detailHref,
  dimmed,
  selectable,
  selected,
  onToggleSelect,
  selectLabel,
  actions,
  testId,
}: Props) {
  const photo = photoSrc ?? defaultAvatar;
  const hasDorsal = typeof dorsal === "number" && Number.isFinite(dorsal);

  const identity = (
    <>
      <span className={`${styles.avatarWrap}${dimmed ? " " + styles.dimmed : ""}`}>
        <img
          src={photo}
          alt=""
          className={photo === defaultAvatar ? styles.avatarDefault : styles.avatar}
        />
        {hasDorsal && <span className={styles.dorsal}>{dorsal}</span>}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {secondary && <span className={styles.secondary}>{secondary}</span>}
      </span>
    </>
  );

  return (
    <li className={styles.row} data-testid={testId}>
      {selectable && (
        <Checkbox
          className={styles.checkbox}
          size="small"
          checked={!!selected}
          onChange={() => onToggleSelect?.()}
          inputProps={{ "aria-label": selectLabel ?? `Seleccionar a ${name}` }}
        />
      )}
      {detailHref ? (
        <Link to={detailHref} className={styles.identity}>
          {identity}
        </Link>
      ) : (
        <span className={styles.identity}>{identity}</span>
      )}
      {positionTag && <span className={styles.positionTag}>{positionTag}</span>}
      {status && <span className={`${styles.chip} ${TONE_CLASS[status.tone]}`}>{status.label}</span>}
      {actions && <span className={styles.actions}>{actions}</span>}
    </li>
  );
}
