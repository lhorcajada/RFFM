import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import playerService from "../../services/playerService";
import teamplayerService from "../../services/teamplayerService";
import demarcationService, {
  DemarcationOption,
} from "../../services/demarcationService";
import styles from "./PlayerDetail.module.css";
import PlayerHeader from "./components/PlayerHeader";
import Demarcations from "./components/Demarcations";
import ContactInfo from "./components/ContactInfo";
import PhysicalInfo from "./components/PhysicalInfo";
import FamilyMembers from "./components/FamilyMembers";
// teamplayerService already imported above

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();
  const [teamPlayer, setTeamPlayer] = useState<any | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [demarcationOptions, setDemarcationOptions] = useState<
    DemarcationOption[]
  >([]);
  const DOMINANT_FOOT_MAP: Record<string, number> = {
    Zurdo: 1,
    Diestro: 2,
    Ambidiestro: 3,
  };
  const DOMINANT_FOOT_ID_TO_NAME: Record<number, string> = {
    1: "Zurdo",
    2: "Diestro",
    3: "Ambidiestro",
  };

  const handleSave = async () => {
    if (!teamPlayer) return;

    const possibleNames = (form.possibleDemarcations ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const nameToId = new Map<string, number>();
    demarcationOptions.forEach((o) => nameToId.set(o.name, o.id));
    const mapped: Array<number | undefined> = possibleNames.map((n: string) =>
      nameToId.get(n)
    );
    const possibleIds: number[] = mapped.filter(
      (x): x is number => x !== undefined
    );

    if (possibleIds.length > 0 && !(form.activePositionId ?? null)) {
      setSnackbarMessage(
        "Seleccione la demarcación habitual antes de guardar."
      );
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    setSaving(true);
    try {
      const parseNumber = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const payload: any = {
        dorsal: parseNumber(form.dorsal),
        playerInfo: {
          name: form.name ?? null,
          lastName: form.lastName ?? null,
          alias: form.alias ?? null,
          urlPhoto: form.urlPhoto ?? null,
        },
        demarcation: {
          activePositionId: form.activePositionId ?? null,
          activePositionName: form.activePositionName ?? null,
          possibleDemarcations: possibleIds,
        },
        contactInfo: {
          phone: form.phone ?? null,
          email: form.email ?? null,
        },
        physicalInfo: {
          height: parseNumber(form.height),
          weight: parseNumber(form.weight),
          dominantFoot: form.dominantFoot ?? null,
          dominantFootId: form.dominantFootId ?? null,
        },
      };
      const updated = await teamplayerService.updateTeamPlayer(
        teamPlayer.id,
        payload
      );
      if (updated) {
        setTeamPlayer(updated);
        setEditing(false);
        setSnackbarMessage("Jugador guardado correctamente.");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage("No se pudo guardar el jugador.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    } catch (e) {
      setSnackbarMessage("Error al guardar. Inténtelo de nuevo.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      // load demarcation options for id<->name mapping
      try {
        const opts = await demarcationService.getDemarcations();
        if (mounted) setDemarcationOptions(opts);
      } catch (e) {}

      if (!id) return;
      try {
        const tp = await teamplayerService.getTeamPlayerById(id);
        if (!mounted) return;
        if (tp) {
          setTeamPlayer(tp);
          setForm({
            alias: tp.player?.alias ?? "",
            name: tp.player?.name ?? "",
            lastName: tp.player?.lastName ?? "",
            dorsal: tp.dorsal ?? null,
            phone: tp.contactInfo?.phone ?? "",
            email: tp.contactInfo?.email ?? "",
            height: tp.physicalInfo?.height ?? null,
            weight: tp.physicalInfo?.weight ?? null,
            dominantFoot: tp.physicalInfo?.dominantFoot ?? "",
            dominantFootId: tp.physicalInfo?.dominantFoot
              ? DOMINANT_FOOT_MAP[tp.physicalInfo?.dominantFoot] ?? null
              : null,
            activePositionName: tp.demarcation?.activePositionName ?? "",
            activePositionId: tp.demarcation?.activePositionId ?? null,
            possibleDemarcations: (
              tp.demarcation?.possibleDemarcations ?? []
            ).join(", "),
            urlPhoto: tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null,
          });
          const photoUrl = tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null;
          if (photoUrl) {
            try {
              const obj = await playerService.fetchPlayerPhoto(photoUrl);
              if (!mounted) return;
              setPhoto(obj);
            } catch (e) {}
          }
          return;
        }

        const p = await playerService.getPlayerById(id as string);
        if (!mounted) return;
        if (p) {
          setTeamPlayer({ player: p });
          setForm({
            alias: p?.alias ?? "",
            name: p?.name ?? "",
            lastName: p?.lastName ?? "",
            dorsal: null,
            phone: "",
            email: "",
            height: null,
            weight: null,
            dominantFoot: "",
            dominantFootId: null,
            activePositionName: "",
            activePositionId: null,
            possibleDemarcations: "",
            urlPhoto: p?.urlPhoto ?? null,
          });
          if (p?.urlPhoto) {
            try {
              const obj = await playerService.fetchPlayerPhoto(p.urlPhoto);
              if (!mounted) return;
              setPhoto(obj);
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    load();
    return () => {
      mounted = false;
      if (photo) {
        try {
          URL.revokeObjectURL(photo);
        } catch (e) {}
      }
    };
  }, [id]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode}
        subtitle={"Ficha detallada del jugador"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {teamPlayer && (
              <>
                <Button
                  onClick={() => setEditing((s) => !s)}
                  variant={editing ? "outlined" : "contained"}
                  size="small"
                >
                  {editing ? "Cancelar" : "Editar"}
                </Button>
                {editing && (
                  <>
                    <Button
                      onClick={handleSave}
                      variant="contained"
                      size="small"
                      disabled={saving}
                    >
                      Guardar
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        }
      >
        <Box className={styles.page}>
          {!teamPlayer && <div>Cargando...</div>}
          {teamPlayer && (
            <div>
              <PlayerHeader
                teamPlayer={teamPlayer}
                photo={photo}
                editing={editing}
                form={form}
                setForm={(f: any) => setForm(f)}
                setPhoto={(s: string | null) => setPhoto(s)}
                onNotify={(msg: string, sev: "success" | "error") => {
                  setSnackbarMessage(msg);
                  setSnackbarSeverity(sev);
                  setSnackbarOpen(true);
                }}
              />
              <div className={styles.spacer} />
              <Demarcations
                teamPlayer={teamPlayer}
                editing={editing}
                value={(form.possibleDemarcations ?? "")
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)}
                active={form.activePositionName ?? null}
                onChange={(ids: number[]) => {
                  // map ids to names
                  const idToName = new Map<number, string>();
                  demarcationOptions.forEach((o) => idToName.set(o.id, o.name));
                  const names = ids
                    .map((i) => idToName.get(i))
                    .filter((n) => n) as string[];
                  setForm({ ...form, possibleDemarcations: names.join(", ") });
                }}
                onActiveChange={(id: number | null) => {
                  const found = demarcationOptions.find((o) => o.id === id);
                  setForm({
                    ...form,
                    activePositionId: id,
                    activePositionName: found?.name ?? "",
                  });
                }}
              />
              <div className={styles.spacer} />
              {!editing && <ContactInfo teamPlayer={teamPlayer} />}
              {editing && (
                <div className={styles.card}>
                  <div className={styles.sectionInner}>
                    <h3>Información de contacto (editar)</h3>

                    <TextField
                      label="Teléfono"
                      size="small"
                      fullWidth
                      value={form.phone ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                    <div style={{ height: 8 }} />
                    <TextField
                      label="Email"
                      size="small"
                      fullWidth
                      value={form.email ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <div className={styles.spacer} />
              {!editing && <PhysicalInfo teamPlayer={teamPlayer} />}
              {editing && (
                <div className={styles.card}>
                  <div className={styles.sectionInner}>
                    <h3>Datos físicos (editar)</h3>

                    <TextField
                      label="Altura"
                      size="small"
                      fullWidth
                      type="number"
                      inputProps={{
                        min: 50,
                        max: 250,
                        step: 1,
                        inputMode: "numeric",
                      }}
                      value={form.height ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, height: e.target.value })
                      }
                      onKeyDown={(e) => {
                        const blocked = ["e", "E", "+", "-", ","];
                        if (blocked.includes(e.key)) e.preventDefault();
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">cm</InputAdornment>
                        ),
                      }}
                    />
                    <div style={{ height: 8 }} />
                    <TextField
                      label="Peso"
                      size="small"
                      fullWidth
                      type="number"
                      inputProps={{
                        min: 10,
                        max: 200,
                        step: 0.1,
                        inputMode: "decimal",
                      }}
                      value={form.weight ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, weight: e.target.value })
                      }
                      onKeyDown={(e) => {
                        const blocked = ["e", "E", "+", "-", ","];
                        if (blocked.includes(e.key)) e.preventDefault();
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">kg</InputAdornment>
                        ),
                      }}
                    />
                    <div style={{ height: 8 }} />
                    <FormControl fullWidth size="small">
                      <InputLabel id="dominant-foot-label">Pie</InputLabel>
                      <Select
                        labelId="dominant-foot-label"
                        label="Pie"
                        value={form.dominantFootId ?? ""}
                        size="small"
                        onChange={(e) => {
                          const id = Number(
                            (e.target as HTMLSelectElement).value
                          );
                          setForm({
                            ...form,
                            dominantFootId: isNaN(id) ? null : id,
                            dominantFoot: isNaN(id)
                              ? ""
                              : DOMINANT_FOOT_ID_TO_NAME[id],
                          });
                        }}
                      >
                        <MenuItem value={1}>Zurdo</MenuItem>
                        <MenuItem value={2}>Diestro</MenuItem>
                        <MenuItem value={3}>Ambidiestro</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>
              )}
              <div className={styles.spacer} />
              {!editing && <FamilyMembers teamPlayer={teamPlayer} />}
              {editing && (
                <div className={styles.card}>
                  <div className={styles.sectionInner}>
                    <h3>Familiares (no editable aquí)</h3>
                    <div>
                      Edición de familiares no soportada en este formulario.
                    </div>
                  </div>
                </div>
              )}

              {editing && <div className={styles.spacer} />}
            </div>
          )}
        </Box>
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarSeverity}
            sx={{ width: "100%" }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}
