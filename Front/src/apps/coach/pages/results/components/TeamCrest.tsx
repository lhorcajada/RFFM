import { resolveShield } from "../../../../../shared/utils/match";
import styles from "./TeamCrest.module.css";

type Props = {
  name: string;
  imageUrl: string | null | undefined;
  size?: "sm" | "md" | "lg";
  own?: boolean;
};

function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => w && !(w.length <= 3 && w === w.toUpperCase()));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function TeamCrest({ name, imageUrl, size = "md", own = false }: Props) {
  const src = resolveShield(String(imageUrl ?? "").trim());
  const className = [styles.crest, styles[size], own ? styles.own : "", src ? styles.image : ""].filter(Boolean).join(" ");
  return (
    <span className={className}>
      {src ? <img src={src} alt={`Escudo de ${name}`} loading="lazy" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}
