import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KitSelector from "./KitSelector/KitSelector";
import ClubKitEditor from "./KitSelector/ClubKitEditor";
import TeamNotesEditor from "./TeamNotesEditor";
import Jersey from "../../../../federation/components/players/Jersey/Jersey";
import type { ClubKit } from "../../../services/kitService";
import type { MatchState } from "./convocationMatchDetail.types";
import styles from "../ConvocationMatchDetail.module.css";

type Props = {
  match: MatchState | null;
  teamId: string;
  kits: ClubKit[];
  selectedKitNumber: number | null;
  onSelectKit: (kitNumber: number | null) => void;
  onKitsSaved: (kits: ClubKit[]) => void;
  disabled: boolean;
};

export default function ConvocationMatchHeader({
  match,
  teamId,
  kits,
  selectedKitNumber,
  onSelectKit,
  onKitsSaved,
  disabled,
}: Props) {
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  if (!match) return <span>Convocatoria</span>;

  const selectedKit = kits.find((k) => k.kitNumber === selectedKitNumber);

  const handleKitsSaved = (savedKits: ClubKit[]) => {
    onKitsSaved(savedKits);
    setKitDialogOpen(false);
  };

  return (
    <div className={styles.titleWrap}>
      <span className={styles.convocationLabel}>Convocatoria</span>

      <div className={styles.matchInfoRow}>
        <div className={styles.matchTeamBlock}>
          {match.localTeamShield && (
            <img
              src={match.localTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className={styles.matchTeamName}>{match.localTeamName}</span>
        </div>
        <span className={styles.matchTime}>{match.time || "--:--"}</span>
        <div className={`${styles.matchTeamBlock} ${styles.matchTeamBlockVisitor}`}>
          <span className={styles.matchTeamName}>{match.visitorTeamName}</span>
          {match.visitorTeamShield && (
            <img
              src={match.visitorTeamShield}
              alt=""
              className={styles.matchShield}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.matchMeta}>
        <span className={styles.matchDateLabel}>{match.date}</span>
        {match.field && (
          <>
            <span className={styles.matchMetaSep}>·</span>
            <span className={styles.matchField}>{match.field}</span>
          </>
        )}
      </div>

      <div className={styles.headerActionsRow}>
        {selectedKit && (
          <div className={styles.kitSummary}>
            <Jersey primary={selectedKit.shirtColor} size={24} />
            <span className={styles.kitSummaryLabel}>
              {selectedKit.kitNumber === 1 ? "1ª equipación" : "2ª equipación"}
            </span>
          </div>
        )}

        <button
          type="button"
          className={styles.kitPanelToggle}
          onClick={() => setKitDialogOpen(true)}
        >
          {selectedKit ? "Cambiar equipación" : "Configurar equipación"}
        </button>

        <button
          type="button"
          className={styles.kitPanelToggle}
          onClick={() => setNotesDialogOpen(true)}
        >
          Notas
        </button>
      </div>

      <Dialog open={kitDialogOpen} onClose={() => setKitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Equipación
          <IconButton
            aria-label="Cerrar"
            onClick={() => setKitDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers className={styles.kitPanel}>
          {kits.length > 0 ? (
            <>
              <KitSelector
                kits={kits}
                selectedKitNumber={selectedKitNumber}
                onSelect={onSelectKit}
                disabled={disabled}
              />
              {teamId && (
                <ClubKitEditor teamId={teamId} onSaved={handleKitsSaved} initialKits={kits} />
              )}
            </>
          ) : (
            teamId && <ClubKitEditor teamId={teamId} onSaved={handleKitsSaved} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Notas del equipo
          <IconButton
            aria-label="Cerrar"
            onClick={() => setNotesDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>{teamId && <TeamNotesEditor teamId={teamId} />}</DialogContent>
      </Dialog>
    </div>
  );
}
