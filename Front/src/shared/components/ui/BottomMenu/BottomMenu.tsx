import React from "react";
import IconButton from "@mui/material/IconButton";
import { Link, useLocation } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "./BottomMenu.module.css";

export interface BottomMenuItem {
  to: string;
  ariaLabel: string;
  icon: React.ReactNode;
  activeMatch?: (pathname: string) => boolean;
}

interface BottomMenuProps {
  items: BottomMenuItem[];
}

export default function BottomMenu({ items }: BottomMenuProps) {
  const loc = useLocation();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  function scrollByAmount(amount: number) {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className={styles.wrapper}>
      <IconButton
        aria-label="scroll left"
        size="small"
        className={`${styles.arrowBtn} ${styles.leftArrow}`}
        onClick={() => scrollByAmount(-120)}
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>

      <div className={styles.bar} ref={containerRef}>
        {items.map((it, idx) => {
          const active = it.activeMatch
            ? it.activeMatch(loc.pathname)
            : loc.pathname === it.to || loc.pathname.startsWith(it.to);
          return (
            <IconButton
              key={idx}
              component={Link}
              to={it.to}
              className={
                active ? `${styles.iconBtn} ${styles.active}` : styles.iconBtn
              }
              aria-label={it.ariaLabel}
              size="large"
            >
              {it.icon}
            </IconButton>
          );
        })}
      </div>

      <IconButton
        aria-label="scroll right"
        size="small"
        className={`${styles.arrowBtn} ${styles.rightArrow}`}
        onClick={() => scrollByAmount(120)}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </div>
  );
}
