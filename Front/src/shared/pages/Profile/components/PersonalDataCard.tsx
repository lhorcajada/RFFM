import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  updatePersonalData,
  type MyAccount,
} from "../../../services/profile/profileService";
import { mapApiErrorToMessage } from "../../../utils/errorMessages";
import { notify } from "../notify";
import styles from "./ProfileCard.module.css";

type Props = {
  account: MyAccount;
  onSaved: (account: MyAccount) => void;
};

type FormState = {
  firstName: string;
  lastName: string;
  secondLastName: string;
  phoneNumber: string;
};

function toForm(account: MyAccount): FormState {
  return {
    firstName: account.firstName ?? "",
    lastName: account.lastName ?? "",
    secondLastName: account.secondLastName ?? "",
    phoneNumber: account.phoneNumber ?? "",
  };
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function PersonalDataCard({ account, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(account));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(account));
  }, [account]);

  const initial = toForm(account);
  const hasChanges = (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== initial[key]);
  const requiredFilled = form.firstName.trim().length > 0 && form.lastName.trim().length > 0;
  const hasPersonalData = !!account.firstName && !!account.lastName;

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await updatePersonalData({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        secondLastName: nullIfBlank(form.secondLastName),
        phoneNumber: nullIfBlank(form.phoneNumber),
      });
      notify("Datos personales guardados.", "success");
      onSaved(saved);
    } catch (error) {
      notify(mapApiErrorToMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={styles.card}>
      <Typography variant="h6" component="h2">
        Datos personales
      </Typography>
      {!hasPersonalData && <Alert severity="info">Completa tu nombre y apellido</Alert>}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField label="Alias" value={account.alias} disabled fullWidth size="small" />
        <TextField label="Email" value={account.email ?? ""} disabled fullWidth size="small" />
        <TextField
          label="Nombre"
          value={form.firstName}
          onChange={handleChange("firstName")}
          required
          fullWidth
          size="small"
          inputProps={{ maxLength: 50 }}
        />
        <TextField
          label="Primer apellido"
          value={form.lastName}
          onChange={handleChange("lastName")}
          required
          fullWidth
          size="small"
          inputProps={{ maxLength: 50 }}
        />
        <TextField
          label="Segundo apellido"
          value={form.secondLastName}
          onChange={handleChange("secondLastName")}
          fullWidth
          size="small"
          inputProps={{ maxLength: 50 }}
        />
        <TextField
          label="Teléfono"
          value={form.phoneNumber}
          onChange={handleChange("phoneNumber")}
          fullWidth
          size="small"
          type="tel"
          inputProps={{ maxLength: 20 }}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="contained" disabled={!requiredFilled || !hasChanges || saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Paper>
  );
}
