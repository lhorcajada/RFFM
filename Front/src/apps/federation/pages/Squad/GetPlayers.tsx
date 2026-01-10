import React, { useEffect, useState } from "react";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import "../../gameTheme.css";
import styles from "./GetPlayers.module.css";
import teamStyles from "../../TeamCard.module.css";
import type { Team } from "../../types/team";
import { CircularProgress, Paper, Typography, Button } from "@mui/material";

import {
  getTeamAgeSummary,
  getTeamParticipationSummary,
} from "../../services/api";
import { getSettingsForUser } from "../../services/federationApi";
import { usePlayers } from "./usePlayers";
import type { SelectedTeam } from "./playersTypes";
import { useUser } from "../../../../shared/context/UserContext";
import StaffCard from "../../components/teams/StaffCard/StaffCard";
import Address from "../../components/teams/Address/Address";
import PlayersContainer from "../../components/players/PlayersContainer/PlayersContainer";
import PlayerRow from "./components/PlayerRow";
import AgeModal from "./components/AgeModal";
import ParticipationModal from "./components/ParticipationModal";
import PrintableSquad from "../../components/players/PrintableSquad/PrintableSquad";
import { exportElementsToPdfPacked } from "../../../../shared/services/pdfService";

import type { TeamParticipationSummaryItem } from "../../types/participation";

export default function GetPlayers(): JSX.Element {
  const { user } = useUser();
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | undefined>(
    undefined
  );
  const [teamDetails, setTeamDetails] = useState<Team | null>(null);

  const [noConfig, setNoConfig] = useState<boolean>(false);
  const [showAgePopup, setShowAgePopup] = useState<boolean>(false);
  const [ageSummary, setAgeSummary] = useState<Record<number, number>>({});
  const [loadingAge, setLoadingAge] = useState<boolean>(false);
  const [showParticipationPopup, setShowParticipationPopup] =
    useState<boolean>(false);
  const [participationData, setParticipationData] = useState<
    TeamParticipationSummaryItem[]
  >([]);
  const [loadingParticipation, setLoadingParticipation] =
    useState<boolean>(false);

  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined
  );

  const printableRef = React.useRef<HTMLDivElement | null>(null);

  const {
    players,
    teamDetails: hookTeamDetails,
    loading,
    error,
    ageCounts,
    groupCounts,
  } = usePlayers(selectedTeam, selectedCompetition, selectedGroup);

  useEffect(
    () => setTeamDetails(hookTeamDetails as Team | null),
    [hookTeamDetails]
  );

  useEffect(() => {
    const handle = async () => {
      try {
        const savedSettings = await getSettingsForUser(user?.id);
        let combo: any = null;
        if (Array.isArray(savedSettings) && savedSettings.length > 0) {
          const primary = savedSettings.find((c: any) => c.isPrimary);
          combo = primary || savedSettings[0];
        }
        if (!combo || !combo.teamId) setNoConfig(true);
        else {
          setSelectedCompetition(combo.competitionId ?? undefined);
          setSelectedGroup(combo.groupId ?? undefined);
          setSelectedTeam({
            id: combo.teamId,
            name: combo.teamName,
            url: combo.teamUrl,
            raw: combo,
          });
        }
      } catch (e) {
        setNoConfig(true);
      }
    };
    handle();
    window.addEventListener("rffm.saved_combinations_changed", handle);
    return () =>
      window.removeEventListener("rffm.saved_combinations_changed", handle);
  }, [user]);

  return (
    <BaseLayout>
      <div className={styles.filters}>
        {noConfig ? (
          <Typography variant="body2">
            No hay configuración principal guardada.
          </Typography>
        ) : null}
      </div>

      <div className={styles.container}>
        <ContentLayout
          title="Plantilla"
          actionBar={
            selectedTeam && !loading ? (
              <>
                <div className={styles.ageOverlay}>
                  <Button
                    size="small"
                    variant="outlined"
                    className={styles.homeButton}
                    onClick={async () => {
                      if (showAgePopup) {
                        setShowAgePopup(false);
                        return;
                      }
                      setShowAgePopup(true);
                      try {
                        setLoadingAge(true);
                        const id = String(
                          (selectedTeam as any).id || selectedTeam?.id
                        );
                        const data = await getTeamAgeSummary(id, "21");
                        const map: Record<number, number> = {};
                        (data || []).forEach((d: any) => {
                          const a = Number(d.age ?? d.ace ?? 0);
                          map[a] = Number(d.total ?? d.count ?? 0);
                        });
                        setAgeSummary(map);
                      } catch (err) {
                        setAgeSummary({});
                      } finally {
                        setLoadingAge(false);
                      }
                    }}
                  >
                    Edades
                  </Button>
                  <AgeModal
                    open={showAgePopup}
                    onClose={() => setShowAgePopup(false)}
                    loading={loadingAge}
                    ageSummary={ageSummary}
                  />
                </div>

                <div>
                  <Button
                    size="small"
                    variant="outlined"
                    className={styles.homeButton}
                    onClick={async () => {
                      if (showParticipationPopup) {
                        setShowParticipationPopup(false);
                        return;
                      }
                      setShowParticipationPopup(true);
                      try {
                        setLoadingParticipation(true);
                        const id = String(
                          (selectedTeam as any).id || selectedTeam?.id
                        );
                        const data = await getTeamParticipationSummary(
                          id,
                          "21"
                        );
                        setParticipationData(data || []);
                      } catch (err) {
                        setParticipationData([]);
                      } finally {
                        setLoadingParticipation(false);
                      }
                    }}
                  >
                    Participaciones
                  </Button>
                  <ParticipationModal
                    open={showParticipationPopup}
                    onClose={() => setShowParticipationPopup(false)}
                    loading={loadingParticipation}
                    data={participationData}
                  />
                </div>
                <div>
                  <Button
                    size="small"
                    variant="contained"
                    className={styles.homeButton}
                    disabled={exportingPdf}
                    onClick={async () => {
                      // exportar por secciones para evitar cortes de tabla
                      const headerEl = document.getElementById(
                        "rffm-printable-squad-header"
                      );
                      const playersEl = document.getElementById(
                        "rffm-printable-squad-players"
                      );
                      const agesEl = document.getElementById(
                        "rffm-printable-squad-ages"
                      );
                      const partsEl = document.getElementById(
                        "rffm-printable-squad-participations"
                      );
                      if (!playersEl || !agesEl || !partsEl) return;
                      try {
                        setExportingPdf(true);
                        const id = String(
                          (selectedTeam as any).id || selectedTeam?.id
                        );

                        // Asegurar participaciones cargadas antes de capturar el DOM
                        if (
                          !participationData ||
                          participationData.length === 0
                        ) {
                          try {
                            const data = await getTeamParticipationSummary(
                              id,
                              "21"
                            );
                            setParticipationData(
                              (data || []) as TeamParticipationSummaryItem[]
                            );
                          } catch (e) {
                            // si falla, dejamos el estado como esté
                          }
                        }

                        // Esperar un frame para que el DOM oculto renderice la tabla
                        await new Promise<void>((resolve) =>
                          requestAnimationFrame(() => resolve())
                        );
                        await exportElementsToPdfPacked(
                          [playersEl, agesEl, partsEl],
                          `${selectedTeam?.name || "plantilla"}.pdf`,
                          { margin: 28, shrink: 0.95 },
                          {
                            // Jugadores siempre primero; el resumen de edades empieza en página nueva;
                            // participaciones sólo saltan si no caben en el hueco.
                            breakBefore: [false, true, false],
                            gap: 12,
                            headerElement: headerEl ?? undefined,
                            headerGap: 10,
                          }
                        );
                      } catch (err) {
                        // no hacemos nada especial
                      } finally {
                        setExportingPdf(false);
                      }
                    }}
                  >
                    Exportar PDF
                  </Button>
                </div>
              </>
            ) : undefined
          }
        >
          {teamDetails && (
            <Paper className={teamStyles.root}>
              <div className={teamStyles.header}>
                <div className={teamStyles.titleWrap}>
                  <Typography className={teamStyles.subtitle}>
                    Dirección del campo
                  </Typography>
                  <Address
                    street={teamDetails.field}
                    city={teamDetails.correspondenceCity}
                    postalCode={String(
                      teamDetails.correspondencePostalCode ?? ""
                    )}
                  />
                </div>
              </div>
            </Paper>
          )}

          {loading ? (
            <div className={styles.center}>
              <CircularProgress />
            </div>
          ) : error ? (
            <Paper className={styles.paper}>
              <Typography color="error">Error: {error}</Typography>
            </Paper>
          ) : (
            <PlayersContainer
              title={selectedTeam ? `${selectedTeam.name}` : "Jugadores"}
              count={selectedTeam ? players.length : 0}
            >
              {players.map((p) => (
                <div key={p.id}>
                  <PlayerRow player={p} />
                </div>
              ))}
            </PlayersContainer>
          )}

          <div className={styles.printableHidden} ref={printableRef}>
            <PrintableSquad
              teamName={teamDetails?.teamName}
              players={players as any}
              ageSummary={
                ageSummary && Object.keys(ageSummary).length > 0
                  ? ageSummary
                  : (ageCounts as any)
              }
              participations={
                participationData && participationData.length > 0
                  ? participationData
                  : (groupCounts as any)
              }
            />
          </div>

          {teamDetails && (
            <Paper className={`${teamStyles.root} ${styles.staffPaper}`}>
              <div className={`${teamStyles.header} ${styles.staffHeader}`}>
                <div>
                  <Typography className={teamStyles.subtitle}>
                    Staff técnico
                  </Typography>
                </div>
              </div>
              <div className={teamStyles.chips}>
                <div className={`${teamStyles.section} ${styles.equalSection}`}>
                  <StaffCard
                    title="Delegados"
                    titleClassName={styles.staffTitle}
                    staff={(teamDetails.delegates || []).map((d: any) => ({
                      name: d.name,
                      role: d.role,
                    }))}
                  />
                </div>
                <div className={`${teamStyles.section} ${styles.equalSection}`}>
                  <StaffCard
                    title="Técnicos"
                    titleClassName={styles.staffTitle}
                    staff={(teamDetails.coaches || []).map((t: any) => ({
                      name: t.name,
                      role: t.role,
                    }))}
                  />
                </div>
                <div className={`${teamStyles.section} ${styles.equalSection}`}>
                  <StaffCard
                    title="Auxiliares"
                    titleClassName={styles.staffTitle}
                    staff={(teamDetails.assistants || []).map((a: any) => ({
                      name: a.name,
                      role: a.role,
                    }))}
                  />
                </div>
              </div>
            </Paper>
          )}
        </ContentLayout>
      </div>
    </BaseLayout>
  );
}
