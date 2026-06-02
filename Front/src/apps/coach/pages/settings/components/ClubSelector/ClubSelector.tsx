import React, { useEffect, useState } from "react";
import {
  CircularProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import clubService from "../../../../services/clubService";
import styles from "./ClubSelector.module.css";

interface ClubSelectorProps {
  initialValue?: string | null;
  onChange: (clubId: string | null) => void;
}

type ClubGridItem = {
  id: string;
  name: string;
  country: string;
  shieldUrl: string | null;
  invitationCode: string | null;
};

const ClubSelector: React.FC<ClubSelectorProps> = ({ initialValue, onChange }) => {
  const [clubs, setClubs] = useState<ClubGridItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(initialValue ?? null);

  useEffect(() => {
    let mounted = true;
    const createdObjectUrls: string[] = [];

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const clubsResp = await clubService.getUserClubs();
        const mappedClubs = await Promise.all(
          clubsResp.map(async (club) => {
            const fullClub = await clubService.getClubById(club.clubId);
            let shieldUrl: string | null = club.shieldUrl || fullClub?.emblemUrl || null;

            try {
              const emblem = await clubService.getClubEmblem(club.clubId);
              if (emblem?.data) {
                const blob = new Blob([emblem.data], {
                  type: emblem.contentType ?? "image/png",
                });
                const objectUrl = URL.createObjectURL(blob);
                createdObjectUrls.push(objectUrl);
                shieldUrl = objectUrl;
              }
            } catch {
              // Keep direct URL fallback when emblem download is not available.
            }

            return {
              id: club.clubId,
              name: club.clubName,
              country: fullClub?.country?.name ?? "-",
              shieldUrl,
              invitationCode: fullClub?.invitationCode ?? null,
            };
          })
        );

        if (!mounted) return;
        setClubs(mappedClubs);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message ?? "Error cargando clubes"));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
      createdObjectUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore cleanup errors.
        }
      });
    };
  }, []);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [initialValue]);

  const handleTogglePreferred = (clubId: string, checked: boolean) => {
    setSaving(true);
    const nextValue = checked ? clubId : null;
    setValue(nextValue);
    onChange(nextValue);
    setSaving(false);
  };

  return (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Se muestran tus clubes. Solo puedes actualizar el club preferido.
        </Typography>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={`${styles.layout} ${styles.layoutSingle}`}>
          <div className={styles.panel}>
            <div className={styles.listHeader}>
              <Typography variant="subtitle1" fontWeight={700}>
                Mis clubes
              </Typography>
            </div>

            <div className={styles.listWrap}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : clubs.length === 0 ? (
                <div className={styles.emptyState}>No hay clubes disponibles para configurar.</div>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>País</TableCell>
                      <TableCell>Escudo</TableCell>
                      <TableCell>Código de invitación</TableCell>
                      <TableCell>Preferido</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clubs.map((club) => (
                      <TableRow key={club.id} hover>
                        <TableCell>{club.name}</TableCell>
                        <TableCell>{club.country}</TableCell>
                        <TableCell>
                          {club.shieldUrl ? (
                            <img
                              src={club.shieldUrl}
                              alt={`Escudo ${club.name}`}
                              className={styles.shieldImage}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{club.invitationCode ?? "-"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={club.id === value}
                            onChange={(e) => handleTogglePreferred(club.id, e.target.checked)}
                            disabled={saving}
                            size="small"
                            inputProps={{ "aria-label": "Marcar club preferido" }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </Stack>
    </div>
  );
};

export default ClubSelector;
