import { openUrl } from "@tauri-apps/plugin-opener";

/** Svelte action: links inside Canvas HTML open in the system browser instead of replacing the app. */
export function externalLinks(node: HTMLElement) {
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    e.preventDefault();
    openUrl(link.href);
  };
  node.addEventListener("click", onClick);
  return { destroy: () => node.removeEventListener("click", onClick) };
}

/**
 * Canvas HTML with embedded pages (Google Docs, videos) swapped for links. Embeds render as blank
 * white boxes in the app's webview, and some navigate the whole window away to a sign-in page.
 */
export function withoutEmbeds(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const frame of doc.querySelectorAll("iframe")) {
    if (!frame.src) {
      frame.remove();
      continue;
    }
    const link = doc.createElement("a");
    link.href = frame.src;
    link.className = "embed";
    link.textContent = `Open embedded ${new URL(frame.src).hostname.replace(/^www\./, "")} page`;
    frame.replaceWith(link);
  }
  return doc.body.innerHTML;
}
