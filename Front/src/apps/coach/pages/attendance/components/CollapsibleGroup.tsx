import React from "react";
import { Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import styles from "../AttendanceTabs.module.css";

type Props = {
  title: string;
  count: number;
  colorClassName: string;
  expanded: boolean;
  onToggle: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
};

export default function CollapsibleGroup({
  title,
  count,
  colorClassName,
  expanded,
  onToggle,
  headerExtra,
  children,
}: Props) {
  return (
    <div>
      <div className={`${styles.listGroupHeader} ${colorClassName}`}>
        <button
          type="button"
          className={styles.listGroupToggle}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span
            className={`${styles.listGroupChevron}${
              expanded ? " " + styles.listGroupChevronExpanded : ""
            }`}
          >
            <ExpandMoreIcon fontSize="small" />
          </span>
          <span className={styles.listGroupTitle}>
            <span>{title}</span>
            <span className={styles.listGroupCount}>{count}</span>
          </span>
        </button>
        {headerExtra && (
          <div className={styles.listGroupHeaderExtra}>{headerExtra}</div>
        )}
      </div>
      <Collapse in={expanded} unmountOnExit>
        {children}
      </Collapse>
    </div>
  );
}
