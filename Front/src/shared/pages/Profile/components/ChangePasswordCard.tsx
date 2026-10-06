import React, { useState } from "react";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { changePassword } from "../../../services/profile/profileService";
import { mapApiErrorToMessage } from "../../../utils/errorMessages";
import { notify } from "../notify";
import styles from "./ProfileCard.module.css";

const emptyForm = { currentPassword: "", newPassword: "", repeatPassword: "" };

export default function ChangePasswordCard() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const mismatch = form.repeatPassword.length > 0 && form.newPassword !== form.repeatPassword;
  const canSubmit =
    form.currentPassword.length > 0 &&
    form.newPassword.length > 0 &&
    form.newPassword === form.repeatPassword &&
    !saving;

  const handleChange = (field: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(emptyForm);
      notify("Contraseña cambiada.", "success");
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={styles.card}>
      <Typography variant="h6" component="h2">
        Contraseña
      </Typography>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={handleChange("currentPassword")}
          fullWidth
          size="small"
        />
        <TextField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={handleChange("newPassword")}
          fullWidth
          size="small"
        />
        <TextField
          label="Repetir nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={form.repeatPassword}
          onChange={handleChange("repeatPassword")}
          error={mismatch}
          helperText={mismatch ? "Las contraseñas no coinciden" : undefined}
          fullWidth
          size="small"
        />
        <div className={styles.actions}>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Paper>
  );
}
