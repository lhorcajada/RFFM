import React from "react";
import styles from "./SectorChart.module.css";
import classStyles from "../ClassificationItem/ClassificationItem.module.css";
import { useTheme } from "@mui/material/styles";
import EmptyState from "../EmptyState/EmptyState";

type Sector = {
  startMinute: number;
  endMinute: number;
  goalsFor: number;
  goalsAgainst: number;
};
type TeamData = {
  teamCode: string;
  teamName: string;
  matchesProcessed: number;
  sectors: Sector[];
  totalGoalsFor: number;
  totalGoalsAgainst: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export default function SectorChart({ data }: { data: TeamData[] }) {
  const theme = useTheme();
  const color1 = theme.palette.primary.main ?? "#374151";
  const color2 =
    theme.palette.success?.main ??
    theme.palette.secondary?.main ??
    theme.palette.text.secondary ??
    "#9ca3af";
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= 600 : false
  );

  React.useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 600);
    }
    try {
      window.addEventListener("resize", onResize);
    } catch (e) {}
    return () => {
      try {
        window.removeEventListener("resize", onResize);
      } catch (e) {}
    };
  }, []);

  // expect data.length === 2
  const t1 = data[0];
  const t2 = data[1];

  // merge sector intervals from both teams into a sorted unique list
  const map = new Map<string, { start: number; end: number }>();
  (t1?.sectors ?? []).forEach((s) =>
    map.set(`${s.startMinute}-${s.endMinute}`, {
      start: s.startMinute,
      end: s.endMinute,
    })
  );
  (t2?.sectors ?? []).forEach((s) =>
    map.set(`${s.startMinute}-${s.endMinute}`, {
      start: s.startMinute,
      end: s.endMinute,
    })
  );
  const merged = Array.from(map.values()).sort((a, b) => a.start - b.start);

  // Build rows with values for each team; include goalsFor and goalsAgainst; filter out sectors where both teams have zero goals
  const rows = merged
    .map((s) => {
      const a = (t1?.sectors ?? []).find(
        (x) => x.startMinute === s.start && x.endMinute === s.end
      ) ?? {
        startMinute: s.start,
        endMinute: s.end,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      const b = (t2?.sectors ?? []).find(
        (x) => x.startMinute === s.start && x.endMinute === s.end
      ) ?? {
        startMinute: s.start,
        endMinute: s.end,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      return {
        start: s.start,
        end: s.end,
        aGoals: a.goalsFor ?? 0,
        aAgainst: a.goalsAgainst ?? 0,
        bGoals: b.goalsFor ?? 0,
        bAgainst: b.goalsAgainst ?? 0,
      };
    })
    .filter((r) => r.aGoals || r.bGoals || r.aAgainst || r.bAgainst);

  if (rows.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.legendRow}>
          <div className={styles.legend}>
            <span
              className={styles.legendBox}
              style={{ background: color1 }}
            ></span>
            <strong>{t1?.teamName || t1?.teamCode}</strong> —{" "}
            {t1?.totalGoalsFor}
          </div>
          <div className={styles.legend}>
            <span
              className={styles.legendBox}
              style={{ background: color2 }}
            ></span>
            <strong>{t2?.teamName || t2?.teamCode}</strong> —{" "}
            {t2?.totalGoalsFor}
          </div>
        </div>
        <div>
          <EmptyState
            description={
              "No hay datos de goles por sectores para los equipos seleccionados."
            }
          />
        </div>
      </div>
    );
  }

  const maxGoals = Math.max(
    ...rows.map((r) => Math.max(r.aGoals, r.bGoals, r.aAgainst, r.bAgainst)),
    1
  );

  // SVG layout: use responsive width with viewBox so it fills container
  const margin = { top: 16, right: 8, bottom: 64, left: 40 };
  const sectorWidth = 96; // group width per sector
  const barW = 16;
  const gapBetween = 8;
  const totalWidth = rows.length * sectorWidth + margin.left + margin.right;
  const height = 300;
  const innerWidth = totalWidth - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const pxPerGoal = innerHeight / Math.max(maxGoals, 1);

  return (
    <div className={styles.root}>
      <div
        className={`${styles.legendRow} ${isMobile ? styles.mobileStack : ""}`}
      >
        <div className={styles.legendItem}>
          <span
            className={styles.legendBox}
            style={{ background: color1 }}
          ></span>
          <span
            className={styles.legendText}
            style={{ color: theme.palette.text.primary }}
          >
            {t1?.teamName || t1?.teamCode}
          </span>
          <span
            className={styles.legendTotal}
            style={{
              color: "#fff",
              marginLeft: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className={classStyles.iconCircleWhite}>
              <svg className={classStyles.iconInner} viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34M7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21"></path>
              </svg>
            </span>
            <strong style={{ color: "#fff" }}>{t1?.totalGoalsFor}</strong>
            <span
              style={{
                marginLeft: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className={classStyles.iconCircleRed}>
                <svg className={classStyles.iconInner} viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34M7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21"></path>
                </svg>
              </span>
              <span
                style={{
                  color: theme.palette.error.main ?? "#ef4444",
                  fontWeight: 700,
                }}
              >
                {t1?.totalGoalsAgainst}
              </span>
            </span>
          </span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendBox}
            style={{ background: color2 }}
          ></span>
          <span
            className={styles.legendText}
            style={{ color: theme.palette.text.primary }}
          >
            {t2?.teamName || t2?.teamCode}
          </span>
          <span
            className={styles.legendTotal}
            style={{
              color: "#fff",
              marginLeft: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className={classStyles.iconCircleWhite}>
              <svg className={classStyles.iconInner} viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34M7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21"></path>
              </svg>
            </span>
            <strong style={{ color: "#fff" }}>{t2?.totalGoalsFor}</strong>
            <span
              style={{
                marginLeft: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className={classStyles.iconCircleRed}>
                <svg className={classStyles.iconInner} viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34M7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21"></path>
                </svg>
              </span>
              <span
                style={{
                  color: theme.palette.error.main ?? "#ef4444",
                  fontWeight: 700,
                }}
              >
                {t2?.totalGoalsAgainst}
              </span>
            </span>
          </span>
        </div>
      </div>

      <div className={styles.svgWrap}>
        <svg
          width="100%"
          viewBox={`0 0 ${totalWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* grid lines and y labels */}
            {[0, 1, 2, 3, 4].map((i) => {
              const goal = Math.round((maxGoals / 4) * i);
              const y = innerHeight - goal * pxPerGoal;
              return (
                <g key={i}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={y}
                    y2={y}
                    stroke={theme.palette.divider}
                  />
                  <text
                    x={-8}
                    y={y + 4}
                    fontSize={isMobile ? 16 : 12}
                    textAnchor="end"
                    fill={theme.palette.text.secondary}
                  >
                    {goal}
                  </text>
                </g>
              );
            })}

            {/* sectors */}
            {rows.map((r, idx) => {
              const groupX =
                idx * sectorWidth + (sectorWidth - (barW * 2 + gapBetween)) / 2; // two stacked bars per sector
              // Team A stacked: bottom = against, top = for
              const hAAgainst = r.aAgainst * pxPerGoal;
              const hAFor = r.aGoals * pxPerGoal;
              const totalA = hAAgainst + hAFor;
              const hBAgainst = r.bAgainst * pxPerGoal;
              const hBFor = r.bGoals * pxPerGoal;
              const totalB = hBAgainst + hBFor;

              const xA = groupX;
              const xB = groupX + barW + gapBetween;

              const labelThreshold = isMobile ? 8 : 12;
              const showAFor = hAFor > labelThreshold;
              const showAAgainst = hAAgainst > labelThreshold;
              const showBFor = hBFor > labelThreshold;
              const showBAgainst = hBAgainst > labelThreshold;

              return (
                <g key={idx}>
                  {/* Team A - Against (bottom) */}
                  <rect
                    x={xA}
                    y={innerHeight - hAAgainst}
                    width={barW}
                    height={hAAgainst}
                    fill={theme.palette.primary.dark ?? color1}
                    rx={3}
                  />
                  {/* Team A - For (stacked above) */}
                  <rect
                    x={xA}
                    y={innerHeight - hAAgainst - hAFor}
                    width={barW}
                    height={hAFor}
                    fill={theme.palette.primary.main ?? color1}
                    rx={3}
                  />
                  {/* Labels inside segments if they fit */}
                  {showAFor && (
                    <text
                      x={xA + barW / 2}
                      y={innerHeight - hAAgainst - hAFor / 2 + 4}
                      fontSize={isMobile ? 16 : 11}
                      textAnchor="middle"
                      fill={theme.palette.common.white}
                    >
                      {r.aGoals}
                    </text>
                  )}
                  {showAAgainst && (
                    <text
                      x={xA + barW / 2}
                      y={innerHeight - hAAgainst / 2 + 4}
                      fontSize={isMobile ? 16 : 11}
                      textAnchor="middle"
                      fill={theme.palette.error.main ?? "#ef4444"}
                    >
                      {r.aAgainst}
                    </text>
                  )}

                  {/* fallback labels above the bar when segment is too small but value exists */}
                  {!showAFor && r.aGoals > 0 && (
                    <text
                      x={xA + barW / 2}
                      y={innerHeight - hAAgainst - hAFor - 6}
                      fontSize={isMobile ? 14 : 10}
                      textAnchor="middle"
                      fill={theme.palette.common.white}
                    >
                      {r.aGoals}
                    </text>
                  )}
                  {!showAAgainst && r.aAgainst > 0 && (
                    <text
                      x={xA + barW / 2}
                      y={innerHeight - hAAgainst - 6}
                      fontSize={isMobile ? 14 : 10}
                      textAnchor="middle"
                      fill={theme.palette.error.main ?? "#ef4444"}
                    >
                      {r.aAgainst}
                    </text>
                  )}

                  {/* Team B - Against (bottom) */}
                  <rect
                    x={xB}
                    y={innerHeight - hBAgainst}
                    width={barW}
                    height={hBAgainst}
                    fill={theme.palette.success?.dark ?? color2}
                    rx={3}
                  />
                  {/* Team B - For (stacked above) */}
                  <rect
                    x={xB}
                    y={innerHeight - hBAgainst - hBFor}
                    width={barW}
                    height={hBFor}
                    fill={theme.palette.success?.main ?? color2}
                    rx={3}
                  />
                  {showBFor && (
                    <text
                      x={xB + barW / 2}
                      y={innerHeight - hBAgainst - hBFor / 2 + 4}
                      fontSize={isMobile ? 16 : 11}
                      textAnchor="middle"
                      fill={theme.palette.common.white}
                    >
                      {r.bGoals}
                    </text>
                  )}
                  {showBAgainst && (
                    <text
                      x={xB + barW / 2}
                      y={innerHeight - hBAgainst / 2 + 4}
                      fontSize={isMobile ? 16 : 11}
                      textAnchor="middle"
                      fill={theme.palette.error.main ?? "#ef4444"}
                    >
                      {r.bAgainst}
                    </text>
                  )}

                  {!showBFor && r.bGoals > 0 && (
                    <text
                      x={xB + barW / 2}
                      y={innerHeight - hBAgainst - hBFor - 6}
                      fontSize={isMobile ? 14 : 10}
                      textAnchor="middle"
                      fill={theme.palette.common.white}
                    >
                      {r.bGoals}
                    </text>
                  )}
                  {!showBAgainst && r.bAgainst > 0 && (
                    <text
                      x={xB + barW / 2}
                      y={innerHeight - hBAgainst - 6}
                      fontSize={isMobile ? 14 : 10}
                      textAnchor="middle"
                      fill={theme.palette.error.main ?? "#ef4444"}
                    >
                      {r.bAgainst}
                    </text>
                  )}

                  {/* label */}
                  <text
                    x={groupX + (barW * 2 + gapBetween) / 2}
                    y={innerHeight + (isMobile ? 28 : 22)}
                    fontSize={isMobile ? 14 : 12}
                    textAnchor="middle"
                    fill={theme.palette.text.secondary}
                  >{`${r.start}-${r.end}’`}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
