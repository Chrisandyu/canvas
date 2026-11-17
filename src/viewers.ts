// The viewer libraries load on first use, so they don't slow down app start.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./office-fonts.css";

export type Kind = "pdf" | "docx" | "pptx" | "image" | "other";

export function kindOf(name: string): Kind {
  const ext = name.split(".").pop()!.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "other";
}

/** Every page as a canvas the width of the container, appended as each one finishes. */
export async function renderPdf(data: ArrayBuffer, container: HTMLElement): Promise<void> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const doc = await pdfjs.getDocument({ data }).promise;
  const dpr = window.devicePixelRatio;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: scale * dpr });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    container.append(canvas);
    await page.render({ canvas, viewport }).promise;
  }
}

export async function renderDocx(data: ArrayBuffer, container: HTMLElement): Promise<void> {
  const { renderAsync } = await import("docx-preview");
  await renderAsync(data, container, undefined, { breakPages: true, ignoreLastRenderedPageBreak: false });
}

/** All slides one under another, scaled to the container width. */
export async function renderPptx(data: ArrayBuffer, container: HTMLElement): Promise<void> {
  const { init } = await import("pptx-preview");
  const width = container.clientWidth;
  await init(container, { width, height: (width * 9) / 16, mode: "list" }).preview(data);
}
