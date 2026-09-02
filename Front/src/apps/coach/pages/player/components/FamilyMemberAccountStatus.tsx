import React, { useEffect, useState } from "react";
import { Alert, Button, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import styles from "../PlayerDetail.module.css";
import {
  approveFamilyMemberAccountRequest,
  registerFamilyMemberAccount,
  rejectFamilyMemberAccountRequest,
  type FamilyResponse,
} from "../../../services/teamplayerService";
import { mapApiErrorToMessage } from "../../../../../shared/utils/errorMessages";
import {
  clearFamilyMemberCredentials,
  getFamilyMemberCredentials,
  saveFamilyMemberCredentials,
  type FamilyMemberCredentials,
} from "../utils/familyMemberCredentials";
import WhatsAppCredentialsDialog from "./WhatsAppCredentialsDialog";
import { useIsPlayerRole } from "../../../hooks/useIsPlayerRole";

type Props = {
  familyMember: FamilyResponse;
  playerName: string;
  onStatusChange: (familyMemberId: string, status: string) => void;
};

/**
 * El código `UserCreationFailed` comparte una traducción genérica en `errors.json`
 * con el resto del proyecto (creación de usuarios en general). En el registro de
 * familiares, el `detail` que envía el backend es información específica y útil
 * (el email exacto que ya está en uso), así que aquí lo priorizamos sobre el
 * mensaje genérico. El resto de códigos sigue el mapeo i18n estándar.
 */
function resolveRegisterErrorMessage(e: unknown): string {
  const response = (e as { response?: { data?: { code?: string; detail?: string } } })?.response;
  if (response?.data?.code === "UserCreationFailed" && response.data.detail) {
    return response.data.detail;
  }
  return mapApiErrorToMessage(e);
}

export default function FamilyMemberAccountStatus({ familyMember, playerName, onStatusChange }: Props) {
  const isPlayerRole = useIsPlayerRole();
  const status = familyMember.registrationStatus ?? "None";
  const [registering, setRegistering] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<FamilyMemberCredentials | null>(null);

  useEffect(() => {
    setCredentials(getFamilyMemberCredentials(familyMember.id));
  }, [familyMember.id, status]);

  const hasEmail = Boolean(familyMember.email && familyMember.email.trim());

  if (isPlayerRole) {
    return null;
  }

  async function handleRegister() {
    if (!hasEmail) return;
    setRegistering(true);
    setError(null);
    try {
      const result = await registerFamilyMemberAccount(familyMember.id);
      const greetingName = familyMember.name?.trim() || result.familyMemberName;
      const saved: FamilyMemberCredentials = {
        requestId: result.requestId,
        alias: result.alias,
        password: result.password,
        familyMemberName: greetingName,
        playerName: result.playerName || playerName,
      };
      saveFamilyMemberCredentials(familyMember.id, saved);
      setCredentials(saved);
      onStatusChange(familyMember.id, "Pending");
      setDialogOpen(true);
    } catch (e) {
      setError(resolveRegisterErrorMessage(e));
    } finally {
      setRegistering(false);
    }
  }

  async function handleApprove() {
    if (!credentials?.requestId) return;
    setApproving(true);
    setError(null);
    try {
      await approveFamilyMemberAccountRequest(credentials.requestId);
      onStatusChange(familyMember.id, "Approved");
    } catch (e) {
      setError(mapApiErrorToMessage(e));
    } finally {
      setApproving(false);
    }
  }

  async function handleRejectAndReregister() {
    if (!credentials?.requestId) return;
    setRejecting(true);
    setError(null);
    try {
      await rejectFamilyMemberAccountRequest(credentials.requestId);
      clearFamilyMemberCredentials(familyMember.id);
      setCredentials(null);
      onStatusChange(familyMember.id, "None");
      await handleRegister();
    } catch (e) {
      setError(mapApiErrorToMessage(e));
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className={styles.memberAccountRow}>
      {status === "None" && (
        <Tooltip title={hasEmail ? "" : "El familiar necesita un email guardado para poder registrarse"}>
          <span>
            <Button size="small" variant="outlined" disabled={!hasEmail || registering} onClick={handleRegister}>
              {registering ? "Registrando..." : "Registrar en la app"}
            </Button>
          </span>
        </Tooltip>
      )}

      {status === "Pending" && (
        <>
          <span className={styles.statusPendingBadge}>
            <HourglassEmptyIcon fontSize="inherit" /> Pendiente de aprobación
          </span>
          {credentials?.requestId ? (
            <>
              <Button size="small" variant="outlined" disabled={approving || rejecting} onClick={handleApprove}>
                {approving ? "Aprobando..." : "Aprobar"}
              </Button>
              <Tooltip title="Genera una contraseña nueva si el familiar perdió la anterior">
                <span>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={approving || rejecting}
                    onClick={handleRejectAndReregister}
                  >
                    {rejecting ? "Regenerando..." : "Rechazar y volver a registrar"}
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <Typography variant="caption" color="textSecondary">
              No se encontraron los datos de esta solicitud en este navegador.
            </Typography>
          )}
          {credentials && (
            <Button
              size="small"
              startIcon={<WhatsAppIcon fontSize="small" />}
              onClick={() => setDialogOpen(true)}
            >
              Ver mensaje de WhatsApp
            </Button>
          )}
        </>
      )}

      {status === "Approved" && (
        <>
          <span className={styles.statusApprovedBadge}>
            <CheckCircleIcon fontSize="inherit" /> Cuenta activa
          </span>
          {credentials && (
            <Button
              size="small"
              startIcon={<WhatsAppIcon fontSize="small" />}
              onClick={() => setDialogOpen(true)}
            >
              Ver mensaje de WhatsApp
            </Button>
          )}
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1, width: "100%" }}>
          {error}
        </Alert>
      )}

      {credentials && (
        <WhatsAppCredentialsDialog open={dialogOpen} credentials={credentials} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}
