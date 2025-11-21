import React from "react";
import styles from "./MapPin.module.css";

export default function MapPin({
  href,
  ariaLabel = "Ver en Maps",
}: {
  href: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      className={styles.mapIconLink}
    >
      <svg
        className={styles.mapIconSvg}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          fill="#4285F4"
          d="M12 2C8 2 5 5 5 9c0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z"
        />
        <circle cx="12" cy="9" r="2.6" fill="#EA4335" />
        <path
          fill="#FBBC05"
          d="M9 6c0 0 1-2 3-2s3 2 3 2c-1-1-2-1-3-1s-2 0-3 1z"
        />
      </svg>
    </a>
  );
}
