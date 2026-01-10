import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PdfOptions = { landscape?: boolean; margin?: number; shrink?: number };

type PackedLayoutOptions = {
  breakBefore?: boolean[];
  gap?: number;
  headerElement?: HTMLElement;
  headerGap?: number;
};

function getPdfMetrics(pdf: jsPDF, options?: PdfOptions) {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = options?.margin ?? 36;
  const shrink = options?.shrink ?? 1;
  const availWidth = pdfWidth - margin * 2;
  const availHeight = pdfHeight - margin * 2;
  return { pdfWidth, pdfHeight, margin, shrink, availWidth, availHeight };
}

function getScaleForCanvas(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options?: PdfOptions
) {
  const { availWidth, shrink } = getPdfMetrics(pdf, options);
  return (availWidth * shrink) / canvas.width;
}

function addCanvasAsSingleImage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  yPos: number,
  options?: PdfOptions
) {
  const { margin, availWidth } = getPdfMetrics(pdf, options);
  const scale = getScaleForCanvas(pdf, canvas, options);

  const renderedWidth = canvas.width * scale;
  const renderedHeight = canvas.height * scale;
  const x = margin + (availWidth - renderedWidth) / 2;
  const imgData = canvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", x, yPos, renderedWidth, renderedHeight);
  return { renderedWidth, renderedHeight };
}

async function addCanvasToPdfWithHeader(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options?: PdfOptions,
  headerCanvas?: HTMLCanvasElement | null,
  headerGap?: number
): Promise<number> {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const margin = options?.margin ?? 36; // pts
  const shrink = options?.shrink ?? 1; // 1 = no shrink, <1 reduce
  const availWidth = pdfWidth - margin * 2;
  const availHeight = pdfHeight - margin * 2;
  const scale = (availWidth * shrink) / canvas.width;

  // Para slicing, reducimos el alto disponible si hay cabecera
  // (la cabecera se dibuja en cada página).
  const headerGapValue = headerGap ?? 10;
  const headerScale = headerCanvas
    ? getScaleForCanvas(pdf, headerCanvas, options)
    : 1;
  const headerRenderedHeight = headerCanvas
    ? headerCanvas.height * headerScale
    : 0;
  const headerOffset = headerCanvas ? headerRenderedHeight + headerGapValue : 0;

  const sliceHeightPx = Math.floor((availHeight - headerOffset) / scale);
  if (sliceHeightPx <= 0)
    throw new Error("Altura de página insuficiente para el PDF");

  let y = 0;
  let pagesAdded = 0;
  let hasStarted = false;

  while (y < canvas.height) {
    const h = Math.min(sliceHeightPx, canvas.height - y);
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = h;
    const ctx = tmpCanvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear contexto canvas");
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

    let isMostlyBlank = false;
    try {
      if (h < 8) {
        isMostlyBlank = true;
      } else {
        const imgDataObj = ctx.getImageData(
          0,
          0,
          tmpCanvas.width,
          tmpCanvas.height
        );
        const data = imgDataObj.data;
        let nonWhite = 0;
        const totalPixels = tmpCanvas.width * tmpCanvas.height;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a === 0) continue;
          if (!(r > 250 && g > 250 && b > 250)) nonWhite++;
          if (nonWhite > totalPixels * 0.002) break;
        }
        isMostlyBlank = nonWhite / totalPixels < 0.002;
      }
    } catch {
      isMostlyBlank = false;
    }

    if (!isMostlyBlank) {
      if (!hasStarted) {
        hasStarted = true;
      } else {
        pdf.addPage();
      }

      if (headerCanvas) {
        addCanvasAsSingleImage(pdf, headerCanvas, margin, options);
      }

      const imgData = tmpCanvas.toDataURL("image/png");
      const renderedHeight = h * scale;
      const renderedWidth = canvas.width * scale;
      const x = margin + (availWidth - renderedWidth) / 2;
      const yPos = margin + headerOffset;
      pdf.addImage(imgData, "PNG", x, yPos, renderedWidth, renderedHeight);
      pagesAdded++;
    }

    y += h;
  }

  return pagesAdded;
}

async function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options?: PdfOptions,
  startOnNewPage?: boolean
): Promise<number> {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const margin = options?.margin ?? 36; // pts
  const shrink = options?.shrink ?? 1; // 1 = no shrink, <1 reduce

  const availWidth = pdfWidth - margin * 2;
  const availHeight = pdfHeight - margin * 2;
  const scale = (availWidth * shrink) / canvas.width;
  const sliceHeightPx = Math.floor(availHeight / scale);

  let y = 0;
  let pageIndex = 0;
  let started = false;

  while (y < canvas.height) {
    const h = Math.min(sliceHeightPx, canvas.height - y);
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = h;
    const ctx = tmpCanvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear contexto canvas");
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

    let isMostlyBlank = false;
    try {
      if (h < 8) {
        isMostlyBlank = true;
      } else {
        const imgDataObj = ctx.getImageData(
          0,
          0,
          tmpCanvas.width,
          tmpCanvas.height
        );
        const data = imgDataObj.data;
        let nonWhite = 0;
        const totalPixels = tmpCanvas.width * tmpCanvas.height;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a === 0) continue;
          if (!(r > 250 && g > 250 && b > 250)) nonWhite++;
          if (nonWhite > totalPixels * 0.002) break;
        }
        isMostlyBlank = nonWhite / totalPixels < 0.002;
      }
    } catch {
      isMostlyBlank = false;
    }

    if (!isMostlyBlank) {
      if (!started) {
        if (startOnNewPage) pdf.addPage();
        started = true;
      } else {
        pdf.addPage();
      }

      const imgData = tmpCanvas.toDataURL("image/png");
      const renderedHeight = h * scale;
      const renderedWidth = canvas.width * scale;
      const x = margin + (availWidth - renderedWidth) / 2;
      const yPos = margin;
      pdf.addImage(imgData, "PNG", x, yPos, renderedWidth, renderedHeight);
      pageIndex++;
    }

    y += h;
  }

  return pageIndex;
}

export async function exportElementToPdf(
  element: HTMLElement,
  fileName = "plantilla.pdf",
  options?: PdfOptions
) {
  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });

  const canvas = await html2canvas(element, { scale: 2 });
  await addCanvasToPdf(pdf, canvas, options, false);

  pdf.save(fileName);
}

export async function exportElementsToPdf(
  elements: HTMLElement[],
  fileName = "plantilla.pdf",
  options?: PdfOptions
) {
  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });

  let hasAnyContent = false;

  for (const el of elements) {
    if (!el) continue;
    const canvas = await html2canvas(el, { scale: 2 });
    const pagesAdded = await addCanvasToPdf(
      pdf,
      canvas,
      options,
      hasAnyContent
    );
    if (pagesAdded > 0) hasAnyContent = true;
  }

  pdf.save(fileName);
}

// Exporta varios elementos en un único PDF intentando evitar saltos de página
// innecesarios: si el siguiente elemento cabe en el hueco restante, se coloca debajo.
// Para elementos grandes, se hace slicing (multi-página) como en exportElementsToPdf.
export async function exportElementsToPdfPacked(
  elements: HTMLElement[],
  fileName = "plantilla.pdf",
  options?: PdfOptions,
  layout?: PackedLayoutOptions
) {
  const orientation = options?.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });

  const { pdfHeight, margin, availHeight } = getPdfMetrics(pdf, options);
  const gap = layout?.gap ?? 10;
  const headerEl = layout?.headerElement;
  const headerGap = layout?.headerGap ?? 10;
  const headerCanvas = headerEl
    ? await html2canvas(headerEl, { scale: 2 })
    : null;

  let headerOffset = 0;
  let currentY = margin;
  let hasAnyContent = false;
  let canPackOnCurrentPage = true;
  let headerDrawnOnPage = false;

  if (headerCanvas) {
    const headerScale = getScaleForCanvas(pdf, headerCanvas, options);
    const headerRenderedHeight = headerCanvas.height * headerScale;
    headerOffset = headerRenderedHeight + headerGap;
  }

  const ensureHeaderOnPage = () => {
    if (!headerCanvas) return;
    if (headerDrawnOnPage) return;
    addCanvasAsSingleImage(pdf, headerCanvas, margin, options);
    headerDrawnOnPage = true;
    currentY = Math.max(currentY, margin + headerOffset);
  };

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;

    if (!canPackOnCurrentPage && hasAnyContent) {
      pdf.addPage();
      headerDrawnOnPage = false;
      currentY = margin;
      canPackOnCurrentPage = true;
    }

    const canvas = await html2canvas(el, { scale: 2 });
    const scale = getScaleForCanvas(pdf, canvas, options);
    const renderedHeight = canvas.height * scale;

    const breakBefore = layout?.breakBefore?.[i] ?? false;
    if (breakBefore && hasAnyContent) {
      pdf.addPage();
      headerDrawnOnPage = false;
      currentY = margin;
    }

    const effectiveY =
      headerCanvas && !headerDrawnOnPage
        ? Math.max(currentY, margin + headerOffset)
        : currentY;
    const remaining = pdfHeight - margin - effectiveY;
    const fitsInRemaining = renderedHeight <= remaining;
    const fitsInOnePage = renderedHeight <= availHeight - headerOffset;

    if (fitsInOnePage && (fitsInRemaining || !hasAnyContent)) {
      // si es el primer contenido, usamos la página actual; si cabe, lo colocamos debajo
      ensureHeaderOnPage();
      addCanvasAsSingleImage(pdf, canvas, currentY, options);
      currentY += renderedHeight + gap;
      hasAnyContent = true;
      continue;
    }

    if (fitsInOnePage) {
      // no cabe en el hueco: nueva página
      if (hasAnyContent) pdf.addPage();
      headerDrawnOnPage = false;
      currentY = margin;
      ensureHeaderOnPage();
      addCanvasAsSingleImage(pdf, canvas, currentY, options);
      currentY += renderedHeight + gap;
      hasAnyContent = true;
      continue;
    }

    // elemento grande: para evitar cortes raros, empezar en página nueva si ya hay contenido
    if (hasAnyContent) pdf.addPage();
    headerDrawnOnPage = false;
    currentY = margin;
    // la cabecera la gestiona el slicing por página
    const pagesAdded = await addCanvasToPdfWithHeader(
      pdf,
      canvas,
      options,
      headerCanvas,
      headerGap
    );
    if (pagesAdded > 0) hasAnyContent = true;
    // tras un elemento multi-página no intentamos packear en la última página
    canPackOnCurrentPage = false;
  }

  pdf.save(fileName);
}
