import { Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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

  return (
    <Paper className={styles.card} variant="outlined">
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
          <Stack direction="row" spacing={2} flexWrap="wrap" className={styles.metaRow}>
            <span>
              <span className={styles.fieldLabel}>Multa</span> {sanction.fine} €
            </span>
            <span>
              <span className={styles.fieldLabel}>Pagado</span>{" "}
              {sanction.amountPaid != null ? `${sanction.amountPaid} €` : "—"}
            </span>
            <span>
              <span className={styles.fieldLabel}>Pendiente</span>{" "}
              {pendingAmount != null ? `${pendingAmount} €` : "—"}
            </span>
          </Stack>
        )}

        {canManage && (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Editar">
              <IconButton size="small" onClick={onEdit} aria-label="Editar">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {isPending && (
              <Tooltip title="Levantar sanción">
                <IconButton size="small" color="success" onClick={onLift} aria-label="Levantar sanción">
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={canDelete ? "Eliminar" : "No se puede eliminar una sanción ya cumplida"}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!canDelete}
                  onClick={onDelete}
                  aria-label="Eliminar"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
