/**
 * Screenshot capture: resize model-viewer to target resolution, capture via toBlob(), download.
 * From @nuit-dhiver/beautifully-shadow.
 */

import { getModelViewer, hasModelLoaded } from "./viewer";
import type { CaptureSettings } from "./ui";
import { getCaptureSettings } from "./ui";

interface ModelViewerElement extends HTMLElement {
  toBlob: (options: {
    mimeType?: string;
    qualityArgument?: number;
    idealAspect?: boolean;
  }) => Promise<Blob>;
  updateComplete: Promise<void>;
  src: string;
}

async function captureScreenshot(): Promise<void> {
  if (!hasModelLoaded()) return;

  const viewer = getModelViewer() as unknown as ModelViewerElement;
  const settings = getCaptureSettings();
  const btn = document.getElementById("download-btn") as HTMLButtonElement;
  const btnText = document.getElementById("download-text")!;

  btn.disabled = true;
  btnText.textContent = "Capturing…";

  const origWidth = viewer.style.width;
  const origHeight = viewer.style.height;
  const origPosition = viewer.style.position;
  const origZIndex = viewer.style.zIndex;
  const origOpacity = viewer.style.opacity;
  const origBg = viewer.style.backgroundColor;
  const origBgImage = viewer.style.backgroundImage;

  try {
    const needsBg = !settings.transparent;
    const needsWatermark = settings.watermark.enabled && settings.watermark.text.trim().length > 0;
    const needsCanvas = needsBg || needsWatermark;

    viewer.style.position = "fixed";
    viewer.style.zIndex = "-9999";
    viewer.style.opacity = "0";
    viewer.style.width = `${settings.width}px`;
    viewer.style.height = `${settings.height}px`;

    viewer.style.backgroundColor = "transparent";
    viewer.style.backgroundImage = "";

    await viewer.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const blob = await viewer.toBlob({
      mimeType: needsCanvas ? "image/png" : settings.mimeType,
      qualityArgument: !needsCanvas && settings.mimeType === "image/jpeg" ? settings.quality : undefined,
      idealAspect: false,
    });

    const ext = settings.mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `screenshot-${settings.width}x${settings.height}.${ext}`;

    if (needsCanvas) {
      const composited = await compositeCanvas(blob, settings);
      downloadBlob(composited, filename);
    } else {
      downloadBlob(blob, filename);
    }
  } finally {
    viewer.style.width = origWidth;
    viewer.style.height = origHeight;
    viewer.style.position = origPosition;
    viewer.style.zIndex = origZIndex;
    viewer.style.opacity = origOpacity;
    viewer.style.backgroundColor = origBg;
    viewer.style.backgroundImage = origBgImage;

    await viewer.updateComplete;

    btn.disabled = false;
    btnText.textContent = "Download Screenshot";
  }
}

async function compositeCanvas(
  modelBlob: Blob,
  settings: CaptureSettings,
): Promise<Blob> {
  const { width, height } = settings;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (!settings.transparent) {
    if (settings.bgType === "gradient") {
      const grad = settings.bgGradientDir === "vertical"
        ? ctx.createLinearGradient(0, 0, 0, height)
        : ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, settings.bgColorFrom);
      grad.addColorStop(1, settings.bgColorTo);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = settings.bgColor;
    }
    ctx.fillRect(0, 0, width, height);
  }

  const img = await createImageBitmap(modelBlob);
  ctx.drawImage(img, 0, 0, width, height);

  const wm = settings.watermark;
  if (wm.enabled && wm.text.trim().length > 0) {
    drawWatermark(ctx, width, height, wm);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      settings.mimeType,
      settings.mimeType === "image/jpeg" ? settings.quality : undefined,
    );
  });
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wm: CaptureSettings["watermark"],
): void {
  const [vPos, hPos] = wm.position.split("-") as [string, string];

  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.font = `bold ${wm.fontSize}px sans-serif`;
  ctx.fillStyle = wm.color;

  if (hPos === "left") {
    ctx.textAlign = "left";
  } else if (hPos === "right") {
    ctx.textAlign = "right";
  } else {
    ctx.textAlign = "center";
  }

  if (vPos === "top") {
    ctx.textBaseline = "top";
  } else if (vPos === "bottom") {
    ctx.textBaseline = "bottom";
  } else {
    ctx.textBaseline = "middle";
  }

  const x = hPos === "left" ? wm.padding : hPos === "right" ? width - wm.padding : width / 2;
  const y = vPos === "top" ? wm.padding : vPos === "bottom" ? height - wm.padding : height / 2;

  ctx.fillText(wm.text, x, y);
  ctx.restore();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initCapture() {
  const btn = document.getElementById("download-btn")!;
  btn.addEventListener("click", () => {
    captureScreenshot();
  });
}
