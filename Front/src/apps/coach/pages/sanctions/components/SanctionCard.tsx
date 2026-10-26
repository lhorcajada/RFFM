import { Button, Chip, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import EuroIcon from "@mui/icons-material/Euro";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import type { SanctionRecord } from "../../../services/teamplayerSanctionService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import defaultAvatar from "../../../../../assets/avatar.svg";
import styles from "./SanctionCard.module.css";

export type SanctionCardProps = {
  player: PlayerResponse;
  sanction: SanctionRecord;
  status: "Pending" | "Fulfilled";
  pendingAmount: number | null;
  showPlayerName: boolean;
  canManage: boolean;
  canDelete: boolean;
  /** Resolved object URL for the player's photo (see `playerService.fetchPlayerPhoto`),
   * `null`/`undefined` falls back to the default avatar. */
  photoSrc?: string | null;
  /** Visually highlighted when this sanction is the target of a notification deep-link. */
  highlighted?: boolean;
  /** Visually stands out as a pending sanction in the mixed (all statuses) listing. */
  emphasizePending?: boolean;
  onEdit: () => void;
  onLift: () => void;
  onDelete: () => void;
};

export default function SanctionCard({
  player,
  sanction,
  status,
  pendingAmount,
  showPlayerName,
  canManage,
  canDelete,
  photoSrc,
  highlighted,
  emphasizePending,
  onEdit,
  onLift,
  onDelete,
}: SanctionCardProps) {
  const isPending = status === "Pending";
  const isEconomic = sanction.fine != null;
  const isSportive = !!sanction.sportivePunishmentType;
  const playerName =
    ((player.name ?? "") + " " + (player.lastName ?? "")).trim() || player.alias;
  const photo = photoSrc ?? defaultAvatar;
  const paidPercent =
    sanction.fine && sanction.fine > 0
      ? Math.min(Math.round(((sanction.amountPaid ?? 0) / sanction.fine) * 100), 100)
      : 0;

  return (
    <Paper
      className={`${styles.card} ${emphasizePending ? styles.pendingEmphasis : ""} ${highlighted ? styles.highlighted : ""}`}
      variant="outlined"
      id={`sanction-${sanction.id}`}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <img src={photo} alt={playerName} className={styles.playerAvatar} />
            <div>
            {showPlayerName && (
              <Typography variant="subtitle2" className={styles.playerName}>
                {playerName}
                {player.alias && (
                  <span className={styles.playerMeta}>
                    {" "}
                    {player.alias}
                    {player.dorsal != null ? ` · #${player.dorsal}` : ""}
                  </span>
                )}
              </Typography>
            )}
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" className={styles.typeRow}>
              {isEconomic && (
                <Tooltip title="Sanción económica">
                  <EuroIcon fontSize="small" color="warning" />
                </Tooltip>
              )}
              {isSportive && (
                <Tooltip title="Sanción deportiva">
                  <SportsSoccerIcon fontSize="small" color="error" />
                </Tooltip>
              )}
              <Typography variant="body2">{sanction.sanctionType}</Typography>
              {sanction.isAutomatic && (
                <Chip label="Automática" size="small" color="warning" variant="outlined" />
              )}
              {sanction.sportivePunishmentType === "Deconvocation" && (
                <Chip label="Desconvocatoria" size="small" color="error" variant="outlined" />
              )}
              {sanction.sportivePunishmentType === "MinutesLimit" && (
                <Chip
                  label={`Máx. ${sanction.minutesLimit ?? "?"}'`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
            </Stack>
            </div>
          </Stack>
          {isPending ? (
            <Chip label="Pendiente" color="error" size="small" />
          ) : (
            <Chip label="Cumplida" color="success" size="small" variant="outlined" />
          )}
        </Stack>

        {sanction.description && (
          <Typography variant="body2" color="text.secondary">
            {sanction.description}
          </Typography>
        )}

        <Stack direction="row" spacing={2} flexWrap="wrap" className={styles.metaRow}>
          <span>
            <span className={styles.fieldLabel}>Inicio</span>{" "}
            {new Date(sanction.startDate).toLocaleDateString("es-ES")}
          </span>
          <span>
            <span className={styles.fieldLabel}>Fin</span>{" "}
            {sanction.endDate ? new Date(sanction.endDate).toLocaleDateString("es-ES") : "—"}
          </span>
          {sanction.estimatedEnd && (
            <span>
              <span className={styles.fieldLabel}>Fin estimado</span> {sanction.estimatedEnd}
            </span>
          )}
        </Stack>

        {isEconomic && (
          <div className={styles.moneyBlock}>
            <Stack direction="row" justifyContent="space-between" className={styles.metaRow}>
              <span>
                <span className={styles.fieldLabel}>Multa</span> {sanction.fine} €
              </span>
              <span>
                <span className={styles.fieldLabel}>Pagado</span>{" "}
                {sanction.amountPaid != null ? `${sanction.amountPaid} €` : "—"}
              </span>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={paidPercent}
              color="success"
              aria-label="Porcentaje pagado"
              className={styles.progress}
            />
            <Typography variant="body2" className={pendingAmount ? styles.pendingAmount : styles.settled}>
              {pendingAmount ? `Pendiente ${pendingAmount} €` : "Multa abonada"}
            </Typography>
          </div>
        )}

        {canManage && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap className={styles.actions}>
            {isPending && (
              <Button variant="outlined" color="success" onClick={onLift} className={styles.actionButton}>
                Levantar sanción
              </Button>
            )}
            <Button variant="outlined" color="inherit" onClick={onEdit} className={styles.actionButton}>
              Editar
            </Button>
            <Tooltip title={canDelete ? "" : "No se puede eliminar una sanción ya cumplida"}>
              <span className={styles.deleteSlot}>
                <Button color="error" disabled={!canDelete} onClick={onDelete} className={styles.actionButton}>
                  Eliminar
                </Button>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
