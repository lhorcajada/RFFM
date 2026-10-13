import type { PlayerResponse } from "../../../../services/teamplayerService";
import {
  DEFENDER_CATEGORY,
  FORWARD_CATEGORY,
  GOALKEEPER_CATEGORY,
  MIDFIELDER_CATEGORY,
  positionCategory,
} from "../positionCategory";
import type { CharacteristicDef } from "../ratingConcepts";
import type { SheetDraft } from "../ratingSheet";
import styles from "./RatingSheetBoard.module.css";

type Props = {
  characteristic: CharacteristicDef;
  players: PlayerResponse[];
  draft: SheetDraft;
  selectedIds: ReadonlySet<string>;
  readOnly: boolean;
  onTogglePlayer: (playerId: string) => void;
  /** `null` devuelve a los jugadores seleccionados a «Sin colocar». */
  onPlace: (level: number | null) => void;
};

const LINE_CLASS: Record<number, string> = {
  [GOALKEEPER_CATEGORY]: styles.chipGoalkeeper,
  [DEFENDER_CATEGORY]: styles.chipDefender,
  [MIDFIELDER_CATEGORY]: styles.chipMidfielder,
  [FORWARD_CATEGORY]: styles.chipForward,
};

export function playerDisplayName(player: PlayerResponse): string {
  return player.alias?.trim() || `${player.name ?? ""} ${player.lastName ?? ""}`.trim() || "Jugador";
}

function byLineAndName(a: PlayerResponse, b: PlayerResponse): number {
  const lineDiff = positionCategory(a.position) - positionCategory(b.position);
  return lineDiff !== 0 ? lineDiff : playerDisplayName(a).localeCompare(playerDisplayName(b), "es");
}

export default function RatingSheetBoard({
  characteristic,
  players,
  draft,
  selectedIds,
  readOnly,
  onTogglePlayer,
  onPlace,
}: Props) {
  const hasSelection = selectedIds.size > 0;
  const sortedPlayers = [...players].sort(byLineAndName);
  const playersAt = (level: number | null) =>
    sortedPlayers.filter((player) => (draft[player.id]?.[characteristic.key] ?? null) === level);

  function renderChips(level: number | null) {
    const levelPlayers = playersAt(level);
    if (levelPlayers.length === 0) return null;
    return (
      <div className={styles.chips}>
        {levelPlayers.map((player) => {
          const isSelected = selectedIds.has(player.id);
          const lineClass = LINE_CLASS[positionCategory(player.position)] ?? "";
          return (
            <button
              key={player.id}
              type="button"
              className={`${styles.chip} ${lineClass} ${isSelected ? styles.chipSelected : ""}`}
              aria-pressed={isSelected}
              disabled={readOnly}
              onClick={() => onTogglePlayer(player.id)}
            >
              <span className={styles.chipName}>{playerDisplayName(player)}</span>
              {player.dorsal != null && <span className={styles.chipDorsal}>#{player.dorsal}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const targetClass = `${styles.target} ${hasSelection ? styles.targetArmed : ""}`;

  return (
    <div className={styles.board}>
      <div role="group" aria-label="Sin colocar" className={`${styles.level} ${styles.unplaced}`}>
        <button type="button" className={targetClass} disabled={readOnly} onClick={() => onPlace(null)}>
          <span className={styles.unplacedTitle}>Sin colocar</span>
        </button>
        {renderChips(null)}
      </div>

      {characteristic.levels.map((conceptLevel, idx) => {
        const level = idx + 1;
        return (
          <div key={level} role="group" aria-label={`Nivel ${level}`} className={styles.level}>
            <button type="button" className={targetClass} disabled={readOnly} onClick={() => onPlace(level)}>
              <span className={styles.levelNumber}>{level}</span>
              <span className={styles.levelConcept}>{conceptLevel.concept}</span>
            </button>
            {renderChips(level)}
          </div>
        );
      })}
    </div>
  );
}
