import React, { useEffect, useState } from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { getRivals, createRival, updateRival, uploadRivalPhoto, Rival } from "../../services/rivalService";
import ClubCromo from "./components/ClubCromo";
import { clubService } from "../../../federation/services/Federation/ClubService";
import styles from "./Rivals.module.css";

export default function Rivals() {
  const navigate = useNavigate();
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubTeamsMap, setClubTeamsMap] = useState<Record<string, any[]>>({});
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function publicImageUrl(url: string | null | undefined) {
    if (!url) return null;
    const s = String(url).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    // relative path from LocalStorageService (eg. "rivalphotos/...") -> use public proxy
    return `/api/public/storage?url=${encodeURIComponent(s)}`;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getRivals();
      setRivals(data || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setName("");
    setFile(null);
    setPreviewUrl(null);
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditing(r);
    setName(r.name ?? r.Name ?? "");
    setFile(null);
    setPreviewUrl(publicImageUrl((r.urlPhoto ?? r.UrlPhoto) ?? null));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message: "El nombre es obligatorio", severity: "warning" } }));
      return;
    }
    setSaving(true);
    try {
      let urlPhoto: string | undefined | null = editing?.urlPhoto ?? editing?.UrlPhoto ?? null;
      if (file) {
        const resp = await uploadRivalPhoto(file);
        // backend returns { Url }
        urlPhoto = resp?.Url ?? resp?.url ?? resp?.UrlPhoto ?? null;
      }

      let saved: any = null;
      if (editing) {
        const editingId = editing?.id ?? editing?.Id ?? null;
        saved = await updateRival(editingId, { Name: name, UrlPhoto: urlPhoto, Category: editing?.category ?? editing?.Category ?? null });
      } else {
        saved = await createRival({ Name: name, UrlPhoto: urlPhoto, Category: null });
      }

      // Update local list immediately so the card shows the new photo without waiting
      try {
        const returnedUrl = saved?.Url ?? saved?.url ?? saved?.UrlPhoto ?? urlPhoto;
        const returnedCategory = saved?.Category ?? saved?.category ?? null;
        if (editing) {
          setRivals((prev) =>
            prev.map((r: any) => {
              const matchId = (r.id ?? r.Id) === (editing.id ?? editing.Id);
              if (!matchId) return r;
              return {
                ...r,
                urlPhoto: returnedUrl,
                UrlPhoto: returnedUrl,
                category: returnedCategory,
                Category: returnedCategory,
                name: name,
                Name: name,
              };
            })
          );
        } else if (saved) {
          setRivals((prev) => [saved, ...prev]);
        }
      } catch (e) {
        // ignore local update errors
      }
      setDialogOpen(false);
      setFile(null);
      setPreviewUrl(null);
      load();
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message: "Rival guardado", severity: "success" } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message: "Error al guardar rival", severity: "error" } }));
    } finally {
      setSaving(false);
    }
  }

  async function handleClubSearch() {
    if (!search) return;
    setSearchLoading(true);
    try {
      const results = await clubService.searchClubs(search);
      setClubs(results || []);
      // clear previous teams map so teams are shown only after user clicks 'Ver equipos'
      setClubTeamsMap({});
    } catch (e) {
      setClubs([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleDelete(r: any) {
    const id = r?.id ?? r?.Id ?? null;
    if (!id) return;
    if (!confirm(`¿Eliminar "${r?.name ?? r?.Name ?? ""}"? Esta acción no se puede deshacer.`)) return;
    try {
      await (await import("../../services/rivalService")).deleteRival(id);
      // remove locally
      setRivals((prev) => prev.filter((x: any) => (x.id ?? x.Id) !== id));
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message: "Rival eliminado", severity: "success" } }));
    } catch (err: any) {
      const msg = err?.response?.data?.Message ?? err?.response?.data?.message ?? err?.message ?? "Error al eliminar rival";
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message: msg, severity: "error" } }));
    }
  }

  async function loadClubTeams(clubCode: string) {
    try {
      const teams = await clubService.getClubTeams(clubCode);
      setClubTeamsMap((prev) => ({ ...prev, [clubCode]: teams || [] }));
    } catch (e) {
      setClubTeamsMap((prev) => ({ ...prev, [clubCode]: [] }));
    }
  }

  async function importTeamAsRival(team: any) {
    try {
      const name = team.teamName ?? team.teamName ?? team.name ?? "";
      const url = team.teamShield ?? team.imageUrl ?? team.clubShield ?? null;
      const normalizedCategory = normalizeCategory(team.categoryDescription ?? team.category ?? null);
      await createRival({ Name: name, UrlPhoto: url, Category: normalizedCategory });
      await load();
    } catch (e) {
      alert("Error al importar equipo");
    }
  }

  function normalizeCategory(cat: string | null | undefined) {
    if (!cat) return null;
    const orig = String(cat).trim();
    if (!orig) return null;
    const s = orig
      .toLowerCase()
      // remove common accents
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u")
      .replace(/ñ/g, "n");

    const choices = ["aficionado", "juvenil", "cadete", "infantil", "alevin", "benjamin", "prebenjamin", "debutante"];
    for (const c of choices) {
      if (s.includes(c)) return (c === "alevin" ? "Alevín"
        : c === "benjamin" ? "Benjamín"
        : c === "prebenjamin" ? "Prebenjamín"
        : c.charAt(0).toUpperCase() + c.slice(1));
    }
    return null;
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Rivales"
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>

            <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openNew}>
              Nuevo
            </Button>
          </Stack>
        }
      >
        <div className={styles.container}>
          <div className={styles.list}>
            {loading ? (
              <CircularProgress />
            ) : (
              <div className={styles.grid}>
                {rivals.map((r) => (
                  <ClubCromo
                    key={r.id ?? (r as any).Id}
                    id={r.id ?? (r as any).Id}
                    name={r.name ?? (r as any).Name}
                    image={publicImageUrl(((r as any).urlPhoto ?? (r as any).UrlPhoto) ?? null)}
                    category={(r as any).category ?? (r as any).Category ?? null}
                    onEdit={() => openEdit(r)}
                    onDelete={() => handleDelete(r)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className={styles.search}>
            <Typography variant="h6">Buscar en Federación</Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 1, mb: 1 }}>
              <TextField size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre de club" />
              <Button variant="outlined" onClick={handleClubSearch} disabled={searchLoading}>
                {searchLoading ? <CircularProgress size={18} /> : "Buscar"}
              </Button>
            </Box>

            {clubs.map((c) => {
              const teamsForClub = clubTeamsMap[c.clubCode] || [];
              return (
                <Box key={c.clubCode} sx={{ mb: 1, borderBottom: "1px solid #eee", pb: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <Typography variant="subtitle2">{c.name}</Typography>
                      <Typography variant="caption">{c.teamsCount ?? ""} equipos</Typography>
                    </div>
                    <Button size="small" variant="text" onClick={() => loadClubTeams(c.clubCode)}>
                      Ver equipos
                    </Button>
                  </Box>
                  {teamsForClub.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <div className={styles.grid}>
                        {teamsForClub.map((t) => (
                          <ClubCromo
                            key={t.teamCode}
                            name={t.teamName}
                            image={t.teamShield ?? t.imageUrl ?? null}
                            category={t.categoryDescription ?? null}
                            onImport={() => importTeamAsRival(t)}
                            importLabel="Importar"
                          />
                        ))}
                      </div>
                    </Box>
                  )}
                </Box>
              );
            })}
          </div>
        </div>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editing ? "Editar rival" : "Nuevo rival"}</DialogTitle>
          <DialogContent>
            <TextField fullWidth size="small" label="Nombre" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
            <Box sx={{ mb: 1 }}>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
              ) : null}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) {
                    const obj = URL.createObjectURL(f);
                    setPreviewUrl(obj);
                  }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <CircularProgress size={18} color="inherit" /> : "Guardar"}
            </Button>
          </DialogActions>
        </Dialog>
      </ContentLayout>
    </BaseLayout>
  );
}
