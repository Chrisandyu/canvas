import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

const SCALE_KEY = "uiScale";
/** Laptop screens start a bit smaller than monitors. */
const LAPTOP_SCALE = 0.9;
export const SCALE_STEP = 0.1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

export const zoom = $state({
  /** Starting size for the screen the window is on. */
  screen: 1,
  /** The user's own scale on top of that, from Settings or the zoom keys. */
  scale: Number(localStorage.getItem(SCALE_KEY) ?? 1),
});

let applied = 0;

function apply(): void {
  const level = zoom.screen * zoom.scale;
  if (level === applied) return;
  applied = level;
  getCurrentWebview().setZoom(level);
}

async function detectScreen(): Promise<void> {
  zoom.screen = (await invoke<boolean>("on_laptop_screen")) ? LAPTOP_SCALE : 1;
  apply();
}

export function setScale(scale: number): void {
  zoom.scale = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) * 100) / 100;
  localStorage.setItem(SCALE_KEY, String(zoom.scale));
  apply();
}

/** Sets the size now and again whenever the window lands on another screen (e.g. a monitor is unplugged). */
export function startZoom(): void {
  detectScreen();
  const win = getCurrentWindow();
  win.onMoved(detectScreen);
  win.onResized(detectScreen);
  win.onScaleChanged(detectScreen);
}
