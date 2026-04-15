import React from "react";
import PlayerCard from "../../../components/PlayerCard/PlayerCard";
import type { ConvocationItem } from "../../../services/convocationService";
import styles from "../AttendanceTabs.module.css";

type Props = {
  conv: ConvocationItem;
  photoSrc?: string | null;
  statuses: { id: number; name: string }[];
  excuseTypes: { id: number; name: string; justified?: boolean }[];
  canEdit: boolean;
  onChangeStatus: (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => void;
  onDelete: (conv: ConvocationItem) => void;
  onRequestDecline: (conv: ConvocationItem) => void;
};

const STATUS_LABELS: Record<string, string> = {
  Pending: "Pendiente",
  Accepted: "Aceptado",
  Declined: "Declinado",
  Deconvoke: "Desconvocado",
};

const SELECTABLE_STATUSES = ["Accepted", "Declined", "Deconvoke"];

function statusColorClass(name: string) {
  if (name === "Accepted") return styles.optionBtnGreen;
  if (name === "Declined") return styles.optionBtnRed;
  if (name === "Deconvoke") return styles.optionBtnRed;
  return styles.optionBtnGray;
}

export default function ConvocationCard({
  conv,
  photoSrc,
  statuses,
  excuseTypes,
  canEdit,
  onChangeStatus,
  onDelete,
  onRequestDecline,
}: Props) {
  const p = conv.player as any;
  const statusName = statuses.find((s) => s.id === conv.status)?.name ?? "";
  const statusClass =
    statusName === "Accepted"
      ? styles.cardStatusAccepted
      : statusName === "Declined"
      ? styles.cardStatusDeclined
      : statusName === "Deconvoke"
      ? styles.cardStatusDeclined
      : statusName === "Justified"
      ? styles.cardStatusJustified
      : styles.cardStatusPending;

  // Lesionado: solo badge, sin controles
  if (p.isInjured) {
    return (
      <div className={styles.cardWrap}>
        <div className={`${styles.cardInner} ${styles.cardStatusDeclined}`}>
          <PlayerCard
            player={{ ...(p as any), position: p.position }}
            photoSrc={photoSrc}
            actions={
              <div className={styles.tagBadgeRow}>
                <span className={`${styles.tagBadge} ${styles.tagInjured}`}>Lesionado</span>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  // Normal: toggle buttons para cambiar estado
  const selectableStatuses = statuses.filter((s) => SELECTABLE_STATUSES.includes(s.name));
  const isDeclined = statusName === "Declined";
  const declinedId = statuses.find((s) => s.name === "Declined")?.id;

  const statusActions = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
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
                if (s.name === "Declined") onRequestDecline(conv);
                else onChangeStatus(conv, s.id, null);
              }}
            >
              {STATUS_LABELS[s.name] ?? s.name}
            </button>
          );
        })}
      </div>
      {isDeclined && excuseTypes.length > 0 && (
        <div className={styles.optionGroupSub}>
          {excuseTypes.map((ex) => {
            const isActive = conv.excuseTypeId === ex.id;
            return (
              <button
                key={ex.id}
                disabled={!canEdit}
                className={`${styles.optionBtn} ${styles.optionSubBtn} ${styles.optionBtnPurple}${isActive ? " " + styles.optionBtnActive : ""}`}
                onClick={() => onChangeStatus(conv, declinedId!, ex.id)}
              >
                {ex.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.cardWrap}>
      <div className={`${styles.cardInner} ${statusClass}`}>
        <PlayerCard
          player={{ ...(p as any), position: p.position }}
          photoSrc={photoSrc}
          actions={statusActions}
        />
      </div>
    </div>
  );
}
