import type { ReactNode } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import styles from "./DrillDownPanel.module.css";

export interface DrillDownPanelProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onBack: () => void;
  renderListItem: (item: T, index: number, isSelected: boolean) => ReactNode;
  renderDetail: (item: T, index: number) => ReactNode;
  renderListFooter?: ReactNode;
  detailTitle?: (item: T, index: number) => ReactNode;
  listAriaLabel: string;
  emptyMessage: string;
  /** When true, always render the single-pane drill-down layout (list OR detail, with back
   *  button), regardless of viewport width. Use this on any DrillDownPanel nested inside
   *  another DrillDownPanel's detail pane, so only ONE level ever shows a master-detail
   *  side-by-side column layout at a time. */
  forceSinglePane?: boolean;
}

/**
 * Presentational drill-down / master-detail navigation shell.
 * Below `md` (900px): single pane, list OR detail, with a back control.
 * At/above `md`: list and detail side by side.
 * Knows nothing about game-model data — purely navigation/layout.
 */
export default function DrillDownPanel<T>({
  items,
  getKey,
  selectedIndex,
  onSelect,
  onBack,
  renderListItem,
  renderDetail,
  renderListFooter,
  detailTitle,
  listAriaLabel,
  emptyMessage,
  forceSinglePane = false,
}: DrillDownPanelProps<T>) {
  const theme = useTheme();
  const isNarrowViewport = useMediaQuery(theme.breakpoints.down("md"));
  const isMobile = forceSinglePane || isNarrowViewport;

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : undefined;

  const list = (
    <Box component="ul" aria-label={listAriaLabel} className={styles.list}>
      {items.map((item, index) => (
        <li key={getKey(item, index)} className={styles.listItemWrap}>
          <div
            role="button"
            tabIndex={0}
            aria-current={index === selectedIndex ? "true" : undefined}
            className={`${styles.listItem}${index === selectedIndex ? ` ${styles.listItemSelected}` : ""}`}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(index);
              }
            }}
          >
            {renderListItem(item, index, index === selectedIndex)}
          </div>
        </li>
      ))}
      {renderListFooter && <li className={styles.listFooter}>{renderListFooter}</li>}
    </Box>
  );

  const detail =
    selectedItem !== undefined ? (
      <Box className={styles.detail}>
        {isMobile && (
          <Box className={styles.detailHeader}>
            <IconButton size="small" aria-label="Volver" className={styles.backBtn} onClick={onBack}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            {detailTitle && (
              <Typography component="h3" className={styles.detailTitle}>
                {detailTitle(selectedItem, selectedIndex as number)}
              </Typography>
            )}
          </Box>
        )}
        {renderDetail(selectedItem, selectedIndex as number)}
      </Box>
    ) : (
      <Box className={styles.emptyDetail}>
        <Typography className={styles.emptyMessage}>{emptyMessage}</Typography>
      </Box>
    );

  if (isMobile) {
    return <Box className={styles.mobileRoot}>{selectedIndex === null ? list : detail}</Box>;
  }

  return (
    <Box className={styles.masterDetailRoot}>
      <Box className={styles.listColumn}>{list}</Box>
      <Box className={styles.detailColumn}>{detail}</Box>
    </Box>
  );
}
