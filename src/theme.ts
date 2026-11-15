/** A color scheme in Windows Terminal format, as published by iTerm2-Color-Schemes. */
export type Scheme = {
  name: string;
  background: string;
  foreground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightPurple: string;
  brightCyan: string;
  brightWhite: string;
};

/** Accent presets, chosen to read well on both dark and light themes. Any hex colour works too. */
export const ACCENTS: { name: string; hex: string }[] = [
  { name: "UCLA Gold", hex: "#ffd100" },
  { name: "UCLA Blue", hex: "#2774ae" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Slate", hex: "#94a3b8" },
];

/** `accent` is a hex colour. */
export type Theme = { scheme: Scheme; accent: string };

const REPO = "mbadolato/iTerm2-Color-Schemes";
const KEY = "theme";

export const FEATURED = [
  "Catppuccin Mocha", "Catppuccin Latte", "TokyoNight", "Rose Pine", "Rose Pine Moon",
  "Gruvbox Dark", "Kanagawa Wave", "Everforest Dark Hard", "Nord", "Dracula",
  "GitHub Dark Dimmed", "One Half Dark",
];

const DEFAULT: Theme = {
  accent: "#ffd100",
  scheme: {
    name: "UCLA",
    background: "#121417",
    foreground: "#e6e8eb",
    black: "#1b1e23",
    red: "#ff6b6b",
    green: "#6bd68a",
    yellow: "#ffd100",
    blue: "#4d9be6",
    purple: "#b48ead",
    cyan: "#5fb3b3",
    white: "#c0c5ce",
    brightBlack: "#4f5560",
    brightRed: "#ff8787",
    brightGreen: "#8be0a2",
    brightYellow: "#ffe066",
    brightBlue: "#8bb8e8",
    brightPurple: "#c9a7c2",
    brightCyan: "#7fcaca",
    brightWhite: "#ffffff",
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend `t` of the way from color a to color b. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(ar, br)}, ${c(ag, bg)}, ${c(ab, bb)})`;
}

export function applyTheme(t: Theme): void {
  const s = t.scheme;
  const vars: Record<string, string> = {
    "--bg": s.background,
    "--surface": mix(s.background, s.foreground, 0.04),
    "--border": mix(s.background, s.foreground, 0.12),
    "--text": s.foreground,
    "--muted": mix(s.background, s.foreground, 0.7),
    "--accent": t.accent,
    "--link": s.blue,
    "--red": s.red,
    "--yellow": s.yellow,
    "--green": s.green,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
}

export function loadTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved ? JSON.parse(saved) : DEFAULT;
}

export function saveTheme(t: Theme): void {
  localStorage.setItem(KEY, JSON.stringify(t));
  applyTheme(t);
}

export function defaultTheme(): Theme {
  return DEFAULT;
}

/** Names of every scheme in the online collection (~880). */
export async function listSchemes(): Promise<string[]> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/windowsterminal`);
  if (!res.ok) throw new Error(`Theme list: GitHub returned ${res.status}`);
  const files: { name: string }[] = await res.json();
  return files.map((f) => f.name.replace(/\.json$/, ""));
}

export async function fetchScheme(name: string): Promise<Scheme> {
  const url = `https://raw.githubusercontent.com/${REPO}/master/windowsterminal/${encodeURIComponent(name)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Theme "${name}": ${res.status}`);
  return res.json();
}
