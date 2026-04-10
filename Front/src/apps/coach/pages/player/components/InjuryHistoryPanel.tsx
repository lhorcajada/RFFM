import { useEffect, useState } from "react";
import {
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  deletePlayerInjury,
  getPlayerInjuries,
  updatePlayerInjury,
} from "../../../services/teamplayerService";
import type { InjuryRecord } from "../../../services/teamplayerService";
import InjuryDialog from "./InjuryDialog";
import styles from "./InjuryHistoryPanel.module.css";

type Props = {
  teamPlayerId: string;
  refreshKey?: number;
  onActiveInjuryChange?: (inj: InjuryRecord | null) => void;
};

export default function InjuryHistoryPanel({
  teamPlayerId,
  refreshKey,
  onActiveInjuryChange,
}: Props) {
  const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<InjuryRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const list = await getPlayerInjuries(teamPlayerId);
    setInjuries(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [teamPlayerId, refreshKey]);

  function notifyActiveChange(list: InjuryRecord[]) {
    onActiveInjuryChange?.(list.find((i) => !i.endDate) ?? null);
  }

  function handleEdit(record: InjuryRecord) {
    setEditTarget(record);
    setDialogOpen(true);
  }

  async function handleDelete(record: InjuryRecord) {
    if (!confirm(`¿Eliminar el registro de lesión "${record.injuryType}"?`)) return;
    const ok = await deletePlayerInjury(teamPlayerId, record.id);
    if (!ok) return;
    const next = injuries.filter((i) => i.id !== record.id);
    setInjuries(next);
    notifyActiveChange(next);
  }

  async function handleDischarge(record: InjuryRecord) {
    const endDate = new Date().toISOString();
    const updated = await updatePlayerInjury(teamPlayerId, record.id, {
      startDate: record.startDate,
      injuryType: record.injuryType,
      description: record.description,
      estimatedRecovery: record.estimatedRecovery,
      endDate,
    });
    if (!updated) return;
    const next = injuries.map((i) => (i.id === record.id ? updated : i));
    setInjuries(next);
    notifyActiveChange(next);
  }

  async function handleSave(data: {
    startDate: string;
    injuryType: string;
    description?: string | null;
    estimatedRecovery?: string | null;
    endDate?: string | null;
  }) {
    if (!editTarget) return;
    setSaving(true);
    const updated = await updatePlayerInjury(teamPlayerId, editTarget.id, {
      ...data,
      endDate: data.endDate || null,
    });
    setSaving(false);
    setDialogOpen(false);
    setEditTarget(null);
    if (!updated) return;
    const next = injuries.map((i) => (i.id === editTarget.id ? updated : i));
    setInjuries(next);
    notifyActiveChange(next);
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <CircularProgress size={18} />
      </div>
    );
  }

  if (injuries.length === 0) return null;

  return (
    <div className={styles.panel}>
      <Typography variant="subtitle2" className={styles.title}>
        Historial de lesiones
      </Typography>
      <div className={styles.list}>
        {injuries.map((inj) => {
          const isActive = !inj.endDate;
          return (
            <div
              key={inj.id}
              className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
            >
              <div className={styles.rowMain}>
                <div className={styles.rowHeader}>
                  <span className={styles.injuryType}>{inj.injuryType}</span>
                  {isActive ? (
                    <Chip label="Activa" color="error" size="small" />
                  ) : (
                    <Chip label="Alta" color="success" size="small" variant="outlined" />
                  )}
                </div>
                <div className={styles.rowMeta}>
                  <span>Inicio: {new Date(inj.startDate).toLocaleDateString("es-ES")}</span>
                  {inj.endDate && (
                    <span>Alta: {new Date(inj.endDate).toLocaleDateString("es-ES")}</span>
                  )}
                  {inj.estimatedRecovery && (
                    <span>Rec. estimado: {inj.estimatedRecovery}</span>
                  )}
                </div>
                {inj.description && (
                  <div className={styles.rowDescription}>{inj.description}</div>
                )}
              </div>
              <div className={styles.rowActions}>
                {isActive && (
                  <Tooltip title="Dar de alta">
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => handleDischarge(inj)}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => handleEdit(inj)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(inj)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      <InjuryDialog
        open={dialogOpen}
        current={editTarget}
        saving={saving}
        onClose={() => {
          setDialogOpen(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
