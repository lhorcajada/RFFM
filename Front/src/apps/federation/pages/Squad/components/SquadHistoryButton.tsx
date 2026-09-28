import React, { useState } from "react";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  requestSquadHistory,
  squadHistoryPath,
} from "../../../services/squadHistoryService";

type Props = {
  teamCode: string;
  teamName: string;
  seasonId: number;
  className?: string;
};

function showSnackbar(message: string, severity: "info" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

export default function SquadHistoryButton({ teamCode, teamName, seasonId, className }: Props): JSX.Element {
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);

  const handleClick = async () => {
    setRequesting(true);
    try {
      const result = await requestSquadHistory(teamCode, { seasonId, teamName, refresh: false });
      if (result.status === "Completed") {
        navigate(squadHistoryPath(teamCode, seasonId));
        return;
      }
      showSnackbar(
        "Estamos recopilando el historial. Te avisaremos con una notificación cuando esté listo.",
        "info",
      );
    } catch {
      showSnackbar("No se pudo solicitar el historial de la plantilla.", "error");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Button size="small" variant="outlined" className={className} disabled={requesting} onClick={handleClick}>
      {requesting ? "Solicitando..." : "Historial"}
    </Button>
  );
}
