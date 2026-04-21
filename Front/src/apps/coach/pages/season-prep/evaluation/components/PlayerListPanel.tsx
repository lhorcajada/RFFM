import { useState } from "react";
import { InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import type { PoolPlayer } from "../../SeasonPrep";
import { usePlayerGroupsByPosition } from "../hooks/usePlayerGroups";
import { PlayerListItem } from "./PlayerListItem";
import styles from "./PlayerListPanel.module.css";

interface PlayerListPanelProps {
  players: PoolPlayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlayerListPanel({ players, selectedId, onSelect }: PlayerListPanelProps) {
  const [query, setQuery] = useState("");
  const groups = usePlayerGroupsByPosition(players);

  const filtered = query.trim()
    ? players.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : null;

  return (
    <div className={styles.panel}>
      <div className={styles.searchRow}>
        <TextField
          size="small"
          placeholder="Buscar jugador…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: "1.1rem", opacity: 0.5 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              fontSize: "0.88rem",
            },
          }}
        />
      </div>

      <div className={styles.list}>
        {/* ── Search results (flat) ──────────────────────── */}
        {filtered !== null ? (
          filtered.length === 0 ? (
            <p className={styles.empty}>Sin resultados</p>
          ) : (
            filtered.map((player) => (
              <PlayerListItem
                key={player.uniqueId}
                player={player}
                selected={selectedId === player.uniqueId}
                onSelect={() => onSelect(player.uniqueId)}
              />
            ))
          )
        ) : (
          /* ── Grouped by position → team ───────────────── */
          groups.map(({ position, teams }) => (
            <div key={position}>
              <div className={styles.positionHeader}>{position}</div>
              {teams.map(({ label, players: teamPlayers }) => (
                <div key={label}>
                  <div className={styles.teamHeader}>{label}</div>
                  {teamPlayers.map((player) => (
                    <PlayerListItem
                      key={player.uniqueId}
                      player={player}
                      selected={selectedId === player.uniqueId}
                      onSelect={() => onSelect(player.uniqueId)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
