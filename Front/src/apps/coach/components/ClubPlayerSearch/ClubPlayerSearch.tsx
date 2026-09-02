import React from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getClubById } from "../../services/clubService";
import { getSeasons, type Season } from "../../services/seasonService";
import {
  clubService as federationClubService,
  type ClubDirectoryItem,
  type ClubTeam,
} from "../../../federation/services/Federation/ClubService";
import {
  CATEGORY_ORDER,
  getSearchCandidates,
  normalizeCategory,
  normalizeText,
  type CategoryKey,
} from "../../pages/season-access/helpers/seasonAccess.helpers";
import TeamPlayersList from "../TeamPlayersList/TeamPlayersList";
import type { PlayerResponse } from "../../services/teamplayerService";
import RffmSeasonSelector from "../../../../shared/components/ui/RffmSeasonSelector/RffmSeasonSelector";
import { useRffmSeason } from "../../../../shared/context/RffmSeasonContext";
import styles from "./ClubPlayerSearch.module.css";

type TeamWithCategory = ClubTeam & {
  categoryKey: CategoryKey | null;
};

type TeamGroup = {
  label: CategoryKey;
  teams: TeamWithCategory[];
};

export type ClubPlayerSearchProps = {
  clubId?: string | null;
  defaultSeasonId?: string | null;
  includePreviousCategory?: boolean;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  onSelectionChange?: (players: PlayerResponse[]) => void;
  onPlayerSelect?: (payload: {
    season: Season | null;
    category: CategoryKey | null;
    team: ClubTeam | null;
    player: PlayerResponse;
  }) => void;
};

const categoryOrder = [...CATEGORY_ORDER];

async function findFederationClub(clubName: string): Promise<ClubDirectoryItem | null> {
  const normalizedClubName = normalizeText(clubName);

  for (const candidate of getSearchCandidates(clubName)) {
    const results = await federationClubService.searchClubs(candidate);
    if (!results.length) continue;

    const exactMatch = results.find((club) => normalizeText(club.name) === normalizedClubName);
    if (exactMatch) return exactMatch;

    return results[0] ?? null;
  }

  return null;
}

function buildGroups(teams: TeamWithCategory[], selectedCategory: CategoryKey, includePreviousCategory: boolean): TeamGroup[] {
  const currentIndex = categoryOrder.indexOf(selectedCategory);
  const previousCategory = includePreviousCategory && currentIndex > 0 ? categoryOrder[currentIndex - 1] : null;
  const visibleCategories = [previousCategory, selectedCategory].filter(Boolean) as CategoryKey[];

  return visibleCategories
    .map((category) => ({
      label: category,
      teams: teams
        .filter((team) => team.categoryKey === category)
        .slice()
        .sort((left, right) => left.teamName.localeCompare(right.teamName, "es")),
    }))
    .filter((group) => group.teams.length > 0);
}

export default function ClubPlayerSearch({
  clubId,
  defaultSeasonId = null,
  includePreviousCategory = false,
  onSave,
  saving = false,
  onSelectionChange,
  onPlayerSelect,
}: ClubPlayerSearchProps) {
  const [clubName, setClubName] = React.useState<string | null>(null);
  const [federationClub, setFederationClub] = React.useState<ClubDirectoryItem | null>(null);
  const [seasons, setSeasons] = React.useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = React.useState<string>(defaultSeasonId ?? "");
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryKey | "">("");
  const [teams, setTeams] = React.useState<TeamWithCategory[]>([]);
  const [selectedTeamCode, setSelectedTeamCode] = React.useState<string>("");
  const [clubLoading, setClubLoading] = React.useState(false);
  const [seasonsLoading, setSeasonsLoading] = React.useState(false);
  const [teamsLoading, setTeamsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectorsOpen, setSelectorsOpen] = React.useState(false);
  const { seasonId: rffmSeasonId } = useRffmSeason();

  const selectedCategoryKey = selectedCategory || null;
  const selectedSeason = React.useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId) ?? null,
    [seasons, selectedSeasonId],
  );
  const selectedTeam = React.useMemo(
    () => teams.find((team) => team.teamCode === selectedTeamCode) ?? null,
    [selectedTeamCode, teams],
  );
  const groups = React.useMemo(() => {
    if (!selectedCategoryKey) return [];
    return buildGroups(teams, selectedCategoryKey, includePreviousCategory);
  }, [includePreviousCategory, selectedCategoryKey, teams]);

  React.useEffect(() => {
    setSelectedSeasonId(defaultSeasonId ?? "");
  }, [defaultSeasonId]);

  React.useEffect(() => {
    let mounted = true;

    async function loadClubData() {
      if (!clubId) {
        setClubName(null);
        setFederationClub(null);
        setError(null);
        return;
      }

      setClubLoading(true);
      setError(null);

      try {
        const currentClub = await getClubById(clubId);
        if (!mounted) return;

        const nextClubName = currentClub?.name ?? null;
        setClubName(nextClubName);

        if (!nextClubName) {
          setFederationClub(null);
          setError("No se pudo resolver el club seleccionado.");
          return;
        }

        const federationClubResult = await findFederationClub(nextClubName);
        if (!mounted) return;

        setFederationClub(federationClubResult);
        if (!federationClubResult) {
          setError("No se encontró el club en Federación.");
        }
      } catch {
        if (mounted) {
          setClubName(null);
          setFederationClub(null);
          setError("No se pudo cargar el club seleccionado.");
        }
      } finally {
        if (mounted) setClubLoading(false);
      }
    }

    void loadClubData();

    return () => {
      mounted = false;
    };
  }, [clubId]);

  React.useEffect(() => {
    let mounted = true;

    async function loadSeasons() {
      if (!clubId) {
        setSeasons([]);
        return;
      }

      setSeasonsLoading(true);

      try {
        const seasonsResponse = await getSeasons(clubId);
        if (!mounted) return;
        setSeasons(seasonsResponse);
      } catch {
        if (mounted) setSeasons([]);
      } finally {
        if (mounted) setSeasonsLoading(false);
      }
    }

    void loadSeasons();

    return () => {
      mounted = false;
    };
  }, [clubId]);

  React.useEffect(() => {
    let mounted = true;

    async function loadTeams() {
      if (!federationClub || !selectedSeasonId || !selectedCategoryKey) {
        setTeams([]);
        setSelectedTeamCode("");
        return;
      }

      setTeamsLoading(true);
      setError(null);

      try {
        const clubTeams = await federationClubService.getClubTeams(
          federationClub.clubCode,
          rffmSeasonId ?? undefined,
        );
        if (!mounted) return;

        const normalizedTeams = clubTeams
          .map<TeamWithCategory>((team) => ({
            ...team,
            categoryKey: normalizeCategory(team.categoryDescription),
          }))
          .filter((team) => team.categoryKey != null);

        setTeams(normalizedTeams);
      } catch {
        if (mounted) {
          setTeams([]);
          setSelectedTeamCode("");
          setError("No se pudieron cargar los equipos del club.");
        }
      } finally {
        if (mounted) setTeamsLoading(false);
      }
    }

    void loadTeams();

    return () => {
      mounted = false;
    };
  }, [federationClub, selectedCategoryKey, selectedSeasonId, rffmSeasonId]);

  React.useEffect(() => {
    if (selectedTeamCode && !groups.some((group) => group.teams.some((team) => team.teamCode === selectedTeamCode))) {
      setSelectedTeamCode("");
    }
  }, [groups, selectedTeamCode]);

  return (
    <Box className={styles.root}>
      <Paper elevation={0} className={styles.panel}>
        <Stack spacing={2}>
          <div className={styles.headerRow}>
            <div>
              <Typography variant="overline" className={styles.kicker}>
                Búsqueda de jugadores
              </Typography>
              <Typography variant="h5" className={styles.title}>
                Selecciona temporada, categoría y equipo
              </Typography>
              <Typography variant="body2" className={styles.description}>
                El flujo sigue la misma lógica que en season-access. Si activas la categoría anterior,
                también aparecerán sus equipos junto a los de la categoría elegida.
              </Typography>
            </div>

            <div className={styles.summaryChips}>
              {clubName ? <Chip label={clubName} variant="outlined" /> : null}
              {includePreviousCategory ? <Chip label="Incluye categoría anterior" color="warning" variant="outlined" /> : null}
            </div>
          </div>

          {clubLoading || seasonsLoading ? (
            <div className={styles.loadingState}>
              <CircularProgress size={22} />
              <span>Cargando datos del club...</span>
            </div>
          ) : null}

          {error ? <Alert severity="info">{error}</Alert> : null}

          <details
            className={styles.selectorDisclosure}
            open={selectorsOpen}
            onToggle={(event) => setSelectorsOpen((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className={styles.selectorSummary}>
              <span className={styles.selectorSummaryLabel}>
                Buscador de jugadores por temporada
                <ExpandMoreIcon className={`${styles.selectorSummaryIcon} ${selectorsOpen ? styles.selectorSummaryIconOpen : ""}`} />
              </span>
              {onSave ? (
                <Button
                  variant="contained"
                  size="small"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onSave();
                  }}
                  disabled={saving}
                >
                  Guardar
                </Button>
              ) : null}
            </summary>

            <div className={styles.selectorBody}>
              <div className={styles.formGrid}>
                <FormControl fullWidth size="small" disabled={!clubId || clubLoading}>
                  <InputLabel id="club-player-season-label">Temporada</InputLabel>
                  <Select
                    labelId="club-player-season-label"
                    label="Temporada"
                    value={selectedSeasonId}
                    onChange={(event) => setSelectedSeasonId(String(event.target.value))}
                  >
                    <MenuItem value="">
                      <em>Selecciona una temporada</em>
                    </MenuItem>
                    {seasons.map((season) => (
                      <MenuItem key={season.id} value={season.id}>
                        {season.name ?? season.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <RffmSeasonSelector />

                <FormControl fullWidth size="small" disabled={!selectedSeasonId}>
                  <InputLabel id="club-player-category-label">Categoría</InputLabel>
                  <Select
                    labelId="club-player-category-label"
                    label="Categoría"
                    value={selectedCategory}
                    onChange={(event) => {
                      setSelectedCategory(event.target.value as CategoryKey);
                      setSelectedTeamCode("");
                    }}
                  >
                    <MenuItem value="">
                      <em>Selecciona una categoría</em>
                    </MenuItem>
                    {CATEGORY_ORDER.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </div>

          {!selectedSeasonId ? (
            <Alert severity="info">Primero selecciona una temporada para cargar categorías y equipos.</Alert>
          ) : null}

          {selectedSeasonId && !selectedCategoryKey ? (
            <Alert severity="info">Después selecciona una categoría para mostrar los equipos asociados.</Alert>
          ) : null}

          {selectedSeasonId && selectedCategoryKey && !teamsLoading && groups.length === 0 ? (
            <Alert severity="info">
              No se encontraron equipos para {selectedCategoryKey.toLowerCase()}
              {includePreviousCategory ? " ni para la categoría anterior." : "."}
            </Alert>
          ) : null}

          {teamsLoading ? (
            <div className={styles.loadingState}>
              <CircularProgress size={22} />
              <span>Cargando equipos...</span>
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div className={styles.groups}>
              {groups.map((group) => (
                <section key={group.label} className={styles.group}>
                  <div className={styles.groupHeader}>
                    <Typography variant="subtitle2" className={styles.groupTitle}>
                      {group.label}
                    </Typography>
                    <span className={styles.groupCount}>{group.teams.length}</span>
                  </div>

                  <div className={styles.teamGrid}>
                    {group.teams.map((team) => {
                      const isSelected = selectedTeamCode === team.teamCode;
                      return (
                        <button
                          key={team.teamCode}
                          type="button"
                          className={`${styles.teamCard} ${isSelected ? styles.teamCardSelected : ""}`}
                          onClick={() => {
                            setSelectedTeamCode(team.teamCode);
                          }}
                          aria-pressed={isSelected}
                          title={team.teamName}
                        >
                          <div className={styles.teamInfo}>
                            <div className={styles.teamName}>{team.teamName}</div>
                            <div className={styles.teamCategory}>{team.categoryDescription}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          <TeamPlayersList
            team={selectedTeam}
            seasonId={selectedSeasonId}
            category={selectedCategoryKey}
            onSelectionChange={onSelectionChange}
            onPlayerSelect={(player) => {
              onPlayerSelect?.({
                season: selectedSeason,
                category: selectedCategoryKey,
                team: selectedTeam,
                player,
              });
            }}
          />
          </details>
        </Stack>
      </Paper>
    </Box>
  );
}