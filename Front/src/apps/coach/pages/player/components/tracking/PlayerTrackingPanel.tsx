import { useState } from "react";
import type { CreatePlayerObservationRequest } from "../../../../services/playerTrackingService";
import { usePlayerObservations } from "../../hooks/usePlayerObservations";
import { useSubprincipioOptions } from "../../hooks/useSubprincipioOptions";
import ObservationForm from "./ObservationForm";
import PlayerObservationList from "./PlayerObservationList";
import styles from "./PlayerTrackingPanel.module.css";

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
  const [saving, setSaving] = useState(false);

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

  return (
    <div className={styles.panel}>
      {!loadingOptions && (
        <ObservationForm options={options} hasModel={hasModel} saving={saving} onSubmit={handleSubmit} />
      )}
      <h3 className={styles.title}>Observaciones</h3>
      <PlayerObservationList observations={observations} loading={loading} error={error} onRetry={reload} />
    </div>
  );
}
