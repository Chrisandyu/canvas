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
 * Canvas HTML made safe to render inside the app. Anything that runs here can call the app's own
 * commands, which use the user's login, so scripts, inline event handlers and `javascript:` links are
 * removed. Embedded pages (Google Docs, videos) are swapped for links: they render as blank boxes, and
 * some navigate the whole window away to a sign-in page.
 */
export function safeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, object, embed, base, form, meta, link").forEach((el) => el.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const isHandler = attr.name.startsWith("on");
      const isScriptUrl = /^\s*javascript:/i.test(attr.value);
      if (isHandler || isScriptUrl) el.removeAttribute(attr.name);
    }
  }
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
