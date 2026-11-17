import { openUrl } from "@tauri-apps/plugin-opener";

/** Canvas file links, e.g. `https://bruinlearn.ucla.edu/courses/1/files/2?wrap=1`. */
const CANVAS_FILE = /^https:\/\/bruinlearn\.ucla\.edu\/(?:courses\/\d+\/)?files\/(\d+)/;

/**
 * Svelte action for Canvas HTML: links to Canvas files open in the app's file viewer, every other
 * link opens in the system browser instead of replacing the app.
 */
export function externalLinks(node: HTMLElement) {
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    e.preventDefault();
    const file = link.href.match(CANVAS_FILE);
    if (file) location.hash = `#/file/${file[1]}`;
    else openUrl(link.href);
  };
  node.addEventListener("click", onClick);
  return { destroy: () => node.removeEventListener("click", onClick) };
}

/**
 * Canvas HTML made safe to render inside the app. Anything that runs here can call the app's own
 * commands, which use the user's login, so scripts, inline event handlers and `javascript:` links are
 * removed. Embedded pages (Google Docs, videos) stay, sandboxed so they can't navigate the whole
 * window away (some jump to a sign-in page), with a link underneath for ones that won't load.
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
    if (!/^https?:/.test(frame.src)) {
      frame.remove();
      continue;
    }
    // No allow-top-navigation or allow-popups: the embed stays inside its box.
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    frame.setAttribute("loading", "lazy");
    frame.removeAttribute("width");
    if (!/^\d+$/.test(frame.getAttribute("height") ?? "")) frame.setAttribute("height", "480");
    const box = doc.createElement("div");
    box.className = "embed";
    const link = doc.createElement("a");
    link.href = frame.src;
    link.textContent = `Open ${new URL(frame.src).hostname.replace(/^www\./, "")} in browser`;
    frame.replaceWith(box);
    box.append(frame, link);
  }
  return doc.body.innerHTML;
}
