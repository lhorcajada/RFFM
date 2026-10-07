import { useCallback, useMemo, useRef, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import type { IdealLineupHandle } from "../squad/components/IdealLineup";
import AlineacionTab from "./components/AlineacionTab";
import ConvocationDeconvokeDialog from "./components/ConvocationDeconvokeDialog";
import FullScreenMatchLayout from "./components/FullScreenMatchLayout";
import MinutesReasonEditor from "./components/MinutesReasonEditor";
import { useMatchFromUrl } from "./hooks/useMatchFromUrl";
import { useMatchSquad } from "./hooks/useMatchSquad";

/** Pantalla completa de la alineación del partido, con el mismo formato que el partido en directo. */
export default function LineupPage() {
  const { teamId, eventId, match, loading, goBackToMatch } = useMatchFromUrl();
  const { convocation, lineupPlayers, notCalledPlayers, pendingPlayers, notAttendingPlayers } =
    useMatchSquad(teamId, match?.date);

  const lineupRef = useRef<IdealLineupHandle>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeconvokeId, setPendingDeconvokeId] = useState<string | null>(null);
  const [pendingDeconvokeExcuse, setPendingDeconvokeExcuse] = useState<number | "">("");

  const attendingPlayers = useMemo(
    () => lineupPlayers.filter((p) => p.assistanceTypeId !== 2 && p.assistanceTypeId !== 3),
    [lineupPlayers],
  );

  const handleDeconvokeRequest = useCallback((playerId: string) => {
    setPendingDeconvokeExcuse("");
    setPendingDeconvokeId(playerId);
  }, []);

  const handleDeconvokeConfirm = useCallback(async () => {
    if (!pendingDeconvokeId || !pendingDeconvokeExcuse) return;
    const playerId = pendingDeconvokeId;
    setPendingDeconvokeId(null);
    await convocation.moveToNotCalled(playerId, pendingDeconvokeExcuse);
  }, [pendingDeconvokeId, pendingDeconvokeExcuse, convocation]);

  const minutesReasonsPlayers = lineupPlayers.map((p) => ({
    id: p.id,
    label: p.alias?.trim() || p.displayName,
    reason: convocation.mgmtMinutesReasonMap?.[p.id] ?? null,
  }));

  const actions = eventId && attendingPlayers.length > 0 && (
    <>
      <Button
        variant="contained"
        size="small"
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        disabled={saving}
        onClick={() => lineupRef.current?.save()}
      >
        Guardar
      </Button>
      <MinutesReasonEditor players={minutesReasonsPlayers} onSave={convocation.saveMinutesReason} />
    </>
  );

  return (
    <FullScreenMatchLayout
      onBack={goBackToMatch}
      actions={actions}
      loading={loading}
      notFound={!match || !eventId}
    >
      <AlineacionTab
        mgmtEventId={eventId}
        lineupPlayers={attendingPlayers}
        notCalledPlayers={notCalledPlayers}
        pendingPlayers={pendingPlayers}
        notAttendingPlayers={notAttendingPlayers}
        lineupRef={lineupRef}
        teamId={teamId}
        onSavingChange={setSaving}
        onDeconvoke={handleDeconvokeRequest}
        onReconvoke={(playerId) => convocation.moveToAvailable(playerId)}
        onAcceptPending={(playerId) => convocation.acceptPending(playerId)}
      />
      <ConvocationDeconvokeDialog
        open={pendingDeconvokeId !== null}
        excuseTypes={convocation.excuseTypes}
        value={pendingDeconvokeExcuse}
        onClose={() => setPendingDeconvokeId(null)}
        onChange={(value) => setPendingDeconvokeExcuse(value)}
        onConfirm={handleDeconvokeConfirm}
      />
    </FullScreenMatchLayout>
  );
}
