import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import teamService, { TeamResponse } from "../services/teamService";
import clubService from "../services/clubService";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";

export default function useTeamAndClub() {
  const location = useLocation();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [teamTitleNode, setTeamTitleNode] = useState<React.ReactNode | null>(
    null
  );
  const [clubSubtitleNode, setClubSubtitleNode] =
    useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let createdObjUrls: string[] = [];

    async function load() {
      setLoading(true);
      const params = new URLSearchParams(location.search);
      const teamId = params.get("teamId");
      if (!teamId) {
        if (mounted) {
          setTeam(null);
          setTeamTitleNode(null);
          setClubSubtitleNode(null);
          setLoading(false);
        }
        return;
      }

      try {
        const t = await teamService.getTeamById(teamId);
        if (!mounted) return;
        if (!t) {
          setTeam(null);
          setTeamTitleNode(null);
          setClubSubtitleNode(null);
          setLoading(false);
          return;
        }
        setTeam(t);

        let imgSrc: string | null = null;
        if (t.urlPhoto) {
          const obj = await teamService.fetchTeamPhoto(t.urlPhoto);
          if (obj) {
            imgSrc = obj;
            createdObjUrls.push(obj);
          }
        }

        if (!imgSrc && t.club?.id) {
          try {
            const emblem = await clubService.getClubEmblem(t.club.id);
            if (emblem && emblem.data) {
              const blob = new Blob([emblem.data], {
                type: emblem.contentType ?? "image/png",
              });
              const url = URL.createObjectURL(blob);
              imgSrc = url;
              createdObjUrls.push(url);
            } else if (t.club.shieldUrl) {
              imgSrc = t.club.shieldUrl;
            }
          } catch (e) {
            if (t.club.shieldUrl) imgSrc = t.club.shieldUrl;
          }
        }

        const titleNode = (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              src={imgSrc ?? undefined}
              alt={t.name}
              sx={{ width: 40, height: 40 }}
            />
            <span>{t.name}</span>
          </Box>
        );
        setTeamTitleNode(titleNode);

        let clubShieldObj: string | null = null;
        if (t.club?.id) {
          try {
            const resp = await clubService.getClubEmblem(t.club.id);
            if (resp && resp.data) {
              const blob = new Blob([resp.data], {
                type: resp.contentType ?? "image/png",
              });
              const url = URL.createObjectURL(blob);
              clubShieldObj = url;
              createdObjUrls.push(url);
            } else if (t.club.shieldUrl) {
              clubShieldObj = t.club.shieldUrl;
            }
          } catch (e) {
            if (t.club.shieldUrl) clubShieldObj = t.club.shieldUrl;
          }
        }

        const clubNode = (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <img
              src={clubShieldObj ?? "/assets/logo.png"}
              alt={t.club?.name ?? "Club"}
              style={{
                width: 36,
                height: 36,
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
            <strong style={{ fontSize: 12 }}>{t.club?.name}</strong>
          </Box>
        );
        setClubSubtitleNode(clubNode);
      } catch (e) {
        if (!mounted) return;
        setTeam(null);
        setTeamTitleNode(null);
        setClubSubtitleNode(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      createdObjUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch (e) {}
      });
    };
  }, [location.search]);

  return { team, teamTitleNode, clubSubtitleNode, loading };
}
