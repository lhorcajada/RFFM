import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import type { PlayerProposal } from "../utils/deconvokeProposal";
import { playerDataChips, playerDataRows } from "../utils/proposalPlayerData";
import { roleLabel } from "../utils/positionRequirements";
import type { FitContext } from "./DeconvocationProposalView";
import PlayerFitDialog from "./PlayerFitDialog";
import styles from "./PlayerProposalDataDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** What the deconvocation proposal computed for the player. */
  item: PlayerProposal;
  /** Fit orders and trait ratings; without them the fit cannot be explained. */
  fitContext?: FitContext;
};

/** The figures the deconvocation proposal is based on for one player, never the decision taken about him. */
export default function PlayerProposalDataDialog({ open, onClose, item, fitContext }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [fitOpen, setFitOpen] = useState(false);
  const rows = playerDataRows(item);
  const fitPosition = fitContext?.positionFit.find((p) => p.position === item.fit?.position);
  const fitLevels = fitContext?.traitRatings.find((r) => r.teamPlayerId === item.playerId)?.levels ?? [];

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="player-data-title">
        <DialogTitle id="player-data-title">Datos de {item.displayName}</DialogTitle>
        <DialogContent dividers className={styles.content}>
          <p className={styles.role}>{roleLabel(item.positionRole ?? null)}</p>
          <ul className={styles.chips} aria-label="Resumen">
            {playerDataChips(item).map((chip) => (
              <li key={chip} className={styles.chip}>
                {chip}
              </li>
            ))}
          </ul>
          {rows.length === 0 ? (
            <p className={styles.empty}>No hay más datos de este jugador.</p>
          ) : (
            <dl className={styles.rows}>
              {rows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <dt className={styles.rowLabel}>{row.label}</dt>
                  <dd className={styles.rowValue}>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
        <DialogActions>
          {fitContext && item.fit && (
            <Button size="small" onClick={() => setFitOpen(true)} aria-label={`Ver encaje de ${item.displayName}`}>
              Ver encaje
            </Button>
          )}
          <Button size="small" onClick={onClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
      {fitOpen && (
        <PlayerFitDialog
          open
          onClose={() => setFitOpen(false)}
          playerId={item.playerId}
          playerName={item.displayName}
          fit={item.fit}
          positionFit={fitPosition}
          levels={fitLevels}
        />
      )}
    </>
  );
}
