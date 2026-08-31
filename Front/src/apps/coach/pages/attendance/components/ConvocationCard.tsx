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
  canEditThisConvocation?: boolean;
  isInjured?: boolean;
    highlighted?: boolean;
  viewablePlayerId?: string | null;
  hideWaitingListButton?: boolean;
  /**
   * Whether a Deconvoked convocation may be moved back to "Pendiente de
   * aceptar"/"Aceptada" from this card. Coach/Administrator can always
   * reactivate (parent should pass `true`); Player/FamilyMember can only
   * reactivate their own player's convocation on a Training event — the
   * button must not render at all otherwise (backend also enforces this
   * with a 403, see `handleChangeStatus` in AttendanceTabs).
   */
  canReactivateFromDeconvoke?: boolean;
  onChangeStatus: (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => void;
  onDelete: (conv: ConvocationItem) => void;
  onMoveToWaiting?: (conv: ConvocationItem) => void;
  /**
   * Opens the reason dialog to change the excuse reason of an already
   * Deconvoked convocation. Only rendered when the caller both provides this
   * handler and the current user can edit this convocation.
   */
  onEditReason?: (conv: ConvocationItem) => void;
};

const STATUS_LABELS: Record<string, string> = {
  Pending: "Pendiente",
  Accepted: "Aceptar",
  Deconvoke: "Rechazar",
};

const SELECTABLE_STATUSES = ["Accepted", "Deconvoke"];

const REACTIVATE_TARGET_STATUSES = ["Pending", "Accepted"];

const REACTIVATE_LABELS: Record<string, string> = {
  Pending: "Pendiente de aceptar",
  Accepted: "Aceptar",
};

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
  canEditThisConvocation,
  isInjured: isInjuredProp,
    highlighted,
  viewablePlayerId,
  hideWaitingListButton,
  canReactivateFromDeconvoke,
  onChangeStatus,
  onDelete,
  onMoveToWaiting,
  onEditReason,
}: Props) {
  const p = conv.player as any;
  const statusName = statuses.find((s) => s.id === conv.status)?.name ?? "";
  const displayName = p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
  const dorsalValue =
    typeof p.dorsal === "number" ? p.dorsal : p.dorsal ? Number(p.dorsal) : null;
  const hasDorsal = typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
  const photo = photoSrc ?? defaultAvatar;

  const canViewDetail =
    !viewablePlayerId || p.playerId === viewablePlayerId || p.id === viewablePlayerId;

  const stripeClass =
    statusName === "Accepted"
      ? styles.cromoStatusStripeAccepted
      : statusName === "Deconvoke"
      ? styles.cromoStatusStripeDeclined
      : styles.cromoStatusStripePending;

  if (isInjuredProp || p.isInjured) {
    return (
      <div className={styles.cardWrap}>
        <div className={styles.cromoCard}>
          {p.id && canViewDetail ? (
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
              {canEdit && onMoveToWaiting && !hideWaitingListButton && (
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

  const isDeconvoked = statusName === "Deconvoke";
  const isAccepted = statusName === "Accepted";
  const selectableStatuses = statuses.filter((s) => SELECTABLE_STATUSES.includes(s.name));
  const reactivateTargets = statuses.filter((s) => REACTIVATE_TARGET_STATUSES.includes(s.name));
  const canDoAction = canEditThisConvocation ?? canEdit;
  const showReactivateControls = isDeconvoked && !!canReactivateFromDeconvoke && canDoAction;
  const excuseLabel = isDeconvoked
    ? conv.excuseTypeId
      ? (excuseTypes.find((e) => e.id === conv.excuseTypeId)?.name ?? null)
      : "Decisión técnica"
    : null;

  return (
    <div className={styles.cardWrap}>
      <div className={`${styles.cromoCard}${highlighted ? " " + styles.cromoCardHighlighted : ""}`}>
        {p.id && canViewDetail ? (
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
                  {onMoveToWaiting && !hideWaitingListButton && (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {excuseLabel && (
                  <div className={styles.tagBadgeRow}>
                    <span className={`${styles.tagBadge} ${conv.excuseTypeId ? styles.tagDeconvoked : styles.tagDecision}`}>
                      {excuseLabel}
                    </span>
                  </div>
                )}
                {onEditReason && canDoAction && (
                  <button
                    className={`${styles.optionBtn} ${styles.optionBtnGray}`}
                    onClick={() => onEditReason(conv)}
                  >
                    ✎ Editar motivo
                  </button>
                )}
                {showReactivateControls && (
                  <div className={styles.optionGroup}>
                    {reactivateTargets.map((s) => (
                      <button
                        key={s.id}
                        className={`${styles.optionBtn} ${statusColorClass(s.name)}`}
                        onClick={() => onChangeStatus(conv, s.id, null)}
                      >
                        {REACTIVATE_LABELS[s.name] ?? s.name}
                      </button>
                    ))}
                  </div>
                )}
                {canEdit && onMoveToWaiting && !hideWaitingListButton && (
                  <button
                    className={`${styles.optionBtn} ${styles.optionBtnBlue}`}
                    onClick={() => onMoveToWaiting(conv)}
                  >
                    ↩ Lista de espera
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className={styles.tagBadgeRow}>
                  <span className={`${styles.tagBadge} ${styles.tagWaiting}`}>Pendiente de aceptar</span>
                </div>
                <div className={styles.optionGroup}>
                  {selectableStatuses.map((s) => {
                    const isActive = conv.status === s.id;
                    const colorClass = statusColorClass(s.name);
                    const canDoAction = canEditThisConvocation ?? canEdit;
                    return (
                      <button
                        key={s.id}
                        disabled={!canDoAction}
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
                {canEdit && onMoveToWaiting && !hideWaitingListButton && (
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
