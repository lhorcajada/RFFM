import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MuiAlert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LinkIcon from "@mui/icons-material/Link";
import styles from "./TeamUsers.module.css";
import teamUsersService from "../../services/teamUsersService";
import type {
  TeamUserDto,
  GetTeamUsersResponse,
} from "../../services/teamUsersService";
import type { MembershipKind } from "../../../../shared/types/scope";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

function isAxiosErrorWithProblem(
  err: unknown,
): { status?: number; problem?: { detail?: string } } | null {
  const anyErr = err as any;
  if (!anyErr || typeof anyErr !== "object") return null;
  const response = anyErr.response;
  if (!response) return null;
  return { status: response.status, problem: response.data };
}

function problemMessage(err: unknown, fallback: string): string {
  const parsed = isAxiosErrorWithProblem(err);
  if (parsed?.problem?.detail) {
    return parsed.problem.detail;
  }
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

const KIND_LABELS: Record<MembershipKind, string> = {
  Coach: "Entrenador",
  Directive: "Directivo de club",
  ClubMember: "Miembro de club",
  Player: "Jugador",
  FamilyPlayer: "Familiar de jugador",
  Follower: "Seguidor",
};

type ApprovalFilter = "all" | "pending" | "approved";

const FILTER_EMPTY_MESSAGES: Record<ApprovalFilter, string> = {
  all: "No hay usuarios en este equipo todavía.",
  pending: "No hay usuarios pendientes de aprobación.",
  approved: "No hay usuarios aprobados.",
};

function canDelete(
  user: TeamUserDto,
  callerIsCreator: boolean
): boolean {
  if (user.isSelf || user.isCreator) return false;
  const isCoachTier =
    user.membershipKind === "Coach" || user.membershipKind === "Directive";
  return isCoachTier ? callerIsCreator : true;
}

function canToggleApproval(user: TeamUserDto): boolean {
  return !user.isSelf;
}

export default function TeamUsers(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("teamId") ?? "";
  useAuditPageAccess('TeamUsers');

  const [teamName, setTeamName] = useState("");
  const [users, setUsers] = useState<TeamUserDto[]>([]);
  const [callerIsCreator, setCallerIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<
    "success" | "error" | "warning" | "info"
  >("success");

  const [deleteTarget, setDeleteTarget] = useState<TeamUserDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approvalUpdatingId, setApprovalUpdatingId] = useState<string | null>(null);

  const [filter, setFilter] = useState<ApprovalFilter>("all");

  const invalidTeamId = !teamId;
  const pendingCount = users.filter((u) => !u.isApproved).length;
  const approvedCount = users.length - pendingCount;
  const visibleUsers =
    filter === "pending"
      ? users.filter((u) => !u.isApproved)
      : filter === "approved"
        ? users.filter((u) => u.isApproved)
        : users;
  const filters: { key: ApprovalFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: users.length },
    { key: "pending", label: "Pendientes", count: pendingCount },
    { key: "approved", label: "Aprobados", count: approvedCount },
  ];

  function showSnack(
    message: string,
    severity: typeof snackSeverity = "success"
  ) {
    setSnackMsg(message);
    setSnackSeverity(severity);
    setSnackOpen(true);
  }

  async function loadUsers() {
    if (invalidTeamId) return;
    setLoading(true);
    try {
      const response = await teamUsersService.getTeamUsers(teamId);
      setUsers(response.users);
      setCallerIsCreator(response.callerIsCreator);
      setTeamName(response.teamName);
    } catch (err) {
      showSnack(
        problemMessage(err, "Error al cargar los usuarios del equipo."),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await teamUsersService.deleteTeamUserAccount(deleteTarget.membershipId);
      setUsers((prev) =>
        prev.filter((u) => u.membershipId !== deleteTarget.membershipId)
      );
      setDeleteTarget(null);
      showSnack("Cuenta eliminada correctamente.", "success");
    } catch (err) {
      showSnack(
        problemMessage(err, "Error al eliminar la cuenta."),
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  async function toggleApproval(user: TeamUserDto) {
    const nextApproved = !user.isApproved;
    setApprovalUpdatingId(user.membershipId);
    try {
      await teamUsersService.setTeamUserApproval(user.membershipId, nextApproved);
      setUsers((prev) =>
        prev.map((u) =>
          u.membershipId === user.membershipId ? { ...u, isApproved: nextApproved } : u
        )
      );
      showSnack(
        nextApproved ? "Usuario aprobado correctamente." : "Aprobación revocada correctamente.",
        "success"
      );
    } catch (err) {
      showSnack(
        problemMessage(err, "Error al actualizar la aprobación."),
        "error"
      );
    } finally {
      setApprovalUpdatingId(null);
    }
  }

  const snackIconColor = "currentColor";

  return (
    <BaseLayout>
      <ContentLayout
        title="Gestión de usuarios"
        subtitle={teamName || undefined}
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/coach/team-dashboard?teamId=${teamId}`)}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        {invalidTeamId ? (
          <Paper className={styles.messagePaper}>
            <Typography color="error">
              Falta el identificador del equipo. Usa{" "}
              <code>?teamId=...</code>.
            </Typography>
          </Paper>
        ) : (
          <>
            {loading ? (
              <Box className={styles.loadingOverlay}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <div className={styles.summary}>
                  <div className={styles.counter} aria-label="Usuarios totales">
                    <span className={styles.counterValue}>{users.length}</span>
                    <span className={styles.counterLabel}>Usuarios</span>
                  </div>
                  <div
                    className={`${styles.counter} ${styles.counterPending}`}
                    aria-label="Usuarios pendientes"
                  >
                    <span className={styles.counterValue}>{pendingCount}</span>
                    <span className={styles.counterLabel}>Pendientes</span>
                  </div>
                </div>

                <div className={styles.filters} role="group" aria-label="Filtrar usuarios">
                  {filters.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={filter === f.key}
                      className={`${styles.filterButton} ${filter === f.key ? styles.filterButtonActive : ""}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label} · {f.count}
                    </button>
                  ))}
                </div>

                {visibleUsers.length === 0 ? (
                  <Paper className={styles.messagePaper}>
                    <Typography className={styles.textMuted}>
                      {FILTER_EMPTY_MESSAGES[filter]}
                    </Typography>
                  </Paper>
                ) : (
                  <Box
                    component="ul"
                    role="list"
                    aria-label="usuarios del equipo"
                    className={styles.cardList}
                  >
                    {visibleUsers.map((u) => (
                      <li
                        key={u.membershipId}
                        className={`${styles.card} ${u.isApproved ? "" : styles.cardPending}`}
                      >
                        <div className={styles.cardHeader}>
                          <div className={styles.avatar} aria-hidden="true">
                            {u.alias.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.identity}>
                            <h3 className={styles.alias}>{u.alias}</h3>
                            <span className={styles.email}>{u.email}</span>
                          </div>
                          {canDelete(u, callerIsCreator) && (
                            <IconButton
                              aria-label={`Eliminar a ${u.alias}`}
                              className={styles.deleteButton}
                              onClick={() => setDeleteTarget(u)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </div>

                        <div className={styles.badges}>
                          {u.isCreator ? (
                            <span className={`${styles.badge} ${styles.badgeCreator}`}>Creador</span>
                          ) : (
                            <span className={styles.badge}>
                              {KIND_LABELS[u.membershipKind] ?? u.membershipKind}
                            </span>
                          )}
                          {u.isApproved ? (
                            <span className={`${styles.badge} ${styles.badgeApproved}`}>
                              <CheckCircleOutlineIcon fontSize="inherit" aria-hidden="true" />
                              Aprobado
                            </span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgePending}`}>
                              <AccessTimeIcon fontSize="inherit" aria-hidden="true" />
                              Pendiente de aprobación
                            </span>
                          )}
                        </div>

                        {u.linkedPlayerFullName && (
                          <p className={styles.linkedPlayer}>
                            <LinkIcon fontSize="inherit" aria-hidden="true" />
                            <span>
                              Jugador vinculado: <strong>{u.linkedPlayerFullName}</strong>
                            </span>
                          </p>
                        )}

                        <div className={styles.cardFooter}>
                          <span className={styles.joined}>Alta: {formatDate(u.joinedAt)}</span>
                          {canToggleApproval(u) &&
                            (u.isApproved ? (
                              <Button
                                className={styles.actionButton}
                                color="error"
                                variant="outlined"
                                startIcon={<BlockIcon fontSize="small" />}
                                onClick={() => toggleApproval(u)}
                                disabled={approvalUpdatingId === u.membershipId}
                              >
                                Desaprobar
                              </Button>
                            ) : (
                              <Button
                                className={styles.actionButton}
                                variant="contained"
                                startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                                onClick={() => toggleApproval(u)}
                                disabled={approvalUpdatingId === u.membershipId}
                              >
                                Aprobar
                              </Button>
                            ))}
                        </div>
                      </li>
                    ))}
                  </Box>
                )}
              </>
            )}
          </>
        )}

        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Eliminar cuenta</DialogTitle>
          <DialogContent dividers>
            <Typography>
              ¿Eliminar a <strong>{deleteTarget?.alias}</strong> ({deleteTarget?.email})?
              <br />
              <br />
              Esta acción eliminará la cuenta completamente, no solo la desvinculación de este equipo.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={
                deleting ? (
                  <CircularProgress
                    size={16}
                    style={{ color: snackIconColor }}
                  />
                ) : null
              }
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackOpen}
          autoHideDuration={4000}
          onClose={() => setSnackOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity}>
            {snackMsg}
          </Alert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MuiAlert>
>(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});
