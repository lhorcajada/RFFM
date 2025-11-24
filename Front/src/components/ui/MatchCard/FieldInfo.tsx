import React from "react";
import styles from "./MatchCard.module.css";
import MapPin from "../MapPin/MapPin";

export default function FieldInfo({
  fieldName,
  cityName,
  mapsUrl,
}: {
  fieldName?: string | null;
  cityName?: string | null;
  mapsUrl?: string | null;
}) {
  if (!fieldName) return null;
  return (
    <div className={styles.cardTitleWrap}>
      <div className={styles.cardTitle} title={fieldName}>
        {fieldName}
        {mapsUrl ? <MapPin href={mapsUrl} /> : null}
      </div>
      {cityName ? (
        <div className={styles.cardSubtitle} title={cityName}>
          {cityName}
        </div>
      ) : null}
    </div>
  );
}
