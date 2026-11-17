/** Appearance options from Settings, applied as a CSS variable and classes on <html>. */
const LOOK_KEY = "look";

export const MAX_BORDER = 4;

export const look = $state({
  /** Border width of boxes and buttons, in px. */
  border: 0,
  /** Clickable boxes get an accent outline under the mouse instead of brightening. */
  accentHover: false,
  bold: false,
  ...JSON.parse(localStorage.getItem(LOOK_KEY) ?? "{}"),
});

function apply(): void {
  const root = document.documentElement;
  root.style.setProperty("--bw", `${look.border}px`);
  root.classList.toggle("accent-hover", look.accentHover);
  root.classList.toggle("bold", look.bold);
}

export function setLook(change: Partial<typeof look>): void {
  Object.assign(look, change);
  localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  apply();
}

apply();
