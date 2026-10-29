import { readGradescopeCache, refreshGradescope } from "./gradescope.svelte";
import { cached, fetchFresh, paths, type Assignment, type AssignmentGroup, type Course, type Post } from "./api";

export const store = $state({
  courses: undefined as Course[] | undefined,
  groups: {} as Record<number, AssignmentGroup[]>,
  posts: {} as Record<number, Post[]>,
  /** Load errors keyed by course id, or 0 for the course list. */
  errors: {} as Record<number, string>,
});

// Courses without a name are ones Canvas restricts by date; they can't be opened.
const visible = (list: Course[]) => list.filter((c) => c.name);

async function readCache(): Promise<void> {
  const courses = await cached<Course[]>(paths.courses);
  if (!courses) return;
  store.courses = visible(courses);
  await Promise.all(
    store.courses.map(async (c) => {
      const [groups, posts] = await Promise.all([
        cached<AssignmentGroup[]>(paths.groups(c.id)),
        cached<Post[]>(paths.posts(c.id)),
      ]);
      if (groups) store.groups[c.id] = groups;
      if (posts) store.posts[c.id] = posts;
    }),
  );
}

async function refreshCourse(id: number): Promise<void> {
  try {
    const [groups, posts] = await Promise.all([
      fetchFresh<AssignmentGroup[]>(paths.groups(id)),
      fetchFresh<Post[]>(paths.posts(id)),
    ]);
    store.groups[id] = groups;
    store.posts[id] = posts;
    delete store.errors[id];
  } catch (e) {
    store.errors[id] = String(e);
  }
}

async function refreshCanvas(): Promise<void> {
  try {
    store.courses = visible(await fetchFresh<Course[]>(paths.courses));
    delete store.errors[0];
  } catch (e) {
    store.errors[0] = String(e);
    return;
  }
  await Promise.all(store.courses.map((c) => refreshCourse(c.id)));
}

const REFRESH_MS = 2 * 60 * 1000;
const FOCUS_MIN_GAP_MS = 30 * 1000;

let lastRefresh = 0;
let refreshing = false;

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  lastRefresh = Date.now();
  await Promise.all([refreshCanvas(), refreshGradescope()]);
  refreshing = false;
}

/** Show cached data immediately, then sync from Canvas and Gradescope and keep it fresh. */
export async function start(): Promise<void> {
  await Promise.all([readCache(), readGradescopeCache()]);
  await refresh();
  setInterval(refresh, REFRESH_MS);
  window.addEventListener("focus", () => {
    if (Date.now() - lastRefresh > FOCUS_MIN_GAP_MS) refresh();
  });
}

export function assignmentsOf(courseId: number): Assignment[] {
  return (store.groups[courseId] ?? []).flatMap((g) => g.assignments);
}

export function courseById(id: number): Course | undefined {
  return store.courses?.find((c) => c.id === id);
}
