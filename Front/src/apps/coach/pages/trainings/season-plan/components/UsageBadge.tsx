import { Badge, Tooltip } from "@mui/material";
import type { ReactNode } from "react";
import type { SessionUsage } from "../../../types/adnCoverage";
import styles from "./UsageBadge.module.css";

interface UsageBadgeProps {
  sessions: SessionUsage[];
  children: ReactNode;
}

function formatUsageDate(iso: string | null): string {
  if (!iso) return "Sin programar";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin programar";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

/** Small count badge over a draggable ADN node, with a tooltip listing every session that
 * targets it (name + formatted date, or "Sin programar" for an unscheduled session). Renders
 * nothing (just its children) when the node has no usages. */
export default function UsageBadge({ sessions, children }: UsageBadgeProps) {
  if (sessions.length === 0) return <>{children}</>;

  const tooltipText = sessions.map((s) => `${s.sessionName} (${formatUsageDate(s.date)})`).join(", ");

  return (
    <Tooltip title={tooltipText}>
      <Badge badgeContent={sessions.length} className={styles.badge} color="default">
        {children}
      </Badge>
    </Tooltip>
  );
}
