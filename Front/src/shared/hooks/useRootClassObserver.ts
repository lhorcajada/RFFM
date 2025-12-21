import React from "react";

type Callback = (enabled: boolean) => void;

export default function useRootClassObserver(
  rootClass: string,
  callback: Callback
) {
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = () => {
      const enabled = document.documentElement.classList.contains(rootClass);
      try {
        callback(enabled);
      } catch (e) {
        // ignore
      }
    };

    // initial call
    apply();

    const obs = new MutationObserver(() => apply());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => obs.disconnect();
  }, [rootClass, callback]);
}
