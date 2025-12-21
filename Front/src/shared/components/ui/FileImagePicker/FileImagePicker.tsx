import React, { useEffect } from "react";
import styles from "./FileImagePicker.module.css";

export default function FileImagePicker({
  id,
  label,
  accept = "image/png, image/jpeg",
  file,
  onChange,
  previewWidth = 72,
  previewHeight = 90,
}: {
  id: string;
  label?: string;
  accept?: string;
  file?: File | null;
  onChange?: (f: File | null) => void;
  previewWidth?: number;
  previewHeight?: number;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={styles.emblemRow}>
      <div>
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
      </div>
      <div>
        {preview ? (
          <div
            className={styles.shieldPreview}
            style={{
              width: previewWidth,
              height: previewHeight,
              backgroundImage: `url(${preview})`,
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
