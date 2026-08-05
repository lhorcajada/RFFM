import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import teamRulesService, { type TeamRulesDto } from "../../services/teamRulesService";
import styles from "./TeamRules.module.css";

export default function TeamRules() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, teamTitleNode } = useTeamAndClub();
  const goToTeamDashboard = useTeamDashboardBack();
  const { featurePermissions, roles } = usePermissions();

  const [rules, setRules] = useState<TeamRulesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit =
    roles.includes("Administrator") ||
    featurePermissions.some(
      (p) => p.featureRoute === COACH_FEATURE_ROUTES.TeamRulesDocument && p.permissionType === "ReadWrite"
    );

  const loadRules = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const result = await teamRulesService.getTeamRules(teamId);
      setRules(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!team?.id) return;
    void loadRules(team.id);
  }, [team, loadRules]);

  const handleDelete = async () => {
    if (!team?.id) return;
    setDeleting(true);
    try {
      await teamRulesService.deleteTeamRules(team.id);
      setDeleteDialogOpen(false);
      setRules(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Normas del Equipo"
        subtitle={teamTitleNode}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {canEdit && !loading && !rules && (
              <Button
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => navigate(`/coach/team-rules/edit${location.search}`)}
                variant="contained"
                size="small"
                color="primary"
              >
                Crear Normas
              </Button>
            )}
            {canEdit && rules && (
              <Button
                startIcon={<EditNoteIcon />}
                onClick={() => navigate(`/coach/team-rules/edit${location.search}`)}
                variant="outlined"
                size="small"
              >
                Editar
              </Button>
            )}
            {canEdit && rules && (
              <Button
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                variant="outlined"
                size="small"
                color="error"
              >
                Eliminar
              </Button>
            )}
          </>
        }
      >
        {loading ? (
          <Box className={styles.loadingBox}>
            <CircularProgress color="primary" />
          </Box>
        ) : !rules ? (
          <Box className={styles.emptyState}>
            <Typography className={styles.emptyStateText}>
              Aún no disponible. {canEdit ? "Usa el botón " : ""}
              {canEdit && <strong>Crear Normas</strong>}
              {canEdit ? " para empezar." : ""}
            </Typography>
          </Box>
        ) : (
          <Box className={styles.page}>
            <Box className={styles.header}>
              <Typography className={styles.title}>{rules.title}</Typography>
              <Typography className={styles.subtitle}>{rules.subtitle}</Typography>
            </Box>

            <Typography className={styles.introNote}>{rules.introNote}</Typography>

            <Box className={styles.rulesList}>
              {rules.rules
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((rule) => (
                  <Card key={rule.id} className={styles.ruleCard} variant="outlined">
                    <CardContent>
                      <Box className={styles.ruleHeader}>
                        <Chip label={rule.order} size="small" className={styles.ruleOrderChip} />
                        <Typography className={styles.ruleTitle}>{rule.shortTitle}</Typography>
                      </Box>
                      {rule.highlight && (
                        <Typography className={styles.ruleHighlight}>{rule.highlight}</Typography>
                      )}
                      <Box className={styles.ruleSummaryRow}>
                        <Typography className={styles.ruleSummaryLabel}>Incumplimiento:</Typography>
                        <Typography className={styles.ruleSummaryValue}>{rule.violationSummary}</Typography>
                      </Box>
                      <Box className={styles.ruleSummaryRow}>
                        <Typography className={styles.ruleSummaryLabel}>Consecuencia:</Typography>
                        <Typography className={styles.ruleSummaryValue}>{rule.consequenceSummary}</Typography>
                      </Box>
                      {rule.longDescription && (
                        <Typography className={styles.ruleDescription}>{rule.longDescription}</Typography>
                      )}
                      {rule.bulletPoints && rule.bulletPoints.length > 0 && (
                        <Box component="ul" className={styles.ruleBullets}>
                          {rule.bulletPoints.map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </Box>
                      )}
                      {rule.consequenceDetail && (
                        <Typography className={styles.ruleConsequenceDetail}>{rule.consequenceDetail}</Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </Box>

            {rules.closingNote && (
              <Typography className={styles.closingNote}>{rules.closingNote}</Typography>
            )}
            {rules.applicationNote && (
              <Typography className={styles.applicationNote}>{rules.applicationNote}</Typography>
            )}
          </Box>
        )}
      </ContentLayout>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar normas del equipo</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que quieres eliminar las normas del equipo? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small" disabled={deleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            size="small"
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={16} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
