import React from "react";
import { Link } from "react-router-dom";
import defaultAvatar from "../../../../../assets/avatar.svg";
import type { PlayerRowStatus } from "./PlayerRow";
import rowStyles from "./PlayerRow.module.css";
import styles from "./OwnPlayerCard.module.css";

type Props = {
  name: string;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  status: PlayerRowStatus;
  detail?: string | null;
  detailHref?: string | null;
  actions?: React.ReactNode;
};

const TONE_CLASS: Record<PlayerRowStatus["tone"], string> = {
  accepted: rowStyles.chipAccepted,
  pending: rowStyles.chipPending,
  declined: rowStyles.chipDeclined,
  waiting: rowStyles.chipWaiting,
  available: rowStyles.chipAccepted,
};

export default function OwnPlayerCard({ name, photoSrc, dorsal, position, status, detail, detailHref, actions }: Props) {
  const photo = photoSrc ?? defaultAvatar;
  const hasDorsal = typeof dorsal === "number" && Number.isFinite(dorsal);

  const identity = (
    <>
      <span className={styles.avatarWrap}>
        <img src={photo} alt="" className={photo === defaultAvatar ? styles.avatarDefault : styles.avatar} />
        {hasDorsal && <span className={styles.dorsal}>{dorsal}</span>}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {position && <span className={styles.position}>{position}</span>}
      </span>
    </>
  );

  return (
    <section className={styles.card} aria-label="Tu jugador">
      <div className={styles.title}>Tu jugador</div>
      <div className={styles.header}>
        {detailHref ? (
          <Link to={detailHref} className={styles.identity}>
            {identity}
          </Link>
        ) : (
          <span className={styles.identity}>{identity}</span>
        )}
        <span className={`${rowStyles.chip} ${TONE_CLASS[status.tone]}`}>{status.label}</span>
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}
