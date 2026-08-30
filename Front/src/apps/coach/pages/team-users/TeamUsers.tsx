import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MuiAlert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
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
import styles from "./TeamUsers.module.css";
import teamUsersService from "../../services/teamUsersService";
import type {
  TeamUserDto,
  GetTeamUsersResponse,
} from "../../services/teamUsersService";
import type { MembershipKind } from "../../../../shared/types/scope";

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

const KIND_COLORS: Record<
  MembershipKind,
  "default" | "primary" | "secondary" | "success" | "warning" | "info" | "error"
> = {
  Coach: "primary",
  Directive: "secondary",
  ClubMember: "info",
  Player: "success",
  FamilyPlayer: "warning",
  Follower: "default",
};

const KIND_LABELS: Record<MembershipKind, string> = {
  Coach: "Entrenador",
  Directive: "Directivo de club",
  ClubMember: "Miembro de club",
  Player: "Jugador",
  FamilyPlayer: "Familiar de jugador",
  Follower: "Seguidor",
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

  const invalidTeamId = !teamId;

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
            ) : users.length === 0 ? (
              <Paper className={styles.messagePaper}>
                <Typography className={styles.textMuted}>
                  No hay usuarios en este equipo todavía.
                </Typography>
              </Paper>
            ) : (
              <Box
                component="ul"
                role="list"
                aria-label="usuarios del equipo"
                className={styles.cardList}
              >
                {users.map((u) => (
                  <Card component="li" key={u.membershipId} className={styles.card}>
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle1" component="h3" className={styles.alias}>
                            {u.alias}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {u.email}
                          </Typography>
                        </Box>
                        {canDelete(u, callerIsCreator) && (
                          <IconButton
                            aria-label={`Eliminar a ${u.alias}`}
                            size="small"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>

                      <Stack direction="row" flexWrap="wrap" spacing={1} className={styles.chipsRow}>
                        {u.isCreator ? (
                          <Chip label="Creador" color="primary" size="small" />
                        ) : (
                          <Chip
                            label={KIND_LABELS[u.membershipKind] ?? u.membershipKind}
                            color={KIND_COLORS[u.membershipKind] ?? "default"}
                            size="small"
                          />
                        )}
                        <Chip
                          label={u.isApproved ? "Aprobado" : "Pendiente de aprobación"}
                          color={u.isApproved ? "success" : "error"}
                          size="small"
                          variant={u.isApproved ? "outlined" : "filled"}
                        />
                      </Stack>

                      {canToggleApproval(u) && (
                        <Stack direction="row" justifyContent="flex-end" className={styles.approvalRow}>
                          {u.isApproved ? (
                            <Button
                              size="small"
                              color="error"
                              startIcon={<BlockIcon fontSize="small" />}
                              onClick={() => toggleApproval(u)}
                              disabled={approvalUpdatingId === u.membershipId}
                            >
                              Desaprobar
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              color="success"
                              startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                              onClick={() => toggleApproval(u)}
                              disabled={approvalUpdatingId === u.membershipId}
                            >
                              Aprobar
                            </Button>
                          )}
                        </Stack>
                      )}

                      {u.linkedPlayerFullName && (
                        <Typography variant="body2" className={styles.linkedPlayer}>
                          Jugador vinculado: <strong>{u.linkedPlayerFullName}</strong>
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary" component="p">
                        Alta: {formatDate(u.joinedAt)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
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
