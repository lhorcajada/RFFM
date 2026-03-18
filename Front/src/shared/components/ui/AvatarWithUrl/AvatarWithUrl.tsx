import React, { useEffect, useState } from "react";
import { Avatar } from "@mui/material";
import { fetchImage } from "../../../services/imageService";

type Props = {
  url?: string;
  alt?: string;
} & React.ComponentProps<typeof Avatar>;

export default function AvatarWithUrl({ url, alt, ...props }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!url) {
        setObjectUrl(null);
        return;
      }
      try {
        const obj = await fetchImage(url);
        if (mounted) setObjectUrl(obj);
      } catch (e) {
        if (mounted) setObjectUrl(null);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [url]);

  return <Avatar src={objectUrl || undefined} alt={alt} {...props} />;
}
