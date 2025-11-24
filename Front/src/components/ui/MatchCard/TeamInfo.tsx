import React from "react";
import styles from "./MatchCard.module.css";

export default function TeamInfo({
  name,
  shieldSrc,
  alt,
}: {
  name: string;
  shieldSrc?: string;
  alt?: string;
}) {
  return (
    <div className={styles.teamBox}>
      <div className={styles.shieldWrap}>
        {shieldSrc ? (
          <img src={shieldSrc} alt={alt || name} className={styles.shield} />
        ) : (
          <div
            style={{
              width: 66,
              height: 66,
              background: "#f3f4f6",
              borderRadius: 6,
            }}
          />
        )}
      </div>
      <div className={styles.teamName} title={String(name)}>
        {name}
      </div>
    </div>
  );
}
