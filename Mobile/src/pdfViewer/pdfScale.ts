// Pure scale-calculation helpers for the PDF.js viewer shell (`viewerHtmlTemplate.ts`).
//
// The viewer renders each page's <canvas> backing buffer at a higher resolution than its
// on-screen (CSS) size — "render big, display small" — so that native pinch-zoom inside the
// WebView doesn't pixelate the text. The inline <script> in `viewerHtmlTemplate.ts` re-implements
// this same formula (it runs as a plain string inside the WebView, not through this module), so
// keep both in sync when changing the math here.

/**
 * Computes the PDF.js render scale for a page so it:
 * - Fits the WebView viewport width (fit-to-width), instead of a fixed scale unrelated to the
 *   device's screen size.
 * - Renders its canvas backing buffer at native pixel density (`devicePixelRatio`), so the text
 *   stays sharp when the user pinch-zooms in.
 *
 * @param viewportWidth - width of the WebView viewport in CSS px (e.g. `document.documentElement.clientWidth`)
 * @param pageWidthAtScale1 - native PDF page width at scale 1 (`page.getViewport({ scale: 1 }).width`)
 * @param devicePixelRatio - `window.devicePixelRatio`
 */
export const computeRenderScale = (
  viewportWidth: number,
  pageWidthAtScale1: number,
  devicePixelRatio: number,
): number => {
  const safeDevicePixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (viewportWidth <= 0 || pageWidthAtScale1 <= 0) {
    return safeDevicePixelRatio;
  }
  const fitToWidthScale = viewportWidth / pageWidthAtScale1;
  return fitToWidthScale * safeDevicePixelRatio;
};

/**
 * CSS display size the canvas should be shown at, given the dimensions rendered at
 * `computeRenderScale(...)` and the same `devicePixelRatio` used to compute that scale.
 * Dividing back out the device pixel ratio keeps the on-screen size at fit-to-width while the
 * backing buffer stays at native resolution.
 */
export const computeDisplaySize = (
  renderedWidth: number,
  renderedHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } => {
  const safeDevicePixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    width: renderedWidth / safeDevicePixelRatio,
    height: renderedHeight / safeDevicePixelRatio,
  };
};
