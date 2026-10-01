import { useMemo, useState } from "react";
import { MenuItem, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { format, parseISO } from "date-fns";
import ConfirmDialog from "../../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import {
  PERIOD_LABELS,
  periodStart,
  type CreatePlayerObservationRequest,
  type ObservationPeriod,
  type PlayerObservation,
  type UpdatePlayerObservationRequest,
} from "../../../../services/playerTrackingService";
import { usePlayerObservations } from "../../hooks/usePlayerObservations";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { useSubprincipioOptions } from "../../hooks/useSubprincipioOptions";
import ObservationForm from "./ObservationForm";
import PlayerObservationList from "./PlayerObservationList";
import SessionObservationForm from "./SessionObservationForm";
import styles from "./PlayerTrackingPanel.module.css";

const NO_SESSION = "";
const OUT_OF_PERIOD_MESSAGE = "Observación guardada. No se muestra porque es anterior al periodo elegido.";

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function errorDetail(error: unknown): string | undefined {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

type Props = {
  teamId: string;
  teamPlayerId: string;
};

export default function PlayerTrackingPanel({ teamId, teamPlayerId }: Props) {
  const [period, setPeriod] = useState<ObservationPeriod>("month");
  const from = useMemo(() => periodStart(period), [period]);
  const { observations, loading, error, reload, create, update, remove } = usePlayerObservations(
    teamId,
    teamPlayerId,
    from,
  );
  const { options, hasModel, loading: loadingOptions } = useSubprincipioOptions(teamId);
  const { sessions } = useRecentSessions(teamId);
  const [sessionId, setSessionId] = useState(NO_SESSION);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlayerObservation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const session = sessions.find((s) => s.id === sessionId) ?? null;

  const handleSubmit = async (request: CreatePlayerObservationRequest) => {
    setSaving(true);
    try {
      const shown = await create(request);
      showSnackbar(shown ? "Observación guardada" : OUT_OF_PERIOD_MESSAGE, "success");
    } catch (e) {
      showSnackbar(errorDetail(e) ?? "No se pudo guardar la observación", "error");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleSessionSubmit = async (requests: CreatePlayerObservationRequest[]): Promise<number[]> => {
    setSaving(true);
    const failed: number[] = [];
    let firstError: unknown = null;
    let hidden = 0;
    for (const [index, request] of requests.entries()) {
      try {
        if (!(await create(request))) hidden += 1;
      } catch (e) {
        failed.push(index);
        firstError ??= e;
      }
    }
    setSaving(false);

    if (failed.length === 0 && hidden > 0) {
      showSnackbar(OUT_OF_PERIOD_MESSAGE, "success");
    } else if (failed.length === 0) {
      showSnackbar(requests.length === 1 ? "Observación guardada" : `${requests.length} observaciones guardadas`, "success");
    } else {
      showSnackbar(errorDetail(firstError) ?? "No se pudieron guardar algunas observaciones", "error");
    }
    return failed;
  };

  const handleUpdate = async (observationId: string, request: UpdatePlayerObservationRequest) => {
    try {
      await update(observationId, request);
      showSnackbar("Observación actualizada", "success");
    } catch (e) {
      showSnackbar(errorDetail(e) ?? "No se pudo actualizar la observación", "error");
      throw e;
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      showSnackbar("Observación eliminada", "success");
      setDeleteTarget(null);
    } catch (e) {
      showSnackbar(errorDetail(e) ?? "No se pudo eliminar la observación", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.panel}>
      {sessions.length > 0 && (
        <TextField
          select
          label="Sesión"
          size="small"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          fullWidth
        >
          <MenuItem value={NO_SESSION}>Sin sesión</MenuItem>
          {sessions.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {`${format(parseISO(s.date as string), "dd/MM")} · ${s.name}`}
            </MenuItem>
          ))}
        </TextField>
      )}

      {session ? (
        <SessionObservationForm
          key={session.id}
          session={session}
          teamPlayerId={teamPlayerId}
          saving={saving}
          onSubmit={handleSessionSubmit}
        />
      ) : (
        !loadingOptions && (
          <ObservationForm options={options} hasModel={hasModel} saving={saving} onSubmit={handleSubmit} />
        )
      )}

      <div className={styles.listHeader}>
        <h3 className={styles.title}>{`Observaciones (${observations.length})`}</h3>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          onChange={(_, next: ObservationPeriod | null) => next && setPeriod(next)}
          aria-label="Periodo"
        >
          {(Object.keys(PERIOD_LABELS) as ObservationPeriod[]).map((p) => (
            <ToggleButton key={p} value={p} className={styles.periodButton}>
              {PERIOD_LABELS[p]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <PlayerObservationList
        observations={observations}
        loading={loading}
        error={error}
        onRetry={reload}
        onUpdate={handleUpdate}
        onDelete={setDeleteTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar observación"
        description={
          deleteTarget
            ? `¿Eliminar la observación de «${deleteTarget.attitudeLabel ?? deleteTarget.subprincipioLabel}» del ${format(parseISO(deleteTarget.date), "dd/MM/yyyy")}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        processing={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
