import { useEffect, useState } from "react";
import type { TeamResponse } from "../../../services/teamService";
import teamService from "../../../services/teamService";
import clubService from "../../../services/clubService";
import { fetchImage } from "../../../../../shared/services/imageService";

export type TeamPhotos = Record<string, string | null>;

export function useTeamPhotos(teams: TeamResponse[]): TeamPhotos {
  const [teamPhotos, setTeamPhotos] = useState<TeamPhotos>({});

  useEffect(() => {
    let mounted = true;
    const createdObjUrls: string[] = [];

    async function loadTeamPhotos() {
      const photos: TeamPhotos = {};

      for (const t of teams) {
        try {
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
              } else if (t.club.emblemUrl) {
                imgSrc = await fetchImage(t.club.emblemUrl);
              }
            } catch {
              if (t.club.emblemUrl) imgSrc = await fetchImage(t.club.emblemUrl);
            }
          }

          if (mounted) photos[t.id] = imgSrc ?? null;
        } catch (err) {
          console.error("Error loading team photo:", err);
          if (mounted) photos[t.id] = null;
        }
      }

      if (mounted) setTeamPhotos(photos);
    }

    if (teams.length > 0) {
      loadTeamPhotos();
    }

    return () => {
      mounted = false;
      createdObjUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [teams]);

  return teamPhotos;
}
