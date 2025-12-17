import React, { useEffect, useState } from "react";
import { Card, CardContent, CardMedia, Typography, Box } from "@mui/material";
import type { ClubResponse } from "../../types/club";
import clubService from "../../services/clubService";

type Props = {
  id: string;
};

export default function ClubCard({ id }: Props) {
  const [club, setClub] = useState<ClubResponse | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const c = await clubService.getClubById(id);
        if (!mounted) return;
        setClub(c);

        // if shieldUrl present, use it; otherwise fetch emblem bytes
        if (c && (c as any).shieldUrl) {
          setImageSrc((c as any).shieldUrl);
        } else if (c) {
          try {
            const resp = await clubService.getClubEmblem(id);
            if (!mounted) return;
            if (resp && resp.data) {
              const blob = new Blob([resp.data], {
                type: resp.contentType ?? "image/png",
              });
              objectUrl = URL.createObjectURL(blob);
              setImageSrc(objectUrl);
            }
          } catch (err) {
            // ignore emblem errors
          }
        }
      } catch (err) {
        // ignore load errors; keep club null
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <Card sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      {imageSrc ? (
        <CardMedia
          component="img"
          sx={{ width: 96, height: 96 }}
          image={imageSrc}
          alt={`${club?.name ?? "club"} escudo`}
        />
      ) : (
        <Box
          sx={{
            width: 96,
            height: 96,
            backgroundColor: "grey.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="caption">No emblem</Typography>
        </Box>
      )}
      <CardContent>
        <Typography variant="h6">
          {club ? club.name : loading ? "Cargando..." : "-"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {club?.country?.name ?? "-"}
        </Typography>
      </CardContent>
    </Card>
  );
}
