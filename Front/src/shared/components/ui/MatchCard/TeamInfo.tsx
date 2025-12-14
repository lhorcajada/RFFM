import React from "react";
import styles from "./MatchCard.module.css";

export default function TeamInfo({
  name,
  shieldSrc,
  alt,
  position,
}: {
  name: string;
  shieldSrc?: string;
  alt?: string;
  position?: number | string | null;
}) {
  const formatPosition = (p: any) => {
    if (p === null || p === undefined || p === "") return null;
    const n = Number(p);
    if (!Number.isNaN(n)) return `${n}º`;
    return String(p);
  };

  const posStr = formatPosition(position);

  return (
    <div className={styles.teamBox}>
      <div className={styles.shieldWrap}>
        {shieldSrc ? (
          <>
            <img src={shieldSrc} alt={alt || name} className={styles.shield} />
            {posStr ? (
              <div className={styles.badge} aria-hidden>
                {posStr}
              </div>
            ) : null}
          </>
        ) : (
          <div
            style={{
              width: 66,
              height: 66,
              background: "#f3f4f6",
              borderRadius: 6,
              position: "relative",
            }}
          >
            {posStr ? (
              <div className={styles.badge} aria-hidden>
                {posStr}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className={styles.teamName} title={String(name)}>
        {name}
      </div>
    </div>
  );
}
