import { readGradescopeCache, refreshGradescope } from "./gradescope.svelte";
import {
  cached,
  fetchFresh,
  paths,
  type Assignment,
  type AssignmentGroup,
  type Course,
  type Module,
  type ModuleItem,
  type Post,
} from "./api";

export const store = $state({
  courses: undefined as Course[] | undefined,
  groups: {} as Record<number, AssignmentGroup[]>,
  posts: {} as Record<number, Post[]>,
  modules: {} as Record<number, Module[]>,
  /** True when the last sync couldn't reach the network; saved data is shown meanwhile. */
  offline: false,
  /** Load errors keyed by course id, or 0 for the course list. */
  errors: {} as Record<number, string>,
});

// Courses without a name are ones Canvas restricts by date; they can't be opened.
const visible = (list: Course[]) => list.filter((c) => c.name);

/** Fills in items for modules Canvas returned without them (it omits them for very long modules). */
async function withItems<T>(
  courseId: number,
  modules: Module[],
  read: (path: string) => Promise<T>,
): Promise<Module[]> {
  return Promise.all(
    modules.map(async (m) =>
      m.items ? m : { ...m, items: ((await read(paths.moduleItems(courseId, m.id))) ?? []) as ModuleItem[] },
    ),
  );
}

/** Downloads course pages that have never been fetched, so Materials open instantly and work offline. */
async function preloadPages(courseId: number, modules: Module[]): Promise<void> {
  for (const item of modules.flatMap((m) => m.items ?? [])) {
    if (item.type !== "Page") continue;
    const path = paths.page(courseId, item.page_url!);
    if ((await cached(path)) === null) await fetchFresh(path);
  }
}

/** Offline failures only set the offline flag; every other failure is shown to the user. */
function failed(key: number, e: unknown): void {
  if (e === "offline") store.offline = true;
  else store.errors[key] = String(e);
}

async function readCache(): Promise<void> {
  const courses = await cached<Course[]>(paths.courses);
  if (!courses) return;
  store.courses = visible(courses);
  await Promise.all(
    store.courses.map(async (c) => {
      const [groups, posts, modules] = await Promise.all([
        cached<AssignmentGroup[]>(paths.groups(c.id)),
        cached<Post[]>(paths.posts(c.id)),
        cached<Module[]>(paths.modules(c.id)),
      ]);
      if (groups) store.groups[c.id] = groups;
      if (posts) store.posts[c.id] = posts;
      if (modules) store.modules[c.id] = await withItems(c.id, modules, cached);
    }),
  );
}

async function refreshCourse(id: number): Promise<void> {
  try {
    const [groups, posts, modules] = await Promise.all([
      fetchFresh<AssignmentGroup[]>(paths.groups(id)),
      fetchFresh<Post[]>(paths.posts(id)),
      fetchFresh<Module[]>(paths.modules(id)).then((m) => withItems(id, m, fetchFresh)),
    ]);
    store.groups[id] = groups;
    store.posts[id] = posts;
    store.modules[id] = modules;
    delete store.errors[id];
    await preloadPages(id, modules);
  } catch (e) {
    failed(id, e);
  }
}

async function refreshCanvas(): Promise<void> {
  try {
    store.courses = visible(await fetchFresh<Course[]>(paths.courses));
    store.offline = false;
    delete store.errors[0];
  } catch (e) {
    failed(0, e);
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
