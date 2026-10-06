import React, { useRef, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ConfirmDialog from "../../../components/ui/ConfirmDialog/ConfirmDialog";
import {
  deleteAvatar,
  uploadAvatar,
  type MyAccount,
} from "../../../services/profile/profileService";
import { mapApiErrorToMessage } from "../../../utils/errorMessages";
import { notify } from "../notify";
import cardStyles from "./ProfileCard.module.css";
import styles from "./AvatarCard.module.css";

type Props = {
  account: MyAccount;
  onChanged: (avatarUrl: string | null) => void;
};

export default function AvatarCard({ account, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasPersonalData = !!account.firstName && !!account.lastName;
  const initials = hasPersonalData
    ? `${account.firstName!.charAt(0)}${account.lastName!.charAt(0)}`.toUpperCase()
    : account.alias.charAt(0).toUpperCase();

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(file);
      notify("Foto actualizada.", "success");
      onChanged(url);
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setBusy(true);
    try {
      await deleteAvatar();
      notify("Foto eliminada.", "success");
      onChanged(null);
      setConfirmOpen(false);
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper className={cardStyles.card}>
      <Typography variant="h6" component="h2">
        Foto
      </Typography>
      <div className={styles.body}>
        <Avatar src={account.avatarUrl ?? undefined} className={styles.avatar} alt={account.alias}>
          {!account.avatarUrl && initials}
        </Avatar>
        {!hasPersonalData && (
          <Typography variant="body2" color="text.secondary">
            Guarda primero tus datos personales
          </Typography>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Seleccionar foto"
          className={styles.hiddenInput}
          onChange={handleFileSelected}
          disabled={!hasPersonalData || busy}
        />
        <div className={cardStyles.actions}>
          {account.avatarUrl && (
            <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)} disabled={busy}>
              Quitar foto
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => inputRef.current?.click()}
            disabled={!hasPersonalData || busy}
          >
            Cambiar foto
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Quitar foto"
        description="¿Quieres quitar tu foto de perfil?"
        confirmText="Quitar"
        processing={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDeleteConfirmed}
      />
    </Paper>
  );
}
