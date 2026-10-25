import React, { useState } from "react";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import SportsSoccerOutlinedIcon from "@mui/icons-material/SportsSoccerOutlined";
import styles from "./EventInfoCard.module.css";

type Props = {
  name: string;
  typeName?: string | null;
  typeClassName?: string;
  date?: Date | null;
  start?: Date | null;
  end?: Date | null;
  arrival?: Date | null;
  location?: string | null;
  locationMapUrl?: string | null;
  rivalName?: string | null;
  description?: string | null;
};

const LONG_DESCRIPTION_LENGTH = 140;

const formatTime = (d: Date) => d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

const formatDate = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export default function EventInfoCard({
  name,
  typeName,
  typeClassName,
  date,
  start,
  end,
  arrival,
  location,
  locationMapUrl,
  rivalName,
  description,
}: Props) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const timeRange = start ? (end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start)) : null;
  const when = [date ? formatDate(date) : null, timeRange].filter(Boolean).join(" · ") || "Por confirmar";
  const isLongDescription = !!description && description.length > LONG_DESCRIPTION_LENGTH;

  return (
    <section className={styles.card} aria-label="Información del evento">
      <div className={styles.header}>
        {typeName && <span className={typeClassName}>{typeName}</span>}
        <h2 className={styles.name}>{name}</h2>
      </div>
      <div className={styles.line}>
        <CalendarMonthOutlinedIcon className={styles.icon} fontSize="small" aria-hidden="true" />
        <span>{when}</span>
        {arrival && <span className={styles.muted}>{`Llegada ${formatTime(arrival)}`}</span>}
      </div>
      {location && (
        <div className={styles.line}>
          <PlaceOutlinedIcon className={styles.icon} fontSize="small" aria-hidden="true" />
          {locationMapUrl ? (
            <a className={styles.link} href={locationMapUrl} target="_blank" rel="noopener noreferrer">
              {location}
            </a>
          ) : (
            <span>{location}</span>
          )}
        </div>
      )}
      {rivalName && (
        <div className={styles.line}>
          <SportsSoccerOutlinedIcon className={styles.icon} fontSize="small" aria-hidden="true" />
          <span>{`vs ${rivalName}`}</span>
        </div>
      )}
      {description && (
        <div className={styles.descriptionBlock}>
          <p className={`${styles.description}${isLongDescription && !descriptionOpen ? " " + styles.clamped : ""}`}>
            {description}
          </p>
          {isLongDescription && (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={descriptionOpen}
              onClick={() => setDescriptionOpen((open) => !open)}
            >
              {descriptionOpen ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
