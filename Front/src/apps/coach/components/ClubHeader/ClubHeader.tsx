import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import styles from "./ClubHeader.module.css";
import clubService from "../../services/clubService";

type Props = {
  clubId: string;
  className?: string;
};

export default function ClubHeader({ clubId, className }: Props) {
  const [clubName, setClubName] = useState<string | null>(null);
  const [emblemSrc, setEmblemSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    async function load() {
      if (!clubId) return;
      setLoading(true);
      try {
        const c = await clubService.getClubById(clubId);
        if (!mounted) return;
        setClubName(c?.name ?? null);

        if (c && (c as any).shieldUrl) {
          setEmblemSrc((c as any).shieldUrl);
        } else if (c) {
          const resp = await clubService.getClubEmblem(clubId);
          if (!mounted) return;
          if (resp && resp.data) {
            const blob = new Blob([resp.data], {
              type: resp.contentType ?? "image/png",
            });
            objectUrl = URL.createObjectURL(blob);
            setEmblemSrc(objectUrl);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clubId]);

  if (loading)
    return (
      <span className={`${styles.loading} ${className ?? ""}`.trim()}>
        <CircularProgress size={18} />
      </span>
    );

  return (
    <span className={`${styles.root} ${className ?? ""}`.trim()}>
      {emblemSrc && (
        <img
          src={emblemSrc}
          alt={`${clubName ?? "club"} escudo`}
          className={styles.emblem}
        />
      )}
      <span className={styles.name}>{clubName ?? "-"}</span>
    </span>
  );
}
