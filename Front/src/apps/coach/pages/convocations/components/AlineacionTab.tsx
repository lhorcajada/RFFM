import type { RefObject } from "react";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import IdealLineup, {
  type IdealLineupHandle,
  type SquadPlayer,
} from "../../squad/components/IdealLineup";
import styles from "./AlineacionTab.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  mgmtEventId: string | null;
  mgmtCalled: string[];
  lineupPlayers: SquadPlayer[];
  lineupRef: RefObject<IdealLineupHandle | null>;
  teamId: string;
  onSavingChange: (saving: boolean) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlineacionTab({
  mgmtEventId,
  mgmtCalled,
  lineupPlayers,
  lineupRef,
  teamId,
  onSavingChange,
}: Props) {
  if (!mgmtEventId) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState description="No se encontró el partido en el sistema interno." />
        </div>
      </div>
    );
  }

  if (mgmtCalled.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState description="Aún no hay jugadores convocados. Convoca jugadores primero en la pestaña 'Convocatoria'." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <IdealLineup
        ref={lineupRef}
        players={lineupPlayers}
        teamId={teamId}
        seasonId={mgmtEventId}
        panelTitle="Banquillo"
        hideInternalSave
        onSavingChange={onSavingChange}
      />
    </div>
  );
}
