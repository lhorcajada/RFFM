import React, { useEffect, useRef, useState } from "react";
import styles from "./FileImagePicker.module.css";

export default function FileImagePicker({
  id,
  label,
  accept = "image/png, image/jpeg",
  file,
  onChange,
  previewWidth = 72,
  previewHeight = 90,
  previewFit = "cover",
}: {
  id: string;
  label?: string;
  accept?: string;
  file?: File | null;
  onChange?: (f: File | null) => void;
  previewWidth?: number;
  previewHeight?: number;
  /** "cover" crops to fill (club emblems); "contain" shows the whole photo, letterboxed. */
  previewFit?: "cover" | "contain";
}) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleDragEnter = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    dragCounter.current += 1;
    if (ev.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
  };

  const handleDragLeave = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const droppedFile = ev.dataTransfer.files?.[0] ?? null;
    if (droppedFile) {
      onChange?.(droppedFile);
    }
  };

  return (
    <div className={styles.emblemRow}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label htmlFor={id} className={styles.fileInputLabel}>
          {label ?? "Seleccionar imagen"}
        </label>
        <input
          id={id}
          className={styles.fileInput}
          type="file"
          accept={accept}
          onChange={(ev) =>
            onChange?.(ev.target.files ? ev.target.files[0] : null)
          }
        />
        <div className={styles.dropHint}>o arrastra una imagen aquí</div>
      </div>
      <div>
        {preview ? (
          <div
            className={`${styles.shieldPreview} ${previewFit === "contain" ? styles.shieldPreviewContain : ""}`}
            style={{
              width: previewWidth,
              height: previewHeight,
              backgroundImage: `url(${preview})`,
              backgroundSize: previewFit,
            }}
          />
        ) : (
          <div
            className={styles.shieldPlaceholder}
            style={{ width: previewWidth, height: previewHeight }}
          />
        )}
      </div>
    </div>
  );
}
