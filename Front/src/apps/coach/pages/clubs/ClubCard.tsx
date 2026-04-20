import React, { useEffect, useState } from "react";
import type { ClubResponse } from "../../types/club";
import clubService from "../../services/clubService";
import { useNavigate } from "react-router-dom";
import styles from "./ClubCard.module.css";

type Props = {
  id: string;
};

export default function ClubCard({ id }: Props) {
  const navigate = useNavigate();
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
          } catch {
            // ignore emblem errors
          }
        }
      } catch {
        // ignore load errors
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
    <button
      type="button"
      className={styles.card}
      onClick={() => navigate(`/coach/clubs/dashboard/${id}`)}
      aria-label={club?.name ?? "Club"}
    >
      <div className={styles.emblemWrap}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`${club?.name ?? "club"} escudo`}
            className={styles.emblem}
          />
        ) : (
          <div className={styles.emblemPlaceholder}>
            <span className={styles.emblemInitial}>
              {club?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>
          {club ? club.name : loading ? "Cargando..." : "-"}
        </span>
        {club?.country?.name && (
          <span className={styles.country}>{club.country.name}</span>
        )}
      </div>
    </button>
  );
}
