import React from "react";
import { Link } from "react-router-dom";
import type { ConvocationItem } from "../../../services/convocationService";
import styles from "../AttendanceTabs.module.css";
import defaultAvatar from "../../../../../assets/avatar.svg";

type Props = {
  conv: ConvocationItem;
  photoSrc?: string | null;
  statuses: { id: number; name: string }[];
  excuseTypes: { id: number; name: string; justified?: boolean }[];
  canEdit: boolean;
  isInjured?: boolean;
  onChangeStatus: (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => void;
  onDelete: (conv: ConvocationItem) => void;
  onMoveToWaiting?: (conv: ConvocationItem) => void;
};

const STATUS_LABELS: Record<string, string> = {
  Pending: "Pendiente",
  Accepted: "Aceptado",
  Deconvoke: "Rechazado",
};

const SELECTABLE_STATUSES = ["Accepted", "Deconvoke"];

function statusColorClass(name: string) {
  if (name === "Accepted") return styles.optionBtnGreen;
  if (name === "Deconvoke") return styles.optionBtnRed;
  return styles.optionBtnGray;
}

export default function ConvocationCard({
  conv,
  photoSrc,
  statuses,
  excuseTypes,
  canEdit,
  isInjured: isInjuredProp,
  onChangeStatus,
  onDelete,
  onMoveToWaiting,
}: Props) {
  const p = conv.player as any;
  const statusName = statuses.find((s) => s.id === conv.status)?.name ?? "";
  const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
  const dorsalValue =
    typeof p.dorsal === "number" ? p.dorsal : p.dorsal ? Number(p.dorsal) : null;
  const hasDorsal = typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
  const photo = photoSrc ?? defaultAvatar;

  const stripeClass =
    statusName === "Accepted"
      ? styles.cromoStatusStripeAccepted
      : statusName === "Deconvoke"
      ? styles.cromoStatusStripeDeclined
      : styles.cromoStatusStripePending;

  // Lesionado: prop override OR player field
  if (isInjuredProp || p.isInjured) {
    return (
      <div className={styles.cardWrap}>
        <div className={styles.cromoCard}>
          {p.id ? (
            <Link to={`/coach/player/${p.id}`} className={styles.cromoPhotoLink}>
              <div className={styles.cromoPhotoArea}>
                <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                <div className={styles.cromoGradient} />
                {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                <div className={styles.cromoInjuryCornerBadge}>🩹</div>
                <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeDeclined}`} />
              </div>
            </Link>
          ) : (
            <div className={styles.cromoPhotoArea}>
              <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
              <div className={styles.cromoGradient} />
              {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
              <div className={styles.cromoInjuryCornerBadge}>🩹</div>
              <div className={`${styles.cromoStatusStripe} ${styles.cromoStatusStripeDeclined}`} />
            </div>
          )}
          <div className={styles.cromoBody}>
            <div className={styles.cromoAccentLine} />
            <div className={styles.cromoName}>{displayName}</div>
            {p.position && <div className={styles.cromoPosition}>{p.position}</div>}
            <div className={styles.cromoActions}>
              <div className={styles.cromoInjuredBadge}>🩹 Lesionado</div>
              {canEdit && onMoveToWaiting && (
                <button
                  className={`${styles.optionBtn} ${styles.optionBtnBlue}`}
                  onClick={() => onMoveToWaiting(conv)}
                >
                  ↩ Lista de espera
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal: toggle buttons to change status
  // Deconvoked: show excuse label; Accepted: show deconvoke button; Pending: show toggle
  const isDeconvoked = statusName === "Deconvoke";
  const isAccepted = statusName === "Accepted";
  const selectableStatuses = statuses.filter((s) => SELECTABLE_STATUSES.includes(s.name));
  const excuseLabel = isDeconvoked
    ? conv.excuseTypeId
      ? (excuseTypes.find((e) => e.id === conv.excuseTypeId)?.name ?? null)
      : "Decisión técnica"
    : null;

  return (
    <div className={styles.cardWrap}>
      <div className={styles.cromoCard}>
        {p.id ? (
          <Link to={`/coach/player/${p.id}`} className={styles.cromoPhotoLink}>
            <div className={styles.cromoPhotoArea}>
              <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
              <div className={styles.cromoGradient} />
              {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
              <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
            </div>
          </Link>
        ) : (
          <div className={styles.cromoPhotoArea}>
            <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
            <div className={styles.cromoGradient} />
            {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
            <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
          </div>
        )}
        <div className={styles.cromoBody}>
          <div className={styles.cromoAccentLine} />
          <div className={styles.cromoName}>{displayName}</div>
          {p.position && <div className={styles.cromoPosition}>{p.position}</div>}
          <div className={styles.cromoActions}>
            {isAccepted ? (
              canEdit && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    className={`${styles.optionBtn} ${styles.optionBtnRed}`}
                    onClick={() => onDelete(conv)}
                    title="Desconvocar"
                  >
                    Desconvocar
                  </button>
                  {onMoveToWaiting && (
                    <button
                      className={`${styles.optionBtn} ${styles.optionBtnBlue}`}
                      onClick={() => onMoveToWaiting(conv)}
                    >
                      ↩ Lista de espera
                    </button>
                  )}
                </div>
              )
            ) : isDeconvoked ? (
              // Deconvoked: show excuse label + option to move back to waiting
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {excuseLabel && (
                  <div className={styles.tagBadgeRow}>
                    <span className={`${styles.tagBadge} ${conv.excuseTypeId ? styles.tagDeconvoked : styles.tagDecision}`}>
                      {excuseLabel}
                    </span>
                  </div>
                )}
                {canEdit && onMoveToWaiting && (
                  <button
                    className={`${styles.optionBtn} ${styles.optionBtnBlue}`}
                    onClick={() => onMoveToWaiting(conv)}
                  >
                    ↩ Lista de espera
                  </button>
                )}
              </div>
            ) : (
              // Pending: tag + toggle buttons
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className={styles.tagBadgeRow}>
                  <span className={`${styles.tagBadge} ${styles.tagWaiting}`}>Pendiente de aceptar</span>
                </div>
                <div className={styles.optionGroup}>
                {selectableStatuses.map((s) => {
                  const isActive = conv.status === s.id;
                  const colorClass = statusColorClass(s.name);
                  return (
                    <button
                      key={s.id}
                      disabled={!canEdit}
                      className={`${styles.optionBtn} ${colorClass}${isActive ? " " + styles.optionBtnActive : ""}`}
                      onClick={() => {
                        if (s.name === "Deconvoke") {
                          onDelete(conv);
                        } else {
                          onChangeStatus(conv, s.id, null);
                        }
                      }}
                    >
                      {STATUS_LABELS[s.name] ?? s.name}
                    </button>
                  );
                })}
                </div>
                {canEdit && onMoveToWaiting && (
                  <button
                    className={`${styles.optionBtn} ${styles.optionBtnBlue}`}
                    onClick={() => onMoveToWaiting(conv)}
                  >
                    ↩ Lista de espera
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
