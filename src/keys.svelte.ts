/**
 * Rebindable shortcuts. A binding is a string like "Mod+Z", "Escape" or "Right click", where Mod is
 * Ctrl, or Cmd on a Mac.
 */
const BINDS_KEY = "keybinds";

export const IS_MAC = navigator.userAgent.includes("Mac");

export type Action = "back" | "mark" | "undo" | "zoomIn" | "zoomOut" | "zoomReset";

/** Settings order. `mouse` actions are bound to a click, the rest to a key. */
export const ACTIONS: { action: Action; label: string; mouse?: true }[] = [
  { action: "back", label: "Go back" },
  { action: "mark", label: "Mark assignment done", mouse: true },
  { action: "undo", label: "Undo last done mark" },
  { action: "zoomIn", label: "Zoom in" },
  { action: "zoomOut", label: "Zoom out" },
  { action: "zoomReset", label: "Reset zoom" },
];

const DEFAULTS: Record<Action, string> = {
  back: "Escape",
  mark: "Right click",
  undo: "Mod+Z",
  zoomIn: "Mod+=",
  zoomOut: "Mod+-",
  zoomReset: "Mod+0",
};

export const keys = $state({
  binds: { ...DEFAULTS, ...JSON.parse(localStorage.getItem(BINDS_KEY) ?? "{}") } as Record<Action, string>,
  /** The action being rebound in Settings; shortcuts are paused meanwhile. */
  recording: undefined as Action | undefined,
});

function save(): void {
  localStorage.setItem(BINDS_KEY, JSON.stringify(keys.binds));
}

/** Taking another action's binding swaps the two, so no binding ever does two things. */
export function setBind(action: Action, combo: string): void {
  const other = (Object.keys(keys.binds) as Action[]).find((a) => a !== action && keys.binds[a] === combo);
  if (other) keys.binds[other] = keys.binds[action];
  keys.binds[action] = combo;
  save();
}

export function resetBinds(): void {
  keys.binds = { ...DEFAULTS };
  save();
}

function modifiers(e: KeyboardEvent | MouseEvent, typedSymbol = false): string[] {
  return [
    (IS_MAC ? e.metaKey : e.ctrlKey) && "Mod",
    e.altKey && "Alt",
    // A symbol like "+" already needs Shift to type, so Shift isn't part of the binding.
    e.shiftKey && !typedSymbol && "Shift",
  ].filter((m): m is string => !!m);
}

/** The binding a key press makes, or undefined for a lone modifier key. */
export function keyCombo(e: KeyboardEvent): string | undefined {
  if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return undefined;
  // "+" shares a key with "=" (and Ctrl+Shift+= types "+"), so both count as the same key.
  const key = e.key === "+" ? "=" : e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const typedSymbol = e.key.length === 1 && !/[a-z0-9]/i.test(e.key);
  return [...modifiers(e, typedSymbol), key].join("+");
}

/** The binding a right or middle click makes. Left click is left for opening things. */
export function clickCombo(e: MouseEvent): string | undefined {
  const button = { 1: "Middle click", 2: "Right click" }[e.button];
  return button && [...modifiers(e), button].join("+");
}

/** The parts of a binding as shown on screen, e.g. ["Ctrl", "+"]. */
export function bindParts(combo: string): string[] {
  return combo
    .split("+")
    .map((p) => (p === "Mod" ? (IS_MAC ? "Cmd" : "Ctrl") : p === "=" ? "+" : p === "Alt" && IS_MAC ? "Option" : p));
}
