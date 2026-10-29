import type { Course } from "./api";

const KEY = "courseNames";

const custom = $state<Record<number, string>>(JSON.parse(localStorage.getItem(KEY) ?? "{}"));

// "26F-CHEM-20A-LEC-1 Chemical Structure" → code "CHEM 20A", title "Chemical Structure"
const UCLA_NAME = /^\d{2}[A-Z0-9]-([A-Z&]+)-([0-9A-Z]+)-[A-Z]+-\w+\s+(.+)$/;

function parse(c: Course): { code: string; title: string } {
  const m = c.name.match(UCLA_NAME);
  if (!m) return { code: "", title: c.name };
  return { code: `${m[1]} ${m[2]}`, title: m[3].replace(/\s*\(cross-listed\)$/i, "") };
}

export function courseTitle(c: Course): string {
  return custom[c.id] ?? parse(c).title;
}

export function courseCode(c: Course): string {
  return parse(c).code;
}

/** Empty name resets to the Canvas name. */
export function renameCourse(id: number, name: string): void {
  const trimmed = name.trim();
  if (trimmed) custom[id] = trimmed;
  else delete custom[id];
  localStorage.setItem(KEY, JSON.stringify(custom));
}
