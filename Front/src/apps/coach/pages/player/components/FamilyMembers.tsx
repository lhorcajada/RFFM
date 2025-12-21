import React from "react";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";

type Props = { teamPlayer: TeamPlayerResponse };

export default function FamilyMembers({ teamPlayer }: Props) {
  const members = teamPlayer.familyMembers ?? [];
  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Familiares</h3>
        {members.length > 0 ? (
          members.map((f: any, i: number) => (
            <div key={i} className={styles.memberWrap}>
              <div className={styles.row}>
                <div className={styles.label}>Nombre</div>
                <div className={styles.value}>{f.name ?? "-"}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>Parentesco</div>
                <div className={styles.value}>{f.familyMember ?? "-"}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>Teléfono</div>
                <div className={styles.value}>{f.phone ?? "-"}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>Email</div>
                <div className={styles.value}>{f.email ?? "-"}</div>
              </div>
            </div>
          ))
        ) : (
          <div>
            <div className={styles.row}>
              <div className={styles.label}>Nombre</div>
              <div className={styles.value}>-</div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Parentesco</div>
              <div className={styles.value}>-</div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Teléfono</div>
              <div className={styles.value}>-</div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Email</div>
              <div className={styles.value}>-</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
