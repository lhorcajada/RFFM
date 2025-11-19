import React from "react";
import styles from "./Jersey.module.css";

type JerseyProps = {
  number?: string | number | null;
  primary?: string; // main color
  secondary?: string; // optional accent
  tertiary?: string; // optional border color
  size?: number; // pixel size (square)
  className?: string;
};

export default function Jersey({
  number,
  primary = "#0b63d6",
  secondary,
  tertiary,
  size = 44,
  className,
}: JerseyProps) {
  const varStyle: React.CSSProperties = {
    // CSS variables used by the module
    ["--jersey-size" as any]: `${size}px`,
    ["--jersey-primary" as any]: primary,
    ["--jersey-tertiary" as any]: tertiary || "transparent",
    ["--jersey-number-color" as any]: "#ffffff",
  };

  const rootClass = `${styles.root} ${tertiary ? styles.withBorder : ""} ${
    className || ""
  }`;

  return (
    <div style={varStyle} className={rootClass} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        style={{ color: primary }}
        role="img"
        aria-label={number ? `Camiseta ${number}` : `Camiseta`}
      >
        <path
          d="M4 3c.5 1 1.5 1.5 2.5 1.5S9 4 10 3s1.5-1.5 2.5-1.5S15 3 16 4s1.5 1 2.5 1H22v3c0 1-1 2-2 2h-1v8c0 1-1 2-2 2H7c-1 0-2-1-2-2V10H4c-1 0-2-1-2-2V4h2.5C2.5 4 3.5 3.5 4 3z"
          opacity="1"
        />
        <path
          d="M3 6h3l1 2h10l1-2h3v2c0 1-1 2-2 2h-1v8c0 1-1 2-2 2H7c-1 0-2-1-2-2V10H3c-1 0-2-1-2-2V6z"
          opacity="1"
        />
      </svg>
      {number ? (
        <span
          className={styles.number}
          style={{ fontSize: Math.round(size * 0.45) }}
        >
          {number}
        </span>
      ) : (
        <span className={styles.placeholderDot} />
      )}
    </div>
  );
}
