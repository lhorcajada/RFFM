import React, { useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import {
  clubService,
  type ClubDirectoryItem,
  type ClubTeam,
  type TeamGroupInfo,
} from "../../services/Federation/ClubService";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import styles from "./ClubSearchSection.module.css";

interface SelectedInfo {
  competition: { id: string; name: string } | undefined;
  group: { id: string; name: string } | undefined;
  team: { id: string; name: string } | undefined;
}

interface Props {
  onTeamResolved: (info: SelectedInfo) => void;
}

export default function ClubSearchSection({ onTeamResolved }: Props) {
  const { seasonId } = useRffmSeason();
  const [searchInput, setSearchInput] = useState("");
  const [clubs, setClubs] = useState<ClubDirectoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const [selectedClub, setSelectedClub] = useState<ClubDirectoryItem | null>(null);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [selectedTeamCode, setSelectedTeamCode] = useState<string>("");
  const [resolving, setResolving] = useState(false);
  const [resolvedInfo, setResolvedInfo] = useState<TeamGroupInfo | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const searchRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    const query = searchInput.trim();
    if (!query) return;

    searchRef.current?.abort();
    searchRef.current = new AbortController();

    setSearchLoading(true);
    setSearchDone(false);
    setClubs([]);
    setSelectedClub(null);
    setTeams([]);
    setSelectedTeamCode("");
    setResolvedInfo(null);
    setResolveError(null);

    try {
      const results = await clubService.searchClubs(
        query,
        undefined,
        seasonId ?? undefined,
      );
      setClubs(results);
    } catch {
      setClubs([]);
    } finally {
      setSearchLoading(false);
      setSearchDone(true);
    }
  }, [searchInput, seasonId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClubSelect = useCallback(async (club: ClubDirectoryItem) => {
    setSelectedClub(club);
    setTeams([]);
    setSelectedTeamCode("");
    setResolvedInfo(null);
    setResolveError(null);
    setTeamsLoading(true);

    try {
      const result = await clubService.getClubTeams(
        club.clubCode,
        seasonId ?? undefined,
      );
      // Sort by categoryDescription
      const sorted = [...result].sort((a, b) =>
        a.categoryDescription.localeCompare(b.categoryDescription, "es"),
      );
      setTeams(sorted);
    } catch {
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }, [seasonId]);

  const handleTeamChange = useCallback(
    async (teamCode: string) => {
      setSelectedTeamCode(teamCode);
      setResolvedInfo(null);
      setResolveError(null);

      if (!selectedClub || !teamCode) return;

      // Pass along competitionId so the backend can use Strategy A (classification scan)
      // before falling back to the fichaequipo player route.
      const selectedTeamMeta = teams.find((t) => t.teamCode === teamCode);
      const competitionId = selectedTeamMeta?.competitionId ?? null;

      setResolving(true);
      try {
        const info = await clubService.resolveTeamGroup(
          selectedClub.clubCode,
          teamCode,
          competitionId,
        );
        setResolvedInfo(info);

        // Propagate to parent so it can pre-fill the selectors
        onTeamResolved({
          competition: info.competitionCode
            ? { id: info.competitionCode, name: info.competitionName }
            : undefined,
          group: info.groupCode
            ? { id: info.groupCode, name: info.groupName }
            : undefined,
          team: { id: teamCode, name: info.teamName },
        });
      } catch {
        setResolveError(
          "No se pudo resolver el grupo. El equipo puede no tener jugadores inscritos.",
        );
      } finally {
        setResolving(false);
      }
    },
    [selectedClub, onTeamResolved],
  );

  return (
    <Box className={styles.container}>
      {/* Search input */}
      <Box className={styles.searchRow}>
        <TextField
          label="Nombre del club"
          size="small"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ flex: 1, maxWidth: 280 }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleSearch}
          disabled={searchLoading || !searchInput.trim()}
          startIcon={
            searchLoading ? <CircularProgress size={14} /> : <SearchIcon />
          }
        >
          Buscar
        </Button>
      </Box>

      {/* Club results */}
      {searchDone && clubs.length === 0 && !searchLoading && (
        <Typography className={styles.noResults}>
          No se encontraron clubs.
        </Typography>
      )}

      {clubs.length > 0 && (
        <Box className={styles.clubList}>
          {clubs.map((club) => (
            <Box
              key={club.clubCode}
              className={`${styles.clubItem} ${
                selectedClub?.clubCode === club.clubCode
                  ? styles.clubItemSelected
                  : ""
              }`}
              onClick={() => handleClubSelect(club)}
            >
              <span>
                <strong>{club.clubCode}</strong> — {club.name}
              </span>
              <span className={styles.clubItemCount}>
                {club.teamsCount} equipo{club.teamsCount !== 1 ? "s" : ""}
              </span>
            </Box>
          ))}
        </Box>
      )}

      {/* Team selector */}
      {selectedClub && (
        <Box className={styles.teamsRow}>
          <FormControl size="small" sx={{ flex: 1, maxWidth: 320 }}>
            <InputLabel>Equipo</InputLabel>
            <Select
              label="Equipo"
              value={selectedTeamCode}
              onChange={(e) => handleTeamChange(e.target.value as string)}
              disabled={teamsLoading || teams.length === 0}
            >
              {teamsLoading && (
                <MenuItem disabled value="">
                  <CircularProgress size={12} sx={{ mr: 1 }} /> Cargando…
                </MenuItem>
              )}
              {!teamsLoading && teams.length === 0 && (
                <MenuItem disabled value="">
                  Sin equipos
                </MenuItem>
              )}
              {teams.map((t) => (
                <MenuItem key={t.teamCode} value={t.teamCode}>
                  {t.teamName}
                  {t.categoryDescription ? ` — ${t.categoryDescription}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {resolving && (
            <Box className={styles.resolving}>
              <CircularProgress size={14} />
              <span>Resolviendo grupo…</span>
            </Box>
          )}
        </Box>
      )}

      {/* Resolved group info */}
      {resolvedInfo && (
        <Box className={styles.resolvedInfo}>
          <span className={styles.resolvedInfoLabel}>Competición:</span>
          {resolvedInfo.competitionName}
          <br />
          <span className={styles.resolvedInfoLabel}>Grupo:</span>
          {resolvedInfo.groupName} ({resolvedInfo.groupCode})
        </Box>
      )}

      {resolveError && (
        <Typography
          className={styles.noResults}
          color="warning.main"
          sx={{ mt: 1 }}
        >
          {resolveError}
        </Typography>
      )}
    </Box>
  );
}
