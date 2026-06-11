import { useEffect, useState } from "react";
import type { TeamResponse } from "../../../services/teamService";
import { getTeams } from "../../../services/teamService";
import { getUserClubs } from "../../../services/clubService";

interface UseUserTeamsState {
  teams: TeamResponse[];
  loading: boolean;
  error: string | null;
}

export function useUserTeams(): UseUserTeamsState {
  const [state, setState] = useState<UseUserTeamsState>({
    teams: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadUserTeams() {
      try {
        // Get all clubs for the current user
        const userClubs = await getUserClubs();

        if (!mounted) return;

        // Get teams for all clubs
        const allTeams: TeamResponse[] = [];
        for (const club of userClubs) {
          try {
            const clubTeams = await getTeams(club.clubId);
            if (mounted) {
              allTeams.push(...clubTeams);
            }
          } catch (err) {
            // Log error but continue with other clubs
            console.error(`Error loading teams for club ${club.clubId}:`, err);
          }
        }

        if (mounted) {
          setState({
            teams: allTeams,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (mounted) {
          console.error("Error loading user teams:", err);
          setState({
            teams: [],
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Error loading teams",
          });
        }
      }
    }

    loadUserTeams();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
