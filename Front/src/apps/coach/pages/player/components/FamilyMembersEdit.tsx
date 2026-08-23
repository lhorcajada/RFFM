import React from "react";
import { Button, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import styles from "../PlayerDetail.module.css";

const MAX_FAMILY_MEMBERS = 2;

export type FamilyMemberFormValue = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  familyMemberId?: number | null;
  familyMember?: string | null;
  dni?: string | null;
};

type Props = {
  form: { familyMembers?: FamilyMemberFormValue[] };
  setForm: (f: any) => void;
};

const FAMILY_MEMBER_ID_TO_NAME: Record<number, string> = {
  1: "Mother",
  2: "Father",
};

function initials(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function FamilyMembersEdit({ form, setForm }: Props) {
  const members = form.familyMembers ?? [];

  const updateMember = (index: number, patch: Partial<FamilyMemberFormValue>) => {
    const next = members.map((member, i) => (i === index ? { ...member, ...patch } : member));
    setForm({ ...form, familyMembers: next });
  };

  const addMember = () => {
    setForm({
      ...form,
      familyMembers: [
        ...members,
        { name: "", phone: "", email: "", familyMemberId: null, familyMember: null, dni: "" },
      ],
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Familiares</h3>
        {members.map((member, index) => (
          <div key={index} className={styles.memberCard}>
            <div className={styles.memberHeader}>
              <div className={styles.memberAvatar}>{initials(member.name)}</div>
              <div className={styles.memberName}>{member.name || `Familiar ${index + 1}`}</div>
            </div>
            <div className={styles.memberFormGrid}>
              <TextField
                label="Nombre"
                size="small"
                fullWidth
                className={styles.fullSpan}
                value={member.name ?? ""}
                onChange={(e) => updateMember(index, { name: e.target.value })}
              />
              <TextField
                label="Teléfono"
                size="small"
                fullWidth
                value={member.phone ?? ""}
                onChange={(e) => updateMember(index, { phone: e.target.value })}
              />
              <TextField
                label="Email"
                size="small"
                fullWidth
                value={member.email ?? ""}
                onChange={(e) => updateMember(index, { email: e.target.value })}
              />
              <FormControl fullWidth size="small">
                <InputLabel id={`family-member-label-${index}`}>Parentesco</InputLabel>
                <Select
                  labelId={`family-member-label-${index}`}
                  label="Parentesco"
                  value={member.familyMemberId ?? ""}
                  size="small"
                  onChange={(e) => {
                    const id = Number((e.target as HTMLSelectElement).value);
                    updateMember(index, {
                      familyMemberId: isNaN(id) ? null : id,
                      familyMember: isNaN(id) ? "" : FAMILY_MEMBER_ID_TO_NAME[id],
                    });
                  }}
                >
                  <MenuItem value={1}>Madre</MenuItem>
                  <MenuItem value={2}>Padre</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="DNI"
                size="small"
                fullWidth
                value={member.dni ?? ""}
                onChange={(e) => updateMember(index, { dni: e.target.value })}
              />
            </div>
          </div>
        ))}
        {members.length < MAX_FAMILY_MEMBERS && (
          <Button
            onClick={addMember}
            variant="outlined"
            size="small"
            sx={{ marginTop: members.length > 0 ? "12px" : 0 }}
          >
            Añadir familiar
          </Button>
        )}
      </div>
    </div>
  );
}
