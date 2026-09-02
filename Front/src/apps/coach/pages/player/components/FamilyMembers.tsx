import React from "react";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import BadgeIcon from "@mui/icons-material/Badge";
import styles from "../PlayerDetail.module.css";
import { FamilyResponse, TeamPlayerResponse } from "../../../services/teamplayerService";
import FamilyMemberAccountStatus from "./FamilyMemberAccountStatus";

type Props = {
  teamPlayer: TeamPlayerResponse;
  onFamilyMembersChange: (next: FamilyResponse[]) => void;
};

const FAMILY_MEMBER_LABEL: Record<string, string> = {
  Mother: "Madre",
  Father: "Padre",
  LegalGuardian: "Tutor legal",
  Other: "Otro",
};

function fullName(f: { name?: string | null; lastName?: string | null }) {
  const parts = [f.name, f.lastName].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(" ") : "Sin nombre";
}

function initials(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function FamilyMembers({ teamPlayer, onFamilyMembersChange }: Props) {
  const members = teamPlayer.familyMembers ?? [];
  const playerName = teamPlayer.player?.name ?? "";

  function handleStatusChange(familyMemberId: string, status: string) {
    onFamilyMembersChange(
      members.map((m) => (m.id === familyMemberId ? { ...m, registrationStatus: status } : m))
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Familiares</h3>
        {members.length > 0 ? (
          members.map((f, i) => (
            <div key={f.id ?? i} className={styles.memberCard}>
              <div className={styles.memberHeader}>
                <div className={styles.memberAvatar}>{initials([f.name, f.lastName].filter(Boolean).join(" "))}</div>
                <div className={styles.memberName}>{fullName(f)}</div>
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
              <FamilyMemberAccountStatus
                familyMember={f}
                playerName={playerName}
                onStatusChange={handleStatusChange}
              />
            </div>
          ))
        ) : (
          <div className={styles.memberEmptyCard}>No hay familiares registrados.</div>
        )}
      </div>
    </div>
  );
}
