// One-off generator: embeds pdfjs-dist's UMD build (pdf.min.js / pdf.worker.min.js) as
// string constants so Metro bundles them as plain JS — no metro.config.js asset extension
// changes or expo-asset download step needed, and it works unmodified in Expo Go.
//
// Regenerate by running `node scripts/generatePdfjsAssets.js` after installing
// `pdfjs-dist@2.16.105` (last version shipping a classic, non-ES-module UMD build — required
// because Android WebView blocks `type="module"` scripts loaded from `file://` origins).
const fs = require('fs');
const path = require('path');

const pdfJsPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
const workerPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const outPath = path.join(__dirname, '..', 'src', 'pdfViewer', 'pdfjsAssets.generated.ts');

const pdfJsSource = fs.readFileSync(pdfJsPath, 'utf8');
const workerSource = fs.readFileSync(workerPath, 'utf8');

const header = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generatePdfjsAssets.js
// Source: pdfjs-dist@2.16.105 (node_modules/pdfjs-dist/build/pdf.min.js, pdf.worker.min.js)
`;

const content =
  header +
  `export const PDFJS_MIN_JS = ${JSON.stringify(pdfJsSource)};\n\n` +
  `export const PDFJS_WORKER_MIN_JS = ${JSON.stringify(workerSource)};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
