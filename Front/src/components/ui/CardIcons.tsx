import React from "react";

export function YellowCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="2"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="0.6"
      />
    </svg>
  );
}

export function RedCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="2"
        fill="#FF0000"
        stroke="#000"
        strokeWidth="0.6"
      />
    </svg>
  );
}

export function DoubleYellowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="18"
      viewBox="0 0 28 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="3"
        width="10"
        height="12"
        rx="2"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="0.6"
      />
      <rect
        x="16"
        y="3"
        width="10"
        height="12"
        rx="2"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="0.6"
      />
    </svg>
  );
}

export default YellowCardIcon;

export function SubstituteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="10" width="18" height="2" fill="#4A4A4A" />
      <rect x="6" y="6" width="12" height="4" rx="1" fill="#6B6B6B" />
      <rect x="8" y="16" width="2" height="2" fill="#4A4A4A" />
      <rect x="14" y="16" width="2" height="2" fill="#4A4A4A" />
    </svg>
  );
}

export function JerseyIcon({
  className,
  number,
}: {
  className?: string;
  number?: number | string;
}) {
  const display = number !== undefined && number !== null ? String(number) : "";
  return (
    <svg
      className={className}
      style={{
        display: "inline-block",
        width: "20px",
        height: "20px",
        minWidth: "20px",
        minHeight: "20px",
      }}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <path
        d="M6 3 L9 3 L10 6 L14 6 L15 3 L18 3 L18 8 C18 10 16 12 12 12 C8 12 6 10 6 8 L6 3 Z"
        fill="#FFD166"
        stroke="#000"
        strokeWidth="0.5"
        style={{ display: "block" }}
      />
      {display && (
        <text
          x="12"
          y="12"
          fontSize="8"
          fontWeight={800}
          textAnchor="middle"
          fill="#000"
          style={{ dominantBaseline: "middle" }}
        >
          {display}
        </text>
      )}
    </svg>
  );
}
