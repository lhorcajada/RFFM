import React from "react";
import { useNavigate } from "react-router-dom";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import {
  acquireCoachTrial,
  getMyRoles,
} from "../../../../apps/coach/services/coachApi";
import useTempToken from "../../../../apps/coach/hooks/useTempToken";
import { useUser } from "../../../context/UserContext";

function dispatchSnackbar(message: string, severity = "warning") {
  try {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", {
        detail: { message, severity },
      })
    );
  } catch {}
}

export function useCoachTrial() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { generateTempToken } = useTempToken();
  const { user } = useUser();

  function openDialog() {
    setConfirmOpen(true);
  }

  function closeDialog() {
    setConfirmOpen(false);
  }

  async function handleAccept() {
    try {
      setIsProcessing(true);

      let tempToken: string | undefined = undefined;
      try {
        const payload: Record<string, string> = {};
        if (user?.id) payload.sub = user.id;
        if (user?.email) payload.email = user.email;
        tempToken = await generateTempToken(payload);
      } catch {}

      const result = await acquireCoachTrial(tempToken);

      if ((result as any)?.roles) {
        try {
          localStorage.setItem("coach_roles", JSON.stringify((result as any).roles));
        } catch {}
      }

      if ((result as any)?.token) {
        const tokenStr = (result as any).token;
        try {
          localStorage.setItem("coachAuthToken", tokenStr);
          const decoded = JSON.parse(atob(tokenStr.split(".")[1]));
          const extractedUserId =
            decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
            decoded.sub;
          if (extractedUserId) {
            localStorage.setItem("coachUserId", extractedUserId);
          }
          try {
            const evtDetail: Record<string, unknown> = { token: tokenStr };
            if ((result as any)?.roles) {
              evtDetail.roles = (result as any).roles;
            } else {
              const storedRoles = localStorage.getItem("coach_roles");
              if (storedRoles) evtDetail.roles = JSON.parse(storedRoles);
            }
            window.dispatchEvent(new CustomEvent("rffm.coach_token_updated", { detail: evtDetail }));
            await new Promise((r) => setTimeout(r, 120));
          } catch {}
        } catch {}
      } else {
        try {
          const freshRoles = await getMyRoles();
          if (Array.isArray(freshRoles) && freshRoles.length > 0) {
            try { localStorage.setItem("coach_roles", JSON.stringify(freshRoles)); } catch {}
            try {
              const evtDetail: Record<string, unknown> = { roles: freshRoles };
              window.dispatchEvent(new CustomEvent("rffm.coach_token_updated", { detail: evtDetail }));
              await new Promise((r) => setTimeout(r, 120));
            } catch {}
          }
        } catch (e) {
        }
      }

      const waitForCoachRole = async (timeout = 1000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          try {
            const has = coachAuthService.hasRole("Coach");
            const rolesNow = coachAuthService.getRoles();
            
            if (has) return true;
          } catch {}
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };

      const ok = await waitForCoachRole(3000);
      
      navigate("/coach/dashboard");

      dispatchSnackbar("Licencia activada. ¡Disfruta 7 días!", "success");
    } catch (e: any) {
      dispatchSnackbar(
        e?.response?.data?.message ?? "Error activando la licencia.",
        "error"
      );
    } finally {
      setIsProcessing(false);
      setConfirmOpen(false);
    }
  }

  return { confirmOpen, isProcessing, openDialog, closeDialog, handleAccept };
}
