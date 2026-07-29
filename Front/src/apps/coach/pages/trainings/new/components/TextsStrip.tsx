import { Box, FormControl, MenuItem, Select, Typography } from "@mui/material";
import { LINE_COLORS, TEXT_FONT_OPTIONS, TEXT_SIZE_OPTIONS } from "../constants";
import type { TacticalBoardState } from "../hooks/useTacticalBoard";
import type { TextStyle } from "../types";
import styles from "../NewExercisePage.module.css";

interface TextsStripProps {
  board: TacticalBoardState;
  selectedTextId?: string | null;
}

export default function TextsStrip({ board, selectedTextId }: TextsStripProps) {
  const {
    activeTextStyle,
    setActiveTextStyle,
    placedTexts,
    updatePlacedText,
  } = board;

  const selectedText = selectedTextId ? placedTexts.find((t) => t.id === selectedTextId) : null;
  const currentStyle = selectedText || activeTextStyle;

  const applyStyle = (patch: Partial<TextStyle>) => {
    if (selectedText && selectedTextId) {
      updatePlacedText(selectedTextId, patch);
    }
    setActiveTextStyle({ ...activeTextStyle, ...patch });
  };

  return (
    <Box className={styles.textsStrip}>
      <Box className={styles.textsStripControls}>
        {/* Font selector */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={currentStyle.fontFamily}
            onChange={(e) => applyStyle({ fontFamily: e.target.value })}
            aria-label="Font family"
          >
            {TEXT_FONT_OPTIONS.map((opt) => (
              <MenuItem key={opt.key} value={opt.key} style={{ fontFamily: opt.key }}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Size selector */}
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={currentStyle.fontSize}
            onChange={(e) => applyStyle({ fontSize: e.target.value as number })}
            aria-label="Font size"
          >
            {TEXT_SIZE_OPTIONS.map((size) => (
              <MenuItem key={size} value={size}>
                {size}px
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Bold button */}
        <button
          type="button"
          className={`${styles.textStyleBtn} ${currentStyle.bold ? styles.textStyleBtnActive : ""}`}
          onClick={() => applyStyle({ bold: !currentStyle.bold })}
          aria-pressed={currentStyle.bold}
          title="Bold"
          style={{ fontWeight: 700 }}
        >
          B
        </button>

        {/* Italic button */}
        <button
          type="button"
          className={`${styles.textStyleBtn} ${currentStyle.italic ? styles.textStyleBtnActive : ""}`}
          onClick={() => applyStyle({ italic: !currentStyle.italic })}
          aria-pressed={currentStyle.italic}
          title="Italic"
          style={{ fontStyle: "italic" }}
        >
          I
        </button>

        {/* Color swatches */}
        <Box className={styles.textsStripColors}>
          {LINE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.lineColorSwatch} ${currentStyle.color === c.value ? styles.lineColorSwatchActive : ""}`}
              style={{ backgroundColor: c.value }}
              onClick={() => applyStyle({ color: c.value })}
              title={c.label}
              aria-label={c.label}
            />
          ))}
        </Box>
      </Box>

      <Typography className={styles.linesHint}>
        Haz clic en el campo para colocar el texto. Doble clic sobre un texto para editarlo.
      </Typography>
    </Box>
  );
}
