import { Button, IconButton, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import SelectableChip from "../../../../../shared/components/ui/SelectableChip/SelectableChip";
import styles from "../SeasonAccess.module.css";
import type { SeasonAccessPlayer } from "./PlayerCromo";
import type { SeasonAccessDemarcation } from "../../../services/seasonAccessService";

type Props = {
  players: SeasonAccessPlayer[];
  demarcations: SeasonAccessDemarcation[];
  onRemovePlayer: (playerId: string) => void;
  onBirthYearChange: (playerId: string, birthYear: number | null) => void;
  onBirthYearCommit: (playerId: string) => void;
  onTogglePossibleDemarcation: (playerId: string, demarcationId: number) => void;
  onSetIdealDemarcation: (playerId: string, demarcationId: number | null) => void;
};

export default function SelectedPlayersPanel({
  players,
  demarcations,
  onRemovePlayer,
  onBirthYearChange,
  onBirthYearCommit,
  onTogglePossibleDemarcation,
  onSetIdealDemarcation,
}: Props) {
  return (
    <aside className={styles.selectedPanel} aria-label="Jugadores seleccionados">
      <div className={styles.selectedPanelHeader}>
        <div className={styles.selectedPanelTitleWrap}>
          <Typography variant="subtitle2" className={`${styles.groupTitle} ${styles.selectedPanelTitle}`}>
            Jugadores seleccionados
          </Typography>
          <span className={styles.groupCount}>{players.length}</span>
        </div>
      </div>

      {players.length > 0 ? (
        <div className={styles.selectedList}>
          {players.map((player) => (
            <article key={player.id} className={styles.selectedPlayerRow} title={player.displayName}>
              <div className={styles.selectedPlayerTopRow}>
                <div className={styles.selectedPlayerHeading}>
                  <div className={styles.selectedPlayerName}>{player.displayName}</div>
                  <div className={styles.selectedPlayerMeta}>
                    {player.teamName}
                    {player.totalGoals != null ? ` · ${player.totalGoals} goles` : ""}
                  </div>
                  <div className={styles.selectedPlayerCategory}>{player.category}</div>
                </div>

                <IconButton
                  size="small"
                  onClick={() => onRemovePlayer(player.id)}
                  className={styles.selectedPlayerRemoveButton}
                  aria-label={`Quitar a ${player.displayName}`}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              <TextField
                label="Año de nacimiento"
                type="number"
                size="small"
                value={player.birthYear ?? ""}
                onChange={(event) => {
                  const rawValue = event.target.value;
                  onBirthYearChange(player.id, rawValue === "" ? null : Number(rawValue));
                }}
                onBlur={() => onBirthYearCommit(player.id)}
                inputProps={{ min: 1900, max: new Date().getFullYear() }}
                className={styles.selectedPlayerBirthYear}
              />

              <div className={styles.selectedPlayerSection}>
                <Typography variant="caption" className={styles.selectedPlayerSectionLabel}>
                  Demarcaciones posibles
                </Typography>
                <div className={styles.selectedPlayerChipRow}>
                  {demarcations.map((demarcation) => (
                    <SelectableChip
                      key={`possible-${player.id}-${demarcation.id}`}
                      label={demarcation.code}
                      selected={(player.possibleDemarcationIds ?? []).includes(demarcation.id)}
                      onSelect={() => onTogglePossibleDemarcation(player.id, demarcation.id)}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.selectedPlayerSection}>
                <Typography variant="caption" className={styles.selectedPlayerSectionLabel}>
                  Demarcación ideal
                </Typography>
                <div className={styles.selectedPlayerChipRow}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onSetIdealDemarcation(player.id, null)}
                    className={styles.selectedPlayerClearIdealButton}
                  >
                    Sin ideal
                  </Button>

                  {demarcations.map((demarcation) => (
                    <SelectableChip
                      key={`ideal-${player.id}-${demarcation.id}`}
                      label={demarcation.code}
                      selected={player.idealDemarcationId === demarcation.id}
                      onSelect={() => onSetIdealDemarcation(player.id, demarcation.id)}
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.selectedEmptyState}>
          Pulsa sobre los cromos para ir añadiendo jugadores a esta lista.
        </div>
      )}
    </aside>
  );
}