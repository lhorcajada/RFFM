import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import { getTrialDays, getTrialDayRatings, saveSeasonAccessPlayer } from "../../services/seasonAccessService";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TrialDaysManager from "./components/TrialDaysManager";

import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ErrorBoundary from "../../../../shared/components/ui/ErrorBoundary/ErrorBoundary";
import SelectableChip from "../../../../shared/components/ui/SelectableChip/SelectableChip";
import SelectionPlayersTab from "./components/SelectionPlayersTab";
import TestsTab from "./components/TestsTab";
import useSeasonAccess from "./hooks/useSeasonAccess";
import { CATEGORY_ORDER, type CategoryKey } from "./helpers/seasonAccess.helpers";

import styles from "./SeasonAccess.module.css";

export default function SeasonAccess() {
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialDialogCategory, setTrialDialogCategory] = useState<CategoryKey | null>(null);
  const [pendingCategory, setPendingCategory] = useState<CategoryKey | null>(null);
  const {
    activeClub,
    clubsLoading,
    teamsLoading,
    playersLoading,
    error,
    groups,
    selectedCategory,
    selectedTeam,
    selectedTeamCode,
    players,
    selectedPlayers,
    handleTogglePlayer,
    handleAddAllPlayers,
    demarcations,
    handleRemoveSelectedPlayer,
    handleUpdateBirthYear,
    handleCommitBirthYear,
    handleTogglePossibleDemarcation,
    handleSetIdealDemarcation,
    setSelectedCategory,
    setSelectedTeamCode,
    trialId,
    activeSeason,
    reloadSelection,
  } = useSeasonAccess();

  async function handleTrialDialogClose() {
    setTrialDialogOpen(false);
    try {
      const candidateCategory = pendingCategory ?? trialDialogCategory;
      if (candidateCategory && activeSeason?.id) {
        const days = await getTrialDays(activeSeason.id, candidateCategory);
        if (days && days.length > 0) {
          setSelectedCategory(candidateCategory);
        } else {
          window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Debes crear al menos un día de prueba para esa categoría.', severity: 'warning' } }));
        }
      }
    } catch {
      // ignore
    } finally {
      setPendingCategory(null);
      setTrialDialogCategory(null);
    }
  }

  return (
    <BaseLayout hideFooterMenu>
      <ErrorBoundary>
        <ContentLayout
          title="Pruebas de acceso"
          subtitle="Temporada que viene"
          actionBar={
            <div className={styles.actionBarContent}>
              <div className={styles.chipGroup}>
              {CATEGORY_ORDER.map((category) => (
                <SelectableChip
                  key={category}
                  label={category}
                  selected={selectedCategory === category}
                  onSelect={() => {
                    (async function () {
                      if (!activeSeason?.id) {
                        window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Falta temporada activa.', severity: 'warning' } }));
                        return;
                      }
                      try {
                        const days = await getTrialDays(activeSeason.id, category);
                        if (days && days.length > 0) {
                          setSelectedCategory(category);
                        } else {
                          setPendingCategory(category);
                          setTrialDialogCategory(category);
                          setTrialDialogOpen(true);
                        }
                      } catch {
                        setPendingCategory(category);
                        setTrialDialogCategory(category);
                        setTrialDialogOpen(true);
                      }
                    })();
                  }}
                />
              ))}
            </div>

            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setTrialDialogCategory(selectedCategory ?? null);
                setTrialDialogOpen(true);
              }}
            >
              Días de prueba
            </Button>
            {tabIndex === 1 && (
              <Button
                size="small"
                variant="contained"
                onClick={() => setConfirmCopyOpen(true)}
                className={styles.passToTestsButton}
                disabled={!activeSeason?.id || !selectedCategory}
                title="Copiar valoraciones del primer día sobre los demás"
              >
                Copiar primer día
              </Button>
            )}

            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
              className={styles.backButton}
            >
              Volver
            </Button>
          </div>
        }
        >
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} aria-label="Pestañas de Season Access" sx={{ mb: 1 }}>
          <Tab label="Jugadores del club" />
          <Tab label="Pruebas" />
        </Tabs>

        {tabIndex === 0 && (
          <SelectionPlayersTab
            selectedPlayers={selectedPlayers}
            demarcations={demarcations}
            handleRemoveSelectedPlayer={handleRemoveSelectedPlayer}
            handleUpdateBirthYear={handleUpdateBirthYear}
            handleCommitBirthYear={handleCommitBirthYear}
            handleTogglePossibleDemarcation={handleTogglePossibleDemarcation}
            handleSetIdealDemarcation={handleSetIdealDemarcation}
            clubsLoading={clubsLoading}
            activeClub={activeClub}
            error={error}
            selectedCategory={selectedCategory}
            teamsLoading={teamsLoading}
            groups={groups}
            selectedTeamCode={selectedTeamCode}
            setSelectedTeamCode={setSelectedTeamCode}
            selectedTeam={selectedTeam}
            players={players}
            playersLoading={playersLoading}
            handleAddAllPlayers={handleAddAllPlayers}
            handleTogglePlayer={handleTogglePlayer}
            seasonId={activeSeason?.id ?? null}
          />
        )}
        {tabIndex === 1 && (
          <TestsTab
            selectedPlayers={selectedPlayers}
            demarcations={demarcations}
            trialId={trialId}
            seasonId={activeSeason?.id ?? null}
            category={selectedCategory}
            reloadSelection={reloadSelection}
          />
        )}
        <Dialog open={confirmCopyOpen} onClose={() => setConfirmCopyOpen(false)}>
          <DialogTitle>Copiar primer día</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Esto sobrescribirá las valoraciones de los demás días con los datos del primer día. ¿Desea continuar?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmCopyOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                setCopying(true);
                try {
                  if (!activeSeason?.id || !selectedCategory) {
                    window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Faltan datos de temporada o categoría.', severity: 'warning' } }));
                    return;
                  }
                  const days = await getTrialDays(activeSeason.id, selectedCategory);
                  if (!days || days.length < 2) {
                    window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No hay suficientes días de prueba para copiar.', severity: 'warning' } }));
                    return;
                  }
                  const source = await getTrialDayRatings(days[0].id);
                  for (let i = 1; i < days.length; i++) {
                    const targetDay = days[i];
                    for (const r of source) {
                      // Find matching player in selectedPlayers to obtain player details
                        const sp = selectedPlayers?.find((p: any) => {
                          const rId = String(r.federationPlayerCode ?? r.id);
                          return String(p.id) === rId || String(p.federationPlayerCode) === rId || String(p.id) === rId;
                        });
                      const payload = {
                        seasonId: activeSeason?.id,
                        category: selectedCategory,
                        divisionCategory: sp?.category ?? selectedCategory,
                          federationPlayerCode: sp?.federationPlayerCode ?? String(r.federationPlayerCode ?? r.id),
                        playerName: sp?.playerName ?? sp?.displayName ?? 'Jugador',
                        teamCode: sp?.teamCode ?? sp?.teamName ?? 'manual',
                        teamName: sp?.teamName ?? sp?.teamCode ?? 'manual',
                        birthYear: sp?.birthYear ?? null,
                          status: (sp as any)?.status ?? null,
                        totalGoals: (r as any).totalGoals ?? null,
                        possibleDemarcationIds: r.possibleDemarcationIds ?? [],
                        idealDemarcationId: r.idealDemarcationId ?? null,
                      } as any;
                      await saveSeasonAccessPlayer(payload);
                    }
                  }
                  window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Copia completada.', severity: 'success' } }));
                } catch (err) {
                  window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Error al copiar los datos.', severity: 'error' } }));
                } finally {
                  setCopying(false);
                  setConfirmCopyOpen(false);
                }
              }}
              disabled={copying}
            >
              {copying ? 'Copiando…' : 'Copiar'}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={trialDialogOpen} onClose={() => handleTrialDialogClose()} maxWidth="md" fullWidth>
          <DialogTitle>Días de prueba</DialogTitle>
          <DialogContent>
            {!trialDialogCategory ? (
              <div style={{ marginTop: 8 }}>
                <div className={styles.chipGroup}>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectableChip
                      key={c}
                      label={c}
                      selected={trialDialogCategory === c}
                      onSelect={() => setTrialDialogCategory(c)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              activeSeason?.id && (
                <TrialDaysManager seasonId={activeSeason.id} category={trialDialogCategory} />
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleTrialDialogClose()}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </ContentLayout>
      </ErrorBoundary>
    </BaseLayout>
  );
}