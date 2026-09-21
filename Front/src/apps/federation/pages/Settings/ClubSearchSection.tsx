import React, { useState, useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import {
  competitionService,
  type CompetitionTeamMatch,
} from "../../services/Federation/CompetitionService";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import useClearOnSeasonChange from "../../../../shared/hooks/useClearOnSeasonChange";
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
  const { seasonId, seasons } = useRffmSeason();
  const seasonLabel = seasons.find((s) => s.id === seasonId)?.label;

  const [competition, setCompetition] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [teamName, setTeamName] = useState("");
  const [matches, setMatches] = useState<CompetitionTeamMatch[]>([]);
  const [selectedTeamCode, setSelectedTeamCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const requestRef = useRef(0);

  const resetResults = useCallback(() => {
    requestRef.current += 1;
    setMatches([]);
    setSelectedTeamCode("");
    setSearching(false);
    setSearchDone(false);
    setSearchError(false);
  }, []);

  useClearOnSeasonChange(() => {
    setCompetition(undefined);
    resetResults();
  });

  const selectMatch = useCallback(
    (match: CompetitionTeamMatch) => {
      setSelectedTeamCode(match.teamCode);
      onTeamResolved({
        competition: {
          id: match.competitionCode,
          name: match.competitionName || competition?.name || "",
        },
        group: { id: match.groupCode, name: match.groupName },
        team: { id: match.teamCode, name: match.teamName },
      });
    },
    [competition, onTeamResolved],
  );

  const canSearch = !!competition && teamName.trim().length > 0 && !searching;

  async function handleSearch() {
    const name = teamName.trim();
    if (!competition || !name) return;

    resetResults();
    const request = requestRef.current;
    setSearching(true);

    try {
      const found = await competitionService.searchTeams(
        competition.id,
        name,
        seasonId,
      );
      if (request !== requestRef.current) return;
      setMatches(found);
      if (found.length === 1) selectMatch(found[0]);
    } catch {
      if (request !== requestRef.current) return;
      setSearchError(true);
    } finally {
      if (request === requestRef.current) {
        setSearching(false);
        setSearchDone(true);
      }
    }
  }

  return (
    <Box className={styles.container}>
      {seasonLabel && (
        <Typography className={styles.season}>
          Temporada: {seasonLabel}
        </Typography>
      )}

      <Box className={styles.fields}>
        <Box className={styles.competitionField}>
          <CompetitionSelector
            value={competition?.id}
            onChange={(c) => {
              setCompetition(c ? { id: c.id, name: c.name } : undefined);
              resetResults();
            }}
          />
        </Box>
        <TextField
          label="Nombre del equipo"
          size="small"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSearch) handleSearch();
          }}
          className={styles.nameField}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleSearch}
          disabled={!canSearch}
          startIcon={
            searching ? <CircularProgress size={14} /> : <SearchIcon />
          }
        >
          Buscar
        </Button>
      </Box>

      {searching && (
        <Box className={styles.status}>
          <CircularProgress size={14} />
          <span>Buscando el equipo grupo a grupo…</span>
        </Box>
      )}

      {searchError && (
        <Typography className={styles.noResults} color="warning.main">
          No se pudo realizar la búsqueda. Inténtalo de nuevo.
        </Typography>
      )}

      {searchDone && !searchError && matches.length === 0 && (
        <Typography className={styles.noResults}>
          No se encontró ningún equipo con ese nombre en la competición
          seleccionada.
        </Typography>
      )}

      {matches.length > 0 && (
        <Box className={styles.results}>
          {matches.length > 1 && (
            <Typography className={styles.noResults}>
              Varios equipos coinciden, elige el que buscas:
            </Typography>
          )}
          {matches.map((match) => (
            <Box
              key={`${match.groupCode}-${match.teamCode}`}
              className={`${styles.resultItem} ${
                selectedTeamCode === match.teamCode
                  ? styles.resultItemSelected
                  : ""
              }`}
              onClick={() => selectMatch(match)}
            >
              <strong>{match.teamName}</strong>
              <span className={styles.resultGroup}>{match.groupName}</span>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
