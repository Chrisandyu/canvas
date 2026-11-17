import { mount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.svelte";
import { applyTheme, loadTheme } from "./theme";
import "./theme.css";
import "./look.svelte";

applyTheme(loadTheme());
// No browser menu (Back, Reload, Inspect…) on right click anywhere in the app.
window.addEventListener("contextmenu", (e) => e.preventDefault());
try {
  mount(App, { target: document.body });
} finally {
  // The window starts hidden (tauri.conf.json) so it never shows a blank white frame before the
  // theme and first screen are drawn.
  // Called directly: a hidden window doesn't run requestAnimationFrame.
  getCurrentWindow().show();
}
