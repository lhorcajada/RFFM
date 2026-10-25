import styles from "./EventLocation.module.css";

type Props = { location?: string | null; mapUrl?: string | null };

export default function EventLocation({ location, mapUrl }: Props) {
  if (!location) return null;
  if (!mapUrl) return <span className={styles.text}>{location}</span>;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
      {location}
    </a>
  );
}
