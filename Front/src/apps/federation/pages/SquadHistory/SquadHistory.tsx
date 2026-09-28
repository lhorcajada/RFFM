import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, CircularProgress, Paper, TextField, Typography } from "@mui/material";
import { format } from "date-fns";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import { requestSquadHistory } from "../../services/squadHistoryService";
import { useSquadHistory } from "./useSquadHistory";
import SquadHistoryPlayerCard from "./components/SquadHistoryPlayerCard";
import { sortPlayers } from "./squadHistoryOrder";
import styles from "./SquadHistory.module.css";

function showSnackbar(message: string, severity: "info" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function SquadHistory(): JSX.Element {
  useAuditPageAccess("SquadHistory");
  const navigate = useNavigate();
  const { teamCode = "" } = useParams<{ teamCode: string }>();
  const [searchParams] = useSearchParams();
  const seasonId = Number(searchParams.get("seasonId") ?? 0);
  const { report, loading, notFound, error, inProgress, reload } = useSquadHistory(teamCode, seasonId);
  const [requesting, setRequesting] = useState(false);
  const [search, setSearch] = useState("");

  const players = useMemo(() => {
    const all = sortPlayers(report?.players ?? []);
    const term = normalize(search.trim());
    return term ? all.filter((p) => normalize(p.playerName).includes(term)) : all;
  }, [report, search]);

  const handleGenerate = async (refresh: boolean) => {
    setRequesting(true);
    try {
      await requestSquadHistory(teamCode, { seasonId, teamName: report?.teamName ?? "", refresh });
      await reload();
    } catch {
      showSnackbar("No se pudo solicitar el historial de la plantilla.", "error");
    } finally {
      setRequesting(false);
    }
  };

  const subtitle = report ? (
    <span>
      {report.teamName}
      {report.completedAt && ` · Actualizado el ${format(new Date(report.completedAt), "dd/MM/yyyy HH:mm")}`}
    </span>
  ) : undefined;

  return (
    <BaseLayout>
      <div className={styles.container}>
        <ContentLayout
          title="Historial de plantilla"
          subtitle={subtitle}
          actionBar={
            <>
              <Button size="small" variant="outlined" onClick={() => navigate("/federation/get-players")}>
                Volver a plantilla
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!report || inProgress || requesting}
                onClick={() => handleGenerate(true)}
              >
                Actualizar
              </Button>
            </>
          }
        >
          {loading ? (
            <div className={styles.center}>
              <CircularProgress />
            </div>
          ) : (
            <>
              {error && (
                <Alert severity="error" className={styles.alert}>
                  {error}
                </Alert>
              )}

              {inProgress && report && (
                <Alert severity="info" className={styles.alert}>
                  Estamos recopilando el historial. Te avisaremos con una notificación cuando esté listo.
                  {report.totalPlayers > 0 && (
                    <span className={styles.progress}>
                      {`Procesados ${report.processedPlayers} de ${report.totalPlayers} jugadores.`}
                    </span>
                  )}
                </Alert>
              )}

              {report?.status === "Failed" && (
                <Alert severity="error" className={styles.alert}>
                  {report.errorMessage ?? "No se pudo generar el historial."}
                </Alert>
              )}

              {report?.isCandidateSquad && (
                <Alert severity="info" className={styles.alert}>
                  El equipo todavía no tiene jugadores. Se muestran posibles jugadores del club según su
                  año de nacimiento, procedentes de equipos de la temporada anterior.
                  {report.candidateSearchNote && (
                    <span className={styles.progress}>{report.candidateSearchNote}</span>
                  )}
                </Alert>
              )}

              {report?.isCandidateSquad && !inProgress && report.players.length === 0 && (
                <Paper className={styles.empty}>
                  <Typography>No se encontraron posibles jugadores para este equipo.</Typography>
                </Paper>
              )}

              {notFound && (
                <Paper className={styles.empty}>
                  <Typography>Todavía no se ha generado el historial de esta plantilla.</Typography>
                  <Button variant="contained" disabled={requesting} onClick={() => handleGenerate(false)}>
                    Generar historial
                  </Button>
                </Paper>
              )}

              {report && report.players.length > 0 && (
                <>
                  <TextField
                    label="Buscar jugador"
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={styles.search}
                    fullWidth
                  />
                  <div className={styles.grid}>
                    {players.map((player) => (
                      <SquadHistoryPlayerCard key={player.playerCode} player={player} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </ContentLayout>
      </div>
    </BaseLayout>
  );
}
