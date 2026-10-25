import styles from "./TeamShield.module.css";

export type TeamShieldSize = "sm" | "md" | "lg" | "xl";

interface TeamShieldProps {
  name: string;
  imageUrl?: string | null;
  size?: TeamShieldSize;
  className?: string;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default function TeamShield({ name, imageUrl, size = "md", className }: TeamShieldProps) {
  const classes = [styles.shield, styles[size], className].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-hidden="true">
      {imageUrl ? (
        <img className={styles.image} src={imageUrl} alt="" />
      ) : (
        <span className={styles.initials}>{getInitials(name)}</span>
      )}
    </span>
  );
}
