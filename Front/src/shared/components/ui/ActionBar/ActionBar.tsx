import React, { useLayoutEffect, useRef } from "react";
import { Box } from "@mui/material";
import styles from "./ActionBar.module.css";

interface ActionBarProps {
  children: React.ReactNode;
}

const HEIGHT_VAR = "--rffm-action-bar-h";

const findScrollArea = (element: HTMLElement): HTMLElement | null => {
  let ancestor = element.parentElement;
  while (ancestor) {
    const { overflowY } = window.getComputedStyle(ancestor);
    if (overflowY === "auto" || overflowY === "scroll") return ancestor;
    ancestor = ancestor.parentElement;
  }
  return null;
};

const ActionBar: React.FC<ActionBarProps> = ({ children }) => {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const scrollArea = bar ? findScrollArea(bar) : null;
    if (!bar || !scrollArea) return;

    const publishHeight = () =>
      scrollArea.style.setProperty(HEIGHT_VAR, `${bar.offsetHeight}px`);
    publishHeight();

    const observer = new ResizeObserver(publishHeight);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      scrollArea.style.removeProperty(HEIGHT_VAR);
    };
  }, []);

  return (
    <Box ref={barRef} className={styles.actionBar}>
      {children}
    </Box>
  );
};

export default ActionBar;
