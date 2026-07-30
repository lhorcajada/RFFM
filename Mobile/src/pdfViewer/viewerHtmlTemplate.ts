// Minimal PDF.js-based viewer shell. Loaded from a local `file://` directory alongside
// `pdf.min.js` and `pdf.worker.min.js` (see `preparePdfViewer.ts`), so relative <script src>
// references resolve as same-origin `file://` requests, which Android WebView allows with
// `allowFileAccess` / `allowFileAccessFromFileURLs` / `allowUniversalAccessFromFileURLs` enabled
// (already set on the WebView in TeamRulesScreen.tsx).
//
// The PDF to render is passed via the `?file=` query param as an encoded `file://` URI — this
// keeps the cached PDF decoupled from the (cacheable, static) viewer assets directory.
export const PDF_VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<title>Normas del equipo</title>
<style>
  html, body { margin: 0; padding: 0; background: #525659; }
  #container { width: 100%; padding: 8px 0; box-sizing: border-box; }
  canvas { display: block; margin: 0 auto 8px auto; box-shadow: 0 0 6px rgba(0,0,0,0.4); }
  #message { color: #fff; font-family: sans-serif; text-align: center; padding: 24px; }
</style>
</head>
<body>
<div id="container"></div>
<div id="message"></div>
<script src="pdf.min.js"></script>
<script>
(function () {
  var container = document.getElementById('container');
  var message = document.getElementById('message');
  var params = new URLSearchParams(window.location.search);
  var fileUri = params.get('file');

  function showMessage(text) {
    message.textContent = text;
  }

  if (!fileUri || !window.pdfjsLib) {
    showMessage('No se pudo mostrar el documento');
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

  // Keep in sync with computeRenderScale/computeDisplaySize in pdfScale.ts - this inline
  // script runs as a plain string inside the WebView and cannot import that module directly.
  function computeRenderScale(viewportWidth, pageWidthAtScale1, devicePixelRatio) {
    var safeDevicePixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
    if (viewportWidth <= 0 || pageWidthAtScale1 <= 0) {
      return safeDevicePixelRatio;
    }
    var fitToWidthScale = viewportWidth / pageWidthAtScale1;
    return fitToWidthScale * safeDevicePixelRatio;
  }

  function computeDisplaySize(renderedWidth, renderedHeight, devicePixelRatio) {
    var safeDevicePixelRatio = devicePixelRatio > 0 ? devicePixelRatio : 1;
    return {
      width: renderedWidth / safeDevicePixelRatio,
      height: renderedHeight / safeDevicePixelRatio,
    };
  }

  window.pdfjsLib
    .getDocument(fileUri)
    .promise.then(function (pdf) {
      var devicePixelRatio = window.devicePixelRatio || 1;
      var viewportWidth = document.documentElement.clientWidth;

      var renderPage = function (pageNumber) {
        return pdf.getPage(pageNumber).then(function (page) {
          var pageWidthAtScale1 = page.getViewport({ scale: 1 }).width;
          var renderScale = computeRenderScale(viewportWidth, pageWidthAtScale1, devicePixelRatio);
          var viewport = page.getViewport({ scale: renderScale });

          var canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          var displaySize = computeDisplaySize(viewport.width, viewport.height, devicePixelRatio);
          canvas.style.width = displaySize.width + 'px';
          canvas.style.height = displaySize.height + 'px';

          container.appendChild(canvas);
          var context = canvas.getContext('2d');
          return page.render({ canvasContext: context, viewport: viewport }).promise;
        });
      };

      var chain = Promise.resolve();
      var _loop = function (pageNumber) {
        chain = chain.then(function () {
          return renderPage(pageNumber);
        });
      };
      for (var i = 1; i <= pdf.numPages; i++) {
        _loop(i);
      }
      return chain;
    })
    .catch(function () {
      showMessage('No se pudo mostrar el documento');
    });
})();
</script>
</body>
</html>
`;
