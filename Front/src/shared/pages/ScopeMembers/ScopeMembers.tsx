import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MuiAlert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../components/ui/ContentLayout/ContentLayout";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import styles from "./ScopeMembers.module.css";
import { scopesApi } from "../../services/scopes/scopesApi";
import type {
  ScopeMember,
  MembershipKind,
  ProblemDetails,
} from "../../types/scope";

type ScopeKind = "club" | "team";

function isAxiosErrorWithProblem(
  err: unknown,
): { status?: number; problem?: ProblemDetails } | null {
  const anyErr = err as any;
  if (!anyErr || typeof anyErr !== "object") return null;
  const response = anyErr.response;
  if (!response) return null;
  return { status: response.status, problem: response.data as ProblemDetails };
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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

const KIND_COLORS: Record<MembershipKind, "default" | "primary" | "secondary" | "success" | "warning" | "info" | "error"> = {
  Coach: "primary",
  Directive: "secondary",
  ClubMember: "info",
  Player: "success",
  FamilyPlayer: "warning",
  Follower: "default",
};

export default function ScopeMembers(): JSX.Element {
  const [searchParams] = useSearchParams();
  const scopeKind: ScopeKind = (searchParams.get("scope") as ScopeKind) === "team" ? "team" : "club";
  const scopeId = searchParams.get("id") ?? "";

  const [members, setMembers] = useState<ScopeMember[]>([]);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<"success" | "error" | "warning" | "info">("success");

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ScopeMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const invalidScope = !scopeId;

  function showSnack(message: string, severity: typeof snackSeverity = "success") {
    setSnackMsg(message);
    setSnackSeverity(severity);
    setSnackOpen(true);
  }

  async function loadAll() {
    if (invalidScope) return;
    setLoading(true);
    try {
      const [inv, list] = await Promise.all([
        scopesApi.getInvitation(scopeKind, scopeId),
        scopesApi.listScopeMembers(scopeKind === "club" ? { clubId: scopeId } : { teamId: scopeId }),
      ]);
      setCode(inv.code);
      setMembers(list);
    } catch (err) {
      showSnack(problemMessage(err, "Error al cargar los miembros."), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKind, scopeId]);

  async function confirmRotate() {
    setRotating(true);
    try {
      const res = await scopesApi.regenerateInvitation({ scopeKind, scopeId });
      setCode(res.newCode);
      setRotateOpen(false);
      showSnack("Código rotado correctamente.", "success");
    } catch (err) {
      showSnack(problemMessage(err, "Error al rotar el código."), "error");
    } finally {
      setRotating(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await scopesApi.removeScopeMember(removeTarget.membershipId);
      setMembers((prev) => prev.filter((m) => m.membershipId !== removeTarget.membershipId));
      setRemoveTarget(null);
      showSnack("Miembro desvinculado.", "success");
    } catch (err) {
      showSnack(problemMessage(err, "Error al desvincular al miembro."), "error");
    } finally {
      setRemoving(false);
    }
  }

  const title = useMemo(
    () => (scopeKind === "club" ? "Gestión de miembros del club" : "Gestión de miembros del equipo"),
    [scopeKind],
  );

  const snackIconColor = "currentColor";

  return (
    <BaseLayout>
      <ContentLayout title={title}>
        {invalidScope ? (
          <Paper className={styles.codePaper}>
            <Typography color="error">
              Falta el identificador del scope. Usa <code>?scope=club&id=...</code> o{" "}
              <code>?scope=team&id=...</code>.
            </Typography>
          </Paper>
        ) : (
          <>
            <Paper className={styles.codePaper} elevation={2}>
              <Box className={styles.codeBlock}>
                <Typography variant="subtitle2" color="textSecondary">
                  Código de invitación actual
                </Typography>
                <span className={styles.codeValue}>{code || "—"}</span>
              </Box>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={() => setRotateOpen(true)}
                disabled={loading}
              >
                Rotar código
              </Button>
            </Paper>

            {loading ? (
              <Box className={styles.loadingOverlay}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} className={styles.tableWrap}>
                <Table aria-label="miembros del scope">
                  <TableHead>
                    <TableRow>
                      <TableCell>Alias</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Rol</TableCell>
                      <TableCell>Fecha de alta</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography className={styles.textMuted}>
                            No hay miembros en este espacio todavía.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {members.map((m) => (
                      <TableRow key={m.membershipId}>
                        <TableCell>{m.alias}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>
                          {m.isCreator ? (
                            <Chip
                              label="Creador"
                              color="primary"
                              size="small"
                              className={styles.creatorChip}
                            />
                          ) : (
                            <Chip
                              label={m.membershipKind}
                              color={KIND_COLORS[m.membershipKind] ?? "default"}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(m.joinedAt)}</TableCell>
                        <TableCell align="right">
                          {!m.isCreator && (
                            <IconButton
                              aria-label={`Desvincular a ${m.alias}`}
                              size="small"
                              onClick={() => setRemoveTarget(m)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        <Dialog open={rotateOpen} onClose={() => setRotateOpen(false)}>
          <DialogTitle>Rotar código de invitación</DialogTitle>
          <DialogContent dividers>
            <Typography>
              Esto invalidará el código actual <strong>{code}</strong> y generará uno
              nuevo. Los usuarios con el código anterior ya no podrán unirse con él.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRotateOpen(false)} disabled={rotating}>
              Cancelar
            </Button>
            <Button
              onClick={confirmRotate}
              color="primary"
              variant="contained"
              disabled={rotating}
              startIcon={rotating ? <CircularProgress size={16} style={{ color: snackIconColor }} /> : null}
            >
              {rotating ? "Rotando..." : "Rotar"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
          <DialogTitle>Desvincular miembro</DialogTitle>
          <DialogContent dividers>
            <Typography>
              ¿Desvincular a <strong>{removeTarget?.alias}</strong> ({removeTarget?.email})?
              El usuario quedará libre para unirse a otro espacio.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancelar
            </Button>
            <Button
              onClick={confirmRemove}
              color="error"
              variant="contained"
              disabled={removing}
              startIcon={removing ? <CircularProgress size={16} style={{ color: snackIconColor }} /> : null}
            >
              {removing ? "Desvinculando..." : "Desvincular"}
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

const Alert = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MuiAlert>>(
  function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  },
);