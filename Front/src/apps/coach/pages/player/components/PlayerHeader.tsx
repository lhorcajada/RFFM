import React from "react";
import { Avatar, TextField } from "@mui/material";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";
import playerService from "../../../services/playerService";

type Props = {
  teamPlayer: TeamPlayerResponse;
  photo?: string | null;
  editing?: boolean;
  form?: any;
  setForm?: (f: any) => void;
  setPhoto?: (s: string | null) => void;
  onNotify?: (msg: string, severity: "success" | "error") => void;
};

export default function PlayerHeader({
  teamPlayer,
  photo,
  editing = false,
  form,
  setForm,
  setPhoto,
  onNotify,
}: Props) {
  const handleFile = async (f?: File) => {
    if (!f || !setPhoto || !setForm) return;
    try {
      const preview = URL.createObjectURL(f);
      try {
        if (photo) URL.revokeObjectURL(photo);
      } catch (e) {}
      setPhoto && setPhoto(preview);
      const uploaded = await playerService.uploadPlayerPhoto(f);
      if (uploaded) {
        setForm({ ...form, urlPhoto: uploaded });
        if (onNotify) onNotify("Foto subida correctamente.", "success");
      } else {
        if (onNotify) onNotify("No se pudo subir la foto.", "error");
      }
    } catch (e) {
      if (onNotify) onNotify("Error al subir la foto.", "error");
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.left}>
        {photo ? (
          <img
            src={photo}
            alt={teamPlayer.player?.name ?? "Jugador"}
            className={styles.avatar}
          />
        ) : (
          <Avatar className={styles.avatar}>
            {(teamPlayer.player?.name || "").charAt(0).toUpperCase()}
          </Avatar>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>
          {!editing ? (
            (teamPlayer.player?.name ?? "") +
            " " +
            (teamPlayer.player?.lastName ?? "")
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <TextField
                size="small"
                label="Nombre"
                value={form?.name ?? teamPlayer.player?.name ?? ""}
                onChange={(e) =>
                  setForm && setForm({ ...form, name: e.target.value })
                }
              />
              <TextField
                size="small"
                label="Apellidos"
                value={form?.lastName ?? teamPlayer.player?.lastName ?? ""}
                onChange={(e) =>
                  setForm && setForm({ ...form, lastName: e.target.value })
                }
              />
            </div>
          )}
        </div>
        <div className={styles.subtitle}>
          {!editing ? (
            teamPlayer.player?.alias ?? ""
          ) : (
            <TextField
              size="small"
              label="Alias"
              value={form?.alias ?? teamPlayer.player?.alias ?? ""}
              onChange={(e) =>
                setForm && setForm({ ...form, alias: e.target.value })
              }
            />
          )}
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Dorsal</div>
          <div className={styles.value}>
            {!editing ? (
              teamPlayer.dorsal ?? "-"
            ) : (
              <TextField
                size="small"
                type="number"
                value={form?.dorsal ?? teamPlayer.dorsal ?? ""}
                onChange={(e) =>
                  setForm && setForm({ ...form, dorsal: e.target.value })
                }
                onKeyDown={(e) => {
                  const blocked = ["e", "E", "+", "-", ","];
                  if (blocked.includes(e.key)) e.preventDefault();
                }}
                inputProps={{ min: 0, max: 99 }}
              />
            )}
          </div>
        </div>
        {editing && (
          <div style={{ marginTop: 8 }}>
            <label style={{ cursor: "pointer" }}>
              <input
                id="player-photo-input"
                type="file"
                accept="image/png, image/jpeg"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  await handleFile(f);
                }}
              />
              <span className={styles.selectButton} role="button" tabIndex={0}>
                Selecciona imagen
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
