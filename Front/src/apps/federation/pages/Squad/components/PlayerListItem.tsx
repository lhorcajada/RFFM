import React from "react";
import {
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../../../shared/components/ui/CardIcons/CardIcons";
import playersStyles from "../components/players/PlayersContainer/PlayersContainer.module.css";
import type { Player } from "../hooks/usePlayers";

interface Props {
  player: Player;
  expandedId: number | null;
  loadingDetail: number | null;
  onToggleDetails: (p: Player) => Promise<void>;
}

export default function PlayerListItem({
  player,
  expandedId,
  loadingDetail,
  onToggleDetails,
}: Props) {
  const p = player;
  const goals =
    (p as any).matches?.totalGoals ??
    (p as any).matches?.goles ??
    (p as any).matches?.goals ??
    0;
  return (
    <div>
      <ListItem
        divider
        secondaryAction={
          <IconButton
            size="small"
            disabled={loadingDetail !== null}
            onClick={() => onToggleDetails(p)}
          >
            {loadingDetail === p.id ? (
              <CircularProgress size={16} />
            ) : expandedId === p.id ? (
              <VisibilityOffIcon fontSize="small" />
            ) : (
              <VisibilityIcon fontSize="small" />
            )}
          </IconButton>
        }
      >
        <div className={playersStyles.jerseyBadge} style={{ marginRight: 12 }}>
          <div className={playersStyles.jerseyShirt}>
            <svg
              viewBox="0 0 64 64"
              width={44}
              height={44}
              aria-hidden="true"
              role="img"
            >
              <g fill="none" fillRule="evenodd">
                <path
                  d="M8 14c0 0 6-4 12-4s6 2 12 2 6-2 12-2 12 4 12 4v28c0 4-4 8-8 8H16c-4 0-8-4-8-8V14z"
                  fill="#2C7BE5"
                  stroke="#08306B"
                  strokeWidth="1.2"
                />
                <rect
                  x="20"
                  y="22"
                  width="24"
                  height="18"
                  rx="3"
                  fill="#FFF"
                  opacity="0.08"
                />
              </g>
            </svg>
            <div
              className="jerseyNumber"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontWeight: 800,
                color: "#000",
              }}
            >
              {p.jerseyNumber ?? ""}
            </div>
          </div>
          {p.age ? (
            <div className={playersStyles.ageChip}>Edad: {p.age}</div>
          ) : (
            <div className={playersStyles.ageChip} />
          )}
        </div>
        <ListItemText
          primary={<span className={playersStyles.playerName}>{p.name}</span>}
          secondary={
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {p.email || ""}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: 6,
                  }}
                >
                  <SportsSoccerIcon
                    fontSize="small"
                    style={{ color: "#ffffff" }}
                  />
                  <span
                    style={{
                      color: "#ffffff",
                      fontWeight: 900,
                      fontSize: 16,
                      lineHeight: "1",
                      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    {goals}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginLeft: 8,
                    }}
                    title={`Tarjetas`}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <YellowCardIcon />
                      <span
                        style={{
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {(p as any).cards?.yellow ??
                          (p as any).cards?.amarillas ??
                          0}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <RedCardIcon />
                      <span
                        style={{
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {(p as any).cards?.red ?? (p as any).cards?.rojas ?? 0}
                      </span>
                    </span>
                  </span>
                </span>
              </span>
            </span>
          }
        />
      </ListItem>
    </div>
  );
}
