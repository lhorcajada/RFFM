import { useState, type KeyboardEvent } from "react";
import { Alert, Box, Button, Drawer, IconButton, TextField, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import type { AssistantChange, AssistantMessage } from "../../../services/gameModelService";
import { canAccept, type TrackedChange } from "./gameModelProposalTree";
import styles from "./GameModelAssistantPanel.module.css";

export interface GameModelAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AssistantMessage[];
  sending: boolean;
  error?: string;
  onSend: (text: string) => void;
  onRetry: () => void;
  /** Accepted changes not saved yet; while there are any, a new request is blocked. */
  unsavedAcceptedCount?: number;
  /** The current proposal, one card per change. Rejected changes are not shown. */
  changes?: TrackedChange[];
  onAccept?: (changeId: string) => void;
  onReject?: (changeId: string) => void;
}

const OPERATION_LABEL: Record<AssistantChange["operation"], string> = {
  add: "Añadir",
  change: "Cambiar",
  remove: "Eliminar",
};

const NODE_LABEL: Record<AssistantChange["nodeType"], string> = {
  principio: "principio",
  subprincipio: "subprincipio",
  zona: "zona",
  subSubPrincipio: "sub-subprincipio",
  habilidad: "habilidad",
  nota: "nota",
  setPieceRule: "regla de balón parado",
};

const TITLE_FIELDS = ["titulo", "rol", "nombre", "label", "tipo", "subtype"];
const TEXT_FIELDS = ["texto", "descripcion", "zonaTexto"];

function firstText(fields: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function ChangeCard({
  change,
  acceptable,
  onAccept,
  onReject,
}: {
  change: TrackedChange;
  acceptable: boolean;
  onAccept?: (changeId: string) => void;
  onReject?: (changeId: string) => void;
}) {
  const title = firstText(change.fields, TITLE_FIELDS);
  const text = firstText(change.fields, TEXT_FIELDS);
  const accepted = change.status === "accepted";

  return (
    <Box className={styles.changeCard}>
      <Typography component="p" className={styles.changeHeading}>
        {OPERATION_LABEL[change.operation]} {NODE_LABEL[change.nodeType]}
      </Typography>
      {title && <Typography component="p" className={styles.changeTitle}>{title}</Typography>}
      {text && <Typography component="p" className={styles.changeText}>{text}</Typography>}
      {accepted ? (
        <Typography component="p" className={styles.changeAccepted}>Aceptado</Typography>
      ) : (
        <Box className={styles.changeActions}>
          <Button size="small" variant="contained" disabled={!acceptable} onClick={() => onAccept?.(change.id)}>
            Aceptar
          </Button>
          <Button size="small" variant="outlined" onClick={() => onReject?.(change.id)}>
            Rechazar
          </Button>
        </Box>
      )}
    </Box>
  );
}

/** Side panel to talk with the game-model assistant. It holds only the text being typed; the conversation comes in through props. */
export default function GameModelAssistantPanel({
  open,
  onClose,
  messages,
  sending,
  error,
  onSend,
  onRetry,
  unsavedAcceptedCount = 0,
  changes = [],
  onAccept,
  onReject,
}: GameModelAssistantPanelProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
  const [draft, setDraft] = useState("");
  const text = draft.trim();
  const mustSaveFirst = unsavedAcceptedCount > 0;
  const canSend = text !== "" && !sending && !mustSaveFirst;

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    send();
  };

  return (
    // Wide screens: a persistent side panel that leaves the page readable. Narrow screens: a full-width overlay.
    <Drawer
      variant={isNarrow ? "temporary" : "persistent"}
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ className: isNarrow ? styles.paperNarrow : styles.paper }}
    >
      <Box className={styles.panel}>
        <Box className={styles.header}>
          <Typography component="h2" className={styles.title}>
            Asistente del modelo
          </Typography>
          <IconButton aria-label="Cerrar asistente" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box component="section" className={styles.notice} aria-label="Datos que recibe el asistente">
          <Typography component="p" className={styles.noticeText}>
            Para responder, el asistente recibe el modelo de juego (principios, subprincipios, zonas, habilidades y notas),
            sus objetivos de temporada, las sesiones cercanas y las previsiones de la liga.
          </Typography>
          <Typography component="p" className={styles.noticeText}>
            De cada jugador recibe su alias, sus lesiones (tipo y fechas) y su condición física: cansancio, rodaje y estado de forma.
          </Typography>
          <Typography component="p" className={styles.noticeText}>
            No se envían datos personales identificativos (nombre, DNI, teléfono ni correo).
          </Typography>
        </Box>

        <Box className={styles.conversation} role="log" aria-live="polite">
          {messages.length === 0 && (
            <p className={styles.empty}>Describe el cambio que quieres revisar en el modelo.</p>
          )}
          {messages.map((message, index) => (
            <Box
              key={index}
              className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}
            >
              <p className={styles.bubbleText}>{message.content}</p>
            </Box>
          ))}
          {changes
            .filter((change) => change.status !== "rejected")
            .map((change) => (
              <ChangeCard
                key={change.id}
                change={change}
                acceptable={canAccept(change, changes)}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))}
          {sending && (
            <p className={styles.status} role="status">
              El asistente está respondiendo…
            </p>
          )}
        </Box>

        {error && (
          <Alert
            severity="error"
            className={styles.alert}
            action={
              <Button color="inherit" size="small" onClick={onRetry}>
                Reintentar
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {mustSaveFirst && (
          <Alert severity="info" className={styles.alert} role="status">
            Guarda los cambios aceptados antes de pedir otra propuesta.
          </Alert>
        )}

        <Box className={styles.composer}>
          <TextField
            className={styles.input}
            size="small"
            placeholder="Escribe tu mensaje"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            inputProps={{ "aria-label": "Mensaje para el asistente" }}
          />
          <Button
            variant="contained"
            size="small"
            className={styles.send}
            onClick={send}
            disabled={!canSend}
            endIcon={<SendIcon fontSize="small" />}
          >
            Enviar
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
