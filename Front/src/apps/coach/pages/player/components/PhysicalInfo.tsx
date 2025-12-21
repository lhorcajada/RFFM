import React from "react";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";

type Props = { teamPlayer: TeamPlayerResponse };

export default function PhysicalInfo({ teamPlayer }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Datos físicos</h3>
        <div className={styles.row}>
          <div className={styles.label}>Altura</div>
          <div className={styles.value}>
            {teamPlayer.physicalInfo?.height ?? "-"}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Peso</div>
          <div className={styles.value}>
            {teamPlayer.physicalInfo?.weight ?? "-"}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Pie dominante</div>
          <div className={styles.value}>
            {teamPlayer.physicalInfo?.dominantFoot ?? "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
