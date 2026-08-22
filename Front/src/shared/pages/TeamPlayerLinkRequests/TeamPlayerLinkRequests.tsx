import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Chip,
  Snackbar,
  Alert as MuiAlert,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../components/ui/ContentLayout/ContentLayout";
import ConfirmDialog from "../../components/ui/ConfirmDialog/ConfirmDialog";
import { teamPlayerLinkRequestsApi } from "../../services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi";
import type { TeamPlayerLinkRequestDto } from "../../types/scope";
import styles from "./TeamPlayerLinkRequests.module.css";

type Tab_ = "pending" | "decided";

interface ActionTarget {
  row: TeamPlayerLinkRequestDto;
  kind: "approve" | "reject";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function isAxiosErrorWithProblem(
  err: unknown,
): { status?: number; problem?: any } | null {
  const anyErr = err as any;
  if (!anyErr || typeof anyErr !== "object") return null;
  const response = anyErr.response;
  if (!response) return null;
  return { status: response.status, problem: response.data };
}

function problemMessage(err: unknown, fallback: string): string {
  const parsed = isAxiosErrorWithProblem(err);
  if (parsed?.problem) {
    return (
      parsed.problem.detail ??
      parsed.problem.message ??
      parsed.problem.title ??
      fallback
    );
  }
  return fallback;
}

const STATUS_COLOR: Record<string, any> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "error",
  Cancelled: "default",
};

export default function TeamPlayerLinkRequests(): JSX.Element {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("teamId") ?? "";

  const [tab, setTab] = useState<Tab_>("pending");
  const [rows, setRows] = useState<TeamPlayerLinkRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [processing, setProcessing] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<"success" | "error">("success");

  function showSnack(message: string, severity: "success" | "error" = "success") {
    setSnackMsg(message);
    setSnackSeverity(severity);
    setSnackOpen(true);
  }

  async function loadAll(activeTab: Tab_) {
    setLoading(true);
    try {
      const list = await teamPlayerLinkRequestsApi.list(teamId, activeTab === "pending" ? "pending" : "decided");
      setRows(list);
    } catch (err) {
      showSnack(problemMessage(err, "Error al cargar las solicitudes."), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, teamId]);

  async function confirmAction() {
    if (!actionTarget) return;
    setProcessing(true);
    try {
      if (actionTarget.kind === "approve") {
        await teamPlayerLinkRequestsApi.approve(actionTarget.row.id);
        showSnack("Solicitud aprobada.", "success");
      } else {
        await teamPlayerLinkRequestsApi.reject(actionTarget.row.id);
        showSnack("Solicitud rechazada.", "success");
      }
      setActionTarget(null);
      await loadAll(tab);
    } catch (err) {
      showSnack(problemMessage(err, "Error al procesar la solicitud."), "error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <BaseLayout>
      <ContentLayout title="Solicitudes de vinculación a jugadores">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="pending" label="Pendientes" />
          <Tab value="decided" label="Decididas" />
        </Tabs>

        {loading ? (
          <Box className={styles.loadingOverlay}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Paper className={styles.emptyPaper}>
            <Typography className={styles.textMuted}>
              {tab === "pending"
                ? "No hay solicitudes pendientes."
                : "Todavía no se ha decidido ninguna solicitud."}
            </Typography>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper} className={`${styles.tableWrap} ${styles.tableView}`}>
              <Table aria-label="solicitudes de vinculación a jugadores">
                <TableHead>
                  <TableRow>
                    <TableCell>Alias</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Jugador</TableCell>
                    {tab === "pending" ? (
                      <>
                        <TableCell>Fecha de solicitud</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>Estado</TableCell>
                        <TableCell>Decidido el</TableCell>
                        <TableCell>Decidido por</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.applicantAlias}</TableCell>
                      <TableCell>{r.applicantEmail}</TableCell>
                      <TableCell>{r.playerName}</TableCell>
                      {tab === "pending" ? (
                        <>
                          <TableCell>{formatDate(r.requestedAt)}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              aria-label={`Aceptar a ${r.applicantAlias}`}
                              size="small"
                              onClick={() => setActionTarget({ row: r, kind: "approve" })}
                            >
                              <CheckCircleOutlineIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              aria-label={`Rechazar a ${r.applicantAlias}`}
                              size="small"
                              onClick={() => setActionTarget({ row: r, kind: "reject" })}
                            >
                              <CancelOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Chip label={r.status} color={STATUS_COLOR[r.status] ?? "default"} size="small" />
                          </TableCell>
                          <TableCell>{r.decidedAt ? formatDate(r.decidedAt) : "—"}</TableCell>
                          <TableCell>{r.decidedByAlias ?? "—"}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box className={styles.cardView}>
              {rows.map((r) => (
                <Paper key={r.id} className={styles.card}>
                  <Typography className={styles.cardTitle}>{r.applicantAlias}</Typography>
                  <Typography variant="caption" className={styles.cardSubtitle}>{r.applicantEmail}</Typography>
                  <Typography variant="caption">{r.playerName}</Typography>
                  {tab === "pending" ? (
                    <>
                      <Typography variant="caption">{formatDate(r.requestedAt)}</Typography>
                      <Box className={styles.cardActions}>
                        <IconButton
                          aria-label={`Aceptar a ${r.applicantAlias}`}
                          onClick={() => setActionTarget({ row: r, kind: "approve" })}
                        >
                          <CheckCircleOutlineIcon />
                        </IconButton>
                        <IconButton
                          aria-label={`Rechazar a ${r.applicantAlias}`}
                          onClick={() => setActionTarget({ row: r, kind: "reject" })}
                        >
                          <CancelOutlinedIcon />
                        </IconButton>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Chip label={r.status} color={STATUS_COLOR[r.status] ?? "default"} size="small" />
                      <Typography variant="caption">
                        {r.decidedAt ? formatDate(r.decidedAt) : "—"}
                        {r.decidedByAlias ? ` · por ${r.decidedByAlias}` : ""}
                      </Typography>
                    </>
                  )}
                </Paper>
              ))}
            </Box>
          </>
        )}

        <ConfirmDialog
          open={!!actionTarget}
          title={actionTarget?.kind === "approve" ? "¿Vincular jugador?" : "¿Rechazar solicitud?"}
          description={
            actionTarget?.kind === "approve"
              ? `¿Vincular a ${actionTarget?.row.applicantAlias} (${actionTarget?.row.applicantEmail}) con ${actionTarget?.row.playerName}? Se le concederá acceso a los datos de ese jugador.`
              : `¿Rechazar la solicitud de ${actionTarget?.row.applicantAlias} para vincularse con ${actionTarget?.row.playerName}?`
          }
          confirmText="Confirmar"
          processing={processing}
          onCancel={() => setActionTarget(null)}
          onConfirm={confirmAction}
        />

        <Snackbar
          open={snackOpen}
          autoHideDuration={4000}
          onClose={() => setSnackOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MuiAlert onClose={() => setSnackOpen(false)} severity={snackSeverity}>
            {snackMsg}
          </MuiAlert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}
