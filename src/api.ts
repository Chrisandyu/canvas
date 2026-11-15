import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Course = {
  id: number;
  name: string;
  course_code: string;
  apply_assignment_group_weights: boolean;
  enrollments?: { type: string; computed_current_score: number | null; computed_current_grade: string | null }[];
};

export type Submission = {
  workflow_state: string;
  /** Missing when the instructor graded it but hasn't released the score. */
  score?: number | null;
  submitted_at: string | null;
  excused: boolean | null;
};

export type Assignment = {
  id: number;
  course_id: number;
  name: string;
  description: string | null;
  submission_types: string[];
  external_tool_tag_attributes?: { url: string };
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
  omit_from_final_grade?: boolean;
  submission?: Submission;
};

export type AssignmentGroup = {
  id: number;
  name: string;
  group_weight: number;
  rules: { drop_lowest?: number; drop_highest?: number; never_drop?: number[] };
  assignments: Assignment[];
};

export type Post = {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  author?: { display_name: string };
};

export type ModuleItem = {
  id: number;
  type: "File" | "Page" | "Assignment" | "Quiz" | "Discussion" | "SubHeader" | "ExternalUrl" | "ExternalTool";
  title: string;
  indent: number;
  html_url?: string;
  content_id?: number;
  page_url?: string;
  external_url?: string;
};

export type Module = {
  id: number;
  name: string;
  /** Canvas leaves this out when a module has too many items; they're then fetched separately. */
  items?: ModuleItem[];
};

export type Page = {
  title: string;
  body: string | null;
};

export const paths = {
  courses: "/courses?enrollment_state=active&include[]=total_scores&per_page=100",
  groups: (courseId: number) =>
    `/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission` +
    `&exclude_response_fields[]=rubric&per_page=100`,
  modules: (courseId: number) => `/courses/${courseId}/modules?include[]=items&per_page=100`,
  moduleItems: (courseId: number, moduleId: number) => `/courses/${courseId}/modules/${moduleId}/items?per_page=100`,
  page: (courseId: number, url: string) => `/courses/${courseId}/pages/${url}`,
  posts: (courseId: number) =>
    `/courses/${courseId}/discussion_topics?only_announcements=true&per_page=100`,
};

export type Site = "canvas" | "gradescope";

// One login window per site; every request that hits a signed-out response waits on the same promise.
const logins: Partial<Record<Site, Promise<void>>> = {};

// Set once a Canvas logout starts. Without it, the still-running refresh loop hits a 401 the moment
// cookies are cleared and pops the sign-in window open right as the user is logging out.
let signingOut = false;

export function ensureLogin(site: Site): Promise<void> {
  if (signingOut) return Promise.reject("signing out");
  logins[site] ??= (async () => {
    let done!: () => void;
    let fail!: (reason: string) => void;
    const result = new Promise<void>((resolve, reject) => ((done = resolve), (fail = reject)));
    const unlistenIn = await listen<Site>("logged-in", (e) => e.payload === site && done());
    const unlistenClosed = await listen<Site>("login-closed", (e) => e.payload === site && fail("Login window was closed"));
    try {
      await invoke("login", { site });
      await result;
    } finally {
      unlistenIn();
      unlistenClosed();
      delete logins[site];
    }
  })();
  return logins[site];
}

/** Hash the app reloads with after logging out, so the start screen doesn't sign straight back in. */
export const LOGGED_OUT = "#/logged-out";

/** Signs out of Canvas: clears the session, then reloads to the start screen. */
export async function logout(): Promise<void> {
  signingOut = true;
  await invoke("logout", { site: "canvas" });
  location.hash = LOGGED_OUT;
  location.reload();
}

/** Signs out of Gradescope only. The app stays open and signed in to Canvas. */
export async function logoutGradescope(): Promise<void> {
  await invoke("logout", { site: "gradescope" });
}

/** True when Bruin Learn accepts the current session. Network errors are thrown, not treated as signed out. */
export async function signedIn(): Promise<boolean> {
  try {
    await invoke("api_get", { path: "/users/self" });
    return true;
  } catch (e) {
    if (e === "unauthorized") return false;
    throw e;
  }
}

async function withLogin<T>(site: Site, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (e) {
    if (e !== "unauthorized") throw e;
    await ensureLogin(site);
    return request();
  }
}

export function fetchFresh<T>(path: string): Promise<T> {
  return withLogin("canvas", () => invoke<T>("api_get", { path }));
}

export async function cached<T>(path: string): Promise<T | null> {
  const body = await invoke<string | null>("cache_get", { site: "canvas", path });
  return body === null ? null : JSON.parse(body);
}

/** Gradescope page HTML. Throws "unauthorized" when signed out instead of opening a login window. */
export function gradescopeFresh(path: string): Promise<string> {
  return invoke<string>("gradescope_get", { path });
}

export function gradescopeCached(path: string): Promise<string | null> {
  return invoke<string | null>("cache_get", { site: "gradescope", path });
}
