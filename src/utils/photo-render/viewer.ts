/**
 * Manages model-viewer element: file loading (button + drag-and-drop), URL loading, and lifecycle.
 * Adapted from @nuit-dhiver/beautifully-shadow with added loadFromUrl() for Open Museum integration.
 */

let currentObjectUrl: string | null = null;
let modelLoaded = false;

function getViewer(): HTMLElement & { src: string; updateComplete: Promise<void> } {
  return document.getElementById("viewer") as HTMLElement & {
    src: string;
    updateComplete: Promise<void>;
  };
}

function onModelReady(fileName: string) {
  const fileNameEl = document.getElementById("file-name");
  if (fileNameEl) fileNameEl.textContent = fileName;

  const emptyState = document.getElementById("empty-state");
  if (emptyState) emptyState.classList.add("hidden");

  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement | null;
  if (downloadBtn) downloadBtn.disabled = false;
}

function loadFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    return;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentObjectUrl = URL.createObjectURL(file);
  const viewer = getViewer();
  viewer.src = currentObjectUrl;
  modelLoaded = true;

  onModelReady(file.name);
}

/**
 * Load a 3D model from a URL (used when navigating from Open Museum work pages).
 */
export function loadFromUrl(url: string, displayName?: string) {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  const viewer = getViewer();
  viewer.src = url;
  modelLoaded = true;

  const name = displayName || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "Model");
  onModelReady(name);
}

function initDragAndDrop() {
  const main = document.querySelector("main")!;
  const overlay = document.getElementById("drop-overlay")!;

  let dragCounter = 0;

  main.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  });

  main.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  });

  main.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  main.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");

    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  });
}

function initFileInput() {
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) loadFile(file);
    fileInput.value = "";
  });
}

export function getModelViewer() {
  return getViewer();
}

export function hasModelLoaded(): boolean {
  return modelLoaded;
}

export function initViewer() {
  initFileInput();
  initDragAndDrop();
}
