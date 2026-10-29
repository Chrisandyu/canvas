import { ensureLogin, gradescopeCached, gradescopeFresh } from "./api";

export type GsAssignment = {
  id: string;
  name: string;
  status: string;
  /** Points earned, when Gradescope shows a score like "15.0 / 15.0". */
  score: number | null;
  submitted: boolean;
  url: string;
};

export const gradescope = $state({
  /** undefined until the first check, false when signed out. */
  connected: undefined as boolean | undefined,
  /**
   * Keyed by normalized name. Canvas LTI links can't be matched by id: assignments copied from a
   * previous term keep pointing at the old Gradescope id.
   */
  byName: {} as Record<string, GsAssignment>,
  error: undefined as string | undefined,
});

const BASE = "https://www.gradescope.com";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

/** Course ids from the most recent term on the account page. */
function courseIds(doc: Document): string[] {
  const term = doc.querySelector(".courseList--coursesForTerm");
  if (!term) throw new Error("Gradescope account page layout changed");
  return [...term.querySelectorAll<HTMLAnchorElement>("a.courseBox[href^='/courses/']")].map(
    (a) => a.getAttribute("href")!.split("/")[2],
  );
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Rows for closed assignments you never opened have no link or id; they're skipped. */
function assignments(doc: Document, courseId: string): GsAssignment[] {
  const rows = doc.querySelectorAll("#assignments-student-table tbody tr");
  return [...rows].flatMap((row) => {
    const button = row.querySelector<HTMLElement>("th [data-assignment-id]");
    const href = row.querySelector("th a")?.getAttribute("href");
    const id = button?.dataset.assignmentId ?? href?.match(/assignments\/(\d+)/)?.[1];
    if (!id) return [];
    const status = row.querySelector(".submissionStatus")!.textContent!.trim().replace(/\s+/g, " ");
    return [
      {
        id,
        name: row.querySelector("th")!.textContent!.trim(),
        status,
        score: status.match(/^([\d.]+) \/ [\d.]+$/) ? parseFloat(status) : null,
        submitted: status !== "No Submission",
        url: `${BASE}/courses/${courseId}/assignments/${id}`,
      },
    ];
  });
}

async function load(read: (path: string) => Promise<string | null>): Promise<boolean> {
  const account = await read("/account");
  if (account === null) return false;
  const found: Record<string, GsAssignment> = {};
  for (const id of courseIds(parse(account))) {
    const page = await read(`/courses/${id}`);
    if (page === null) continue;
    for (const a of assignments(parse(page), id)) found[normalizeName(a.name)] = a;
  }
  gradescope.byName = found;
  return true;
}

export async function refreshGradescope(): Promise<void> {
  try {
    await load(gradescopeFresh);
    gradescope.connected = true;
    gradescope.error = undefined;
  } catch (e) {
    if (e === "unauthorized") gradescope.connected = false;
    else gradescope.error = String(e);
  }
}

export async function readGradescopeCache(): Promise<void> {
  try {
    await load(gradescopeCached);
  } catch (e) {
    gradescope.error = String(e);
  }
}

export async function connectGradescope(): Promise<void> {
  await ensureLogin("gradescope");
  await refreshGradescope();
}
