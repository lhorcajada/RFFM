import React from "react";
import { Chip, Select, MenuItem, IconButton, Typography } from "@mui/material";
import PlayerCard from "../../../components/PlayerCard/PlayerCard";
import type { ConvocationItem } from "../../services/convocationService";
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
  return (
    <div className={styles.cardWrap}>
      <div className={styles.cardInner}>
        <PlayerCard
          player={{ ...(p as any), position: p.position }}
          photoSrc={photoSrc}
        />
        <div className={styles.cardActions}>
          <Chip
            label={statuses.find((s) => s.id === conv.status)?.name ?? "-"}
            className={styles.statusChip}
          />
          <Select
            size="small"
            value={conv.status}
            onChange={(e) => {
              const newStatus = Number(e.target.value);
              const found = statuses.find((s) => s.id === newStatus);
              if (found?.name === "Declined") onRequestDecline(conv);
              else onChangeStatus(conv, newStatus, null);
            }}
          >
            {statuses.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
          {conv.status &&
            conv.status === statuses.find((s) => s.name === "Declined")?.id && (
              <Select
                size="small"
                value={conv.excuseTypeId ?? ""}
                onChange={(e) =>
                  onChangeStatus(conv, conv.status, Number(e.target.value))
                }
              >
                <MenuItem value="">Seleccione justificante</MenuItem>
                {excuseTypes.map((ex) => (
                  <MenuItem key={ex.id} value={ex.id}>
                    {ex.name} {ex.justified ? "(Justificado)" : ""}
                  </MenuItem>
                ))}
              </Select>
            )}

          <div style={{ flex: 1 }} />
          {canEdit && (
            <IconButton size="small" onClick={() => onDelete(conv)}>
              <Typography variant="button">Eliminar</Typography>
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
