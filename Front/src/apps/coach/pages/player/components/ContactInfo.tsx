import React from "react";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";

type Props = { teamPlayer: TeamPlayerResponse };

export default function ContactInfo({ teamPlayer }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Información de contacto</h3>
        <div className={styles.row}>
          <div className={styles.label}>Teléfono</div>
          <div className={styles.value}>
            {teamPlayer.contactInfo?.phone ?? "-"}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Email</div>
          <div className={styles.value}>
            {teamPlayer.contactInfo?.email ?? "-"}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Calle</div>
          <div className={styles.value}>
            {teamPlayer.contactInfo?.address?.street ?? "-"}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Ciudad / CP</div>
          <div className={styles.value}>
            {teamPlayer.contactInfo?.address?.city ?? "-"}{" "}
            {teamPlayer.contactInfo?.address?.postalCode ?? "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
