import React from "react";
import styles from "./PlayerNameButton.module.css";

type Props = {
  playerCode?: string | null;
  playerName?: string | null;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
  className?: string;
  children?: React.ReactNode;
};

export default function PlayerNameButton({
  playerCode,
  playerName,
  onPlayerClick,
  className,
  children,
}: Props) {
  const code = (playerCode ?? "").trim();
  const disabled = !onPlayerClick || code.length === 0;

  if (disabled) {
    return <span className={className}>{children ?? playerName ?? ""}</span>;
  }

  return (
    <button
      type="button"
      className={`${styles.root} ${className ?? ""}`}
      onClick={() => onPlayerClick(code, playerName ?? undefined)}
    >
      {children ?? playerName ?? ""}
    </button>
  );
}
