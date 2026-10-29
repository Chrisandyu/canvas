import type { Assignment } from "./api";
import { gradescope, normalizeName, type GsAssignment } from "./gradescope.svelte";
import { clock } from "./time.svelte";

const KEY = "doneMarks";

/** Assignment ids the user marked done by hand. */
const marks = $state<Record<number, true>>(JSON.parse(localStorage.getItem(KEY) ?? "{}"));

/** Ids toggled this session, newest last, for Ctrl+Z. */
const history: number[] = [];

function flip(id: number): void {
  if (marks[id]) delete marks[id];
  else marks[id] = true;
  localStorage.setItem(KEY, JSON.stringify(marks));
}

export function toggleMark(id: number): void {
  flip(id);
  history.push(id);
}

export function undoMark(): void {
  const id = history.pop();
  if (id !== undefined) flip(id);
}

export function isMarked(id: number): boolean {
  return !!marks[id];
}

/** The Gradescope row for a Gradescope-linked Canvas assignment, matched by name. */
export function gradescopeFor(a: Assignment): GsAssignment | undefined {
  if (!a.external_tool_tag_attributes?.url.includes("gradescope.com")) return undefined;
  return gradescope.byName[normalizeName(a.name)];
}

/** Canvas score, or Gradescope's when the instructor hasn't released it on Canvas. */
export function scoreOf(a: Assignment): number | null {
  return a.submission?.score ?? gradescopeFor(a)?.score ?? null;
}

export type DoneReason = "canvas" | "gradescope" | "manual";

export function doneReason(a: Assignment): DoneReason | null {
  const s = a.submission;
  if (s && (s.submitted_at !== null || s.workflow_state === "graded" || s.excused)) return "canvas";
  if (gradescopeFor(a)?.submitted) return "gradescope";
  if (marks[a.id]) return "manual";
  return null;
}

export function isDone(a: Assignment): boolean {
  return doneReason(a) !== null;
}

export function isPastDue(a: Assignment): boolean {
  return !isDone(a) && a.due_at !== null && Date.parse(a.due_at) < clock.now;
}

const byDue = (a: Assignment, b: Assignment) =>
  (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity);

/** Splits assignments into upcoming (soonest first), past due and done (most recent first). */
export function split(list: Assignment[]) {
  const sorted = [...list].sort(byDue);
  return {
    upcoming: sorted.filter((a) => !isDone(a) && !isPastDue(a)),
    pastDue: sorted.filter(isPastDue).reverse(),
    done: sorted.filter(isDone).reverse(),
  };
}

/** Where the assignment is actually done, e.g. "Gradescope", "OWL", "Perusall". */
export function toolOf(a: Assignment): string | null {
  const url = a.external_tool_tag_attributes?.url;
  if (url) {
    const host = new URL(url).hostname;
    if (host.includes("gradescope")) return "Gradescope";
    if (host.includes("cengage")) return "OWL";
    if (host.includes("perusall")) return "Perusall";
    if (host.includes("quiz-lti")) return "Quiz";
    return host;
  }
  if (a.submission_types.includes("online_quiz")) return "Quiz";
  if (a.submission_types.includes("online_upload")) return "Upload";
  if (a.submission_types.includes("online_text_entry")) return "Text entry";
  return null;
}

/** Gradescope links go straight to Gradescope; other tools launch through the Canvas page. */
export function openTarget(a: Assignment): string {
  return gradescopeFor(a)?.url ?? a.html_url;
}
