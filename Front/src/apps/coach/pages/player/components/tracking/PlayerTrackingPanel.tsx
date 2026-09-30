import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import { format, parseISO } from "date-fns";
import type { CreatePlayerObservationRequest } from "../../../../services/playerTrackingService";
import { usePlayerObservations } from "../../hooks/usePlayerObservations";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { useSubprincipioOptions } from "../../hooks/useSubprincipioOptions";
import ObservationForm from "./ObservationForm";
import PlayerObservationList from "./PlayerObservationList";
import SessionObservationForm from "./SessionObservationForm";
import styles from "./PlayerTrackingPanel.module.css";

const NO_SESSION = "";

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
  const { observations, loading, error, reload, create } = usePlayerObservations(teamId, teamPlayerId);
  const { options, hasModel, loading: loadingOptions } = useSubprincipioOptions(teamId);
  const { sessions } = useRecentSessions(teamId);
  const [sessionId, setSessionId] = useState(NO_SESSION);
  const [saving, setSaving] = useState(false);

  const session = sessions.find((s) => s.id === sessionId) ?? null;

  const handleSubmit = async (request: CreatePlayerObservationRequest) => {
    setSaving(true);
    try {
      await create(request);
      showSnackbar("Observación guardada", "success");
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
    for (const [index, request] of requests.entries()) {
      try {
        await create(request);
      } catch (e) {
        failed.push(index);
        firstError ??= e;
      }
    }
    setSaving(false);

    if (failed.length === 0) {
      showSnackbar(requests.length === 1 ? "Observación guardada" : `${requests.length} observaciones guardadas`, "success");
    } else {
      showSnackbar(errorDetail(firstError) ?? "No se pudieron guardar algunas observaciones", "error");
    }
    return failed;
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

      <h3 className={styles.title}>Observaciones</h3>
      <PlayerObservationList observations={observations} loading={loading} error={error} onRetry={reload} />
    </div>
  );
}
