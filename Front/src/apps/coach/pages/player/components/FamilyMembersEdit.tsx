import React, { useState } from "react";
import {
  Alert,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import BadgeIcon from "@mui/icons-material/Badge";
import styles from "../PlayerDetail.module.css";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { mapApiErrorToMessage } from "../../../../../shared/utils/errorMessages";
import {
  createFamilyMember,
  deleteFamilyMember,
  type FamilyResponse,
} from "../../../services/teamplayerService";

type Props = {
  teamPlayerId: string;
  familyMembers: FamilyResponse[];
  onFamilyMembersChange: (next: FamilyResponse[]) => void;
};

const FAMILY_MEMBER_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: "Madre" },
  { id: 2, label: "Padre" },
  { id: 3, label: "Tutor legal" },
  { id: 4, label: "Otro" },
];

const FAMILY_MEMBER_LABEL: Record<string, string> = {
  Mother: "Madre",
  Father: "Padre",
  LegalGuardian: "Tutor legal",
  Other: "Otro",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = {
  name: string;
  lastName: string;
  familyMemberId: number | null;
  phone: string;
  email: string;
  dni: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  lastName: "",
  familyMemberId: null,
  phone: "",
  email: "",
  dni: "",
};

type DraftErrors = Partial<Record<keyof Draft, string>>;

function fullName(member: FamilyResponse) {
  const parts = [member.name, member.lastName].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(" ") : "Sin nombre";
}

function initials(member: FamilyResponse) {
  const trimmed = fullName(member) === "Sin nombre" ? "" : fullName(member);
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function FamilyMembersEdit({ teamPlayerId, familyMembers, onFamilyMembersChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteCandidate, setDeleteCandidate] = useState<FamilyResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAddForm = () => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSaveError(null);
    setAdding(true);
  };

  const closeAddForm = () => {
    setAdding(false);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSaveError(null);
  };

  const validate = (candidate: Draft): DraftErrors => {
    const next: DraftErrors = {};
    if (!candidate.name.trim()) next.name = "El nombre es obligatorio.";
    if (!candidate.lastName.trim()) next.lastName = "Los apellidos son obligatorios.";
    if (!candidate.familyMemberId) next.familyMemberId = "El parentesco es obligatorio.";
    if (candidate.email.trim() && !EMAIL_REGEX.test(candidate.email.trim())) {
      next.email = "El email no tiene un formato válido.";
    }
    return next;
  };

  const handleSubmit = async () => {
    const validationErrors = validate(draft);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const created = await createFamilyMember(teamPlayerId, {
        name: draft.name.trim(),
        lastName: draft.lastName.trim(),
        familyMemberId: draft.familyMemberId as number,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        dni: draft.dni.trim() || null,
      });
      onFamilyMembersChange([...familyMembers, created]);
      closeAddForm();
    } catch (e) {
      setSaveError(mapApiErrorToMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFamilyMember(teamPlayerId, deleteCandidate.id);
      onFamilyMembersChange(familyMembers.filter((m) => m.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (e) {
      setDeleteError(mapApiErrorToMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteCandidate(null);
    setDeleteError(null);
  };

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Familiares</h3>
        {familyMembers.map((member) => (
          <div key={member.id} className={styles.memberCard}>
            <div className={styles.memberHeader}>
              <div className={styles.memberAvatar}>{initials(member)}</div>
              <div className={styles.memberName}>{fullName(member)}</div>
              {member.familyMember && (
                <div className={styles.memberRoleBadge}>
                  {FAMILY_MEMBER_LABEL[member.familyMember] ?? member.familyMember}
                </div>
              )}
              <IconButton
                aria-label={`Eliminar familiar ${fullName(member)}`}
                size="small"
                onClick={() => {
                  setDeleteCandidate(member);
                  setDeleteError(null);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </div>
            <div className={styles.memberMetaRow}>
              {member.phone && (
                <span className={styles.memberMetaItem}>
                  <PhoneIcon fontSize="inherit" /> {member.phone}
                </span>
              )}
              {member.email && (
                <span className={styles.memberMetaItem}>
                  <EmailIcon fontSize="inherit" /> {member.email}
                </span>
              )}
              {member.dni && (
                <span className={styles.memberMetaItem}>
                  <BadgeIcon fontSize="inherit" /> {member.dni}
                </span>
              )}
            </div>
          </div>
        ))}

        {adding && (
          <div className={styles.memberCard}>
            <div className={styles.memberFormGrid}>
              <TextField
                label="Nombre"
                size="small"
                fullWidth
                className={styles.fullSpan}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                label="Apellidos"
                size="small"
                fullWidth
                className={styles.fullSpan}
                value={draft.lastName}
                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                error={Boolean(errors.lastName)}
                helperText={errors.lastName}
              />
              <FormControl fullWidth size="small" error={Boolean(errors.familyMemberId)}>
                <InputLabel id="new-family-member-label">Parentesco</InputLabel>
                <Select
                  labelId="new-family-member-label"
                  label="Parentesco"
                  value={draft.familyMemberId ?? ""}
                  size="small"
                  onChange={(e: SelectChangeEvent<number | "">) => {
                    const id = Number(e.target.value);
                    setDraft({ ...draft, familyMemberId: isNaN(id) ? null : id });
                  }}
                >
                  {FAMILY_MEMBER_OPTIONS.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.familyMemberId && (
                  <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>
                    {errors.familyMemberId}
                  </Alert>
                )}
              </FormControl>
              <TextField
                label="Teléfono"
                size="small"
                fullWidth
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
              <TextField
                label="Email"
                size="small"
                fullWidth
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                error={Boolean(errors.email)}
                helperText={errors.email}
              />
              <TextField
                label="DNI"
                size="small"
                fullWidth
                value={draft.dni}
                onChange={(e) => setDraft({ ...draft, dni: e.target.value })}
              />
            </div>
            {saveError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {saveError}
              </Alert>
            )}
            <div className={styles.memberFormActions}>
              <Button onClick={closeAddForm} size="small" disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} variant="contained" size="small" disabled={saving}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        {!adding && (
          <Button
            onClick={openAddForm}
            variant="outlined"
            size="small"
            sx={{ marginTop: familyMembers.length > 0 ? "12px" : 0 }}
          >
            Añadir familiar
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="¿Eliminar familiar?"
        description={
          <>
            {deleteCandidate && (
              <span>
                ¿Seguro que quieres eliminar a {fullName(deleteCandidate)}? Esta acción no se puede
                deshacer.
              </span>
            )}
            {deleteError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {deleteError}
              </Alert>
            )}
          </>
        }
        confirmText="Eliminar"
        processing={deleting}
        onCancel={cancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
