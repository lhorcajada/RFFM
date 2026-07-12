import { useEffect, useRef, useState } from "react";
import { TextField, CircularProgress, InputAdornment } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { invitationsApi } from "../../../../services/invitations/invitationsApi";
import { getErrorMessage } from "../../../../utils/errorMessages";
import type { PreviewClubCodeResponse, PreviewTeamCodeResponse } from "../../../types/scope";
import styles from "./InvitationCodeField.module.css";

type PreviewResponse<K extends "club" | "team"> =
  K extends "club" ? PreviewClubCodeResponse : PreviewTeamCodeResponse;

interface InvitationCodeFieldProps<K extends "club" | "team"> {
  kind: K;
  membershipKind: string;
  onValid: (response: PreviewResponse<K>) => void;
  onInvalid: () => void;
}

const DEBOUNCE_MS = 500;

export default function InvitationCodeField<K extends "club" | "team">({
  kind,
  membershipKind,
  onValid,
  onInvalid,
}: InvitationCodeFieldProps<K>) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!code.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    timeoutRef.current = setTimeout(async () => {
      try {
        const response =
          kind === "club"
            ? await invitationsApi.previewClubCode({ code, membershipKind: membershipKind as any })
            : await invitationsApi.previewTeamCode({ code, membershipKind: membershipKind as any });
        setStatus("valid");
        onValid(response as PreviewResponse<K>);
      } catch (err: any) {
        const message = getErrorMessage(err?.response?.data?.code, err?.response?.data?.detail);
        setStatus("invalid");
        setErrorMessage(message);
        onInvalid();
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, kind]);

  return (
    <TextField
      label={kind === "club" ? "Código de invitación de club" : "Código de invitación de equipo"}
      variant="outlined"
      fullWidth
      className={styles.field}
      value={code}
      onChange={(e) => setCode(e.target.value)}
      error={status === "invalid"}
      helperText={status === "invalid" ? errorMessage : " "}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            {status === "checking" && <CircularProgress size={20} />}
            {status === "valid" && <CheckCircleIcon color="success" />}
          </InputAdornment>
        ),
      }}
    />
  );
}
