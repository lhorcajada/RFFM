import { List, ListItemButton, ListItemAvatar, Avatar, ListItemText, Typography, Alert, Box } from "@mui/material";
import type { TeamRosterPlayer } from "../../../../types/scope";
import styles from "./TeamPlayerPicker.module.css";

interface TeamPlayerPickerProps {
  players: TeamRosterPlayer[];
  role: "Player" | "FamilyMember";
  selectedId: string | null;
  onSelect: (teamPlayerId: string) => void;
}

function initials(name: string, lastName: string | null): string {
  const first = name.trim().charAt(0);
  const second = (lastName ?? "").trim().charAt(0);
  return (first + second).toUpperCase();
}

export default function TeamPlayerPicker({ players, role, selectedId, onSelect }: TeamPlayerPickerProps) {
  if (players.length === 0) {
    return (
      <Alert severity="warning" className={styles.emptyAlert}>
        Este equipo todavía no tiene jugadores en su plantilla.
      </Alert>
    );
  }

  return (
    <Box className={styles.listWrap}>
      <List>
        {players.map((p) => {
          const disabled = role === "Player" && p.alreadyLinked;
          const fullName = `${p.name} ${p.lastName ?? ""}`.trim();
          return (
            <ListItemButton
              key={p.teamPlayerId}
              aria-label={fullName}
              selected={selectedId === p.teamPlayerId}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => !disabled && onSelect(p.teamPlayerId)}
              className={styles.row}
            >
              <ListItemAvatar>
                <Avatar src={p.urlPhoto ?? undefined}>
                  {!p.urlPhoto && initials(p.name, p.lastName)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                className={styles.rowText}
                primary={fullName}
                secondary={
                  <>
                    {p.dorsal != null && `Dorsal ${p.dorsal}`}
                    {disabled && (
                      <Typography component="span" variant="caption" className={styles.linkedCaption}>
                        {" "}· Ya vinculado
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
