import { useEffect, useState } from "react";
import { fetchPublicStorageFile } from "../../../shared/services/imageService";

/**
 * Resolves a backend-stored image path (e.g. `NewsItem.coverImageUrl`, which
 * for local storage is a relative path like `newsimages/xyz.jpg`, not a
 * browser-navigable URL) into an object URL suitable for an `<img src>`,
 * via the generic `GET /api/public/storage` endpoint. Revokes the previous
 * object URL whenever `path` changes and on unmount.
 */
export function useCoverImageUrl(path: string | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!path) {
      setObjectUrl(null);
      return;
    }

    fetchPublicStorageFile(path).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      createdUrl = url;
      setObjectUrl(url);
    });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [path]);

  return objectUrl;
}

export default useCoverImageUrl;
