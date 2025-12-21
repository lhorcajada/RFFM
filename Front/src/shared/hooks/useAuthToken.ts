import React from "react";
import { coachAuthService } from "../../apps/coach/services/authService";

interface UseAuthTokenResult {
  token: string | null;
  isAuthValid: boolean;
  refresh: () => void;
}

export default function useAuthToken(): UseAuthTokenResult {
  const [token, setToken] = React.useState<string | null>(
    coachAuthService.getToken()
  );
  const [isAuthValid, setIsAuthValid] = React.useState<boolean>(
    coachAuthService.isAuthenticated()
  );

  React.useEffect(() => {
    const update = () => {
      setToken(coachAuthService.getToken());
      setIsAuthValid(coachAuthService.isAuthenticated());
    };

    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === "coachAuthToken") update();
    };

    window.addEventListener(
      "rffm.coach_token_updated",
      update as EventListener
    );
    window.addEventListener("rffm.auth_expired", update as EventListener);
    window.addEventListener("rffm.logout", update as EventListener);
    window.addEventListener("rffm.login_success", update as EventListener);
    window.addEventListener("storage", storageHandler as EventListener);

    return () => {
      window.removeEventListener(
        "rffm.coach_token_updated",
        update as EventListener
      );
      window.removeEventListener("rffm.auth_expired", update as EventListener);
      window.removeEventListener("rffm.logout", update as EventListener);
      window.removeEventListener("rffm.login_success", update as EventListener);
      window.removeEventListener("storage", storageHandler as EventListener);
    };
  }, []);

  const refresh = React.useCallback(() => {
    setToken(coachAuthService.getToken());
    setIsAuthValid(coachAuthService.isAuthenticated());
  }, []);

  return { token, isAuthValid, refresh };
}
