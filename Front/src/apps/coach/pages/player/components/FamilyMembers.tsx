import React from "react";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import BadgeIcon from "@mui/icons-material/Badge";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";

type Props = { teamPlayer: TeamPlayerResponse };

const FAMILY_MEMBER_LABEL: Record<string, string> = {
  Mother: "Madre",
  Father: "Padre",
};

function initials(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function FamilyMembers({ teamPlayer }: Props) {
  const members = teamPlayer.familyMembers ?? [];

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Familiares</h3>
        {members.length > 0 ? (
          members.map((f: any, i: number) => (
            <div key={i} className={styles.memberCard}>
              <div className={styles.memberHeader}>
                <div className={styles.memberAvatar}>{initials(f.name)}</div>
                <div className={styles.memberName}>{f.name ?? "Sin nombre"}</div>
                {f.familyMember && (
                  <div className={styles.memberRoleBadge}>
                    {FAMILY_MEMBER_LABEL[f.familyMember] ?? f.familyMember}
                  </div>
                )}
              </div>
              <div className={styles.memberMetaRow}>
                {f.phone && (
                  <span className={styles.memberMetaItem}>
                    <PhoneIcon fontSize="inherit" /> {f.phone}
                  </span>
                )}
                {f.email && (
                  <span className={styles.memberMetaItem}>
                    <EmailIcon fontSize="inherit" /> {f.email}
                  </span>
                )}
                {f.dni && (
                  <span className={styles.memberMetaItem}>
                    <BadgeIcon fontSize="inherit" /> {f.dni}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.memberEmptyCard}>No hay familiares registrados.</div>
        )}
      </div>
    </div>
  );
}
