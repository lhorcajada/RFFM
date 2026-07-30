import { Directory, File, Paths } from 'expo-file-system';
import { PDFJS_MIN_JS, PDFJS_WORKER_MIN_JS } from './pdfjsAssets.generated';
import { PDF_VIEWER_HTML } from './viewerHtmlTemplate';

const VIEWER_DIR_NAME = 'pdfjs-viewer';

// pdf.min.js / pdf.worker.min.js are static (bundled, ~1.3 MB combined) — write them once and
// reuse across screens/renders instead of rewriting on every open.
const writeIfMissing = (file: File, content: string) => {
  if (file.exists) {
    return;
  }
  file.create();
  file.write(content);
};

/**
 * Prepares a local PDF.js-based viewer (pdf.min.js, pdf.worker.min.js, viewer.html) under the
 * cache directory, and returns a `file://` URI pointing at `viewer.html` with the given PDF's
 * local URI passed as a `?file=` query param.
 *
 * This exists because Android's WebView (unlike iOS's WKWebView) has no built-in PDF renderer —
 * pointing the WebView directly at a `file://…pdf` URI shows a blank page. Loading a self-hosted
 * PDF.js viewer from the same `file://` origin renders the PDF via <canvas> instead.
 */
export const preparePdfViewerAssets = async (pdfFileUri: string): Promise<string> => {
  const viewerDir = new Directory(Paths.cache, VIEWER_DIR_NAME);
  if (!viewerDir.exists) {
    viewerDir.create({ idempotent: true, intermediates: true });
  }

  const pdfJsFile = new File(viewerDir, 'pdf.min.js');
  writeIfMissing(pdfJsFile, PDFJS_MIN_JS);

  const workerFile = new File(viewerDir, 'pdf.worker.min.js');
  writeIfMissing(workerFile, PDFJS_WORKER_MIN_JS);

  const htmlFile = new File(viewerDir, 'viewer.html');
  if (htmlFile.exists) {
    htmlFile.delete();
  }
  htmlFile.create();
  htmlFile.write(PDF_VIEWER_HTML);

  return `${htmlFile.uri}?file=${encodeURIComponent(pdfFileUri)}`;
};
