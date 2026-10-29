import React from "react";
import { Link } from "react-router-dom";
import { IconButton, Tooltip } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { TeamResponse } from "../../../services/teamService";
import styles from "./ClubTeamCard.module.css";

type ClubTeamCardProps = {
  team: TeamResponse;
  photoUrl: string | null;
  to: string;
  onCopyCode: (code: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
};

export default function ClubTeamCard({
  team,
  photoUrl,
  to,
  onCopyCode,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: ClubTeamCardProps) {
  const leagueName = team.league?.name?.trim() || "Sin liga";
  const categoryName = team.category?.name?.trim() || "Sin categoría";

  return (
    <div className={styles.card}>
      <Link to={to} className={styles.main}>
        <div className={styles.photo}>
          {photoUrl ? (
            <img src={photoUrl} alt={team.name} className={styles.photoImg} />
          ) : (
            <GroupsIcon fontSize="large" />
          )}
        </div>
        <div className={styles.texts}>
          <span className={styles.name}>{team.name}</span>
          <span className={styles.meta}>{`${leagueName} · ${categoryName}`}</span>
        </div>
      </Link>

      <div className={styles.footer}>
        {team.joinCode && (
          <div className={styles.code}>
            <span className={styles.codeLabel}>CÓDIGO</span>
            <strong className={styles.codeValue}>{team.joinCode}</strong>
            <Tooltip title="Copiar código">
              <IconButton
                className={styles.iconBtn}
                onClick={() => onCopyCode(team.joinCode!)}
                aria-label="Copiar código de equipo"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        )}
        <div className={styles.actions}>
          <Tooltip title="Editar equipo">
            <IconButton className={styles.iconBtn} onClick={onEdit} aria-label="Editar equipo">
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar equipo">
            <span>
              <IconButton
                className={styles.deleteBtn}
                disabled={deleteDisabled}
                onClick={onDelete}
                aria-label="Eliminar equipo"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
