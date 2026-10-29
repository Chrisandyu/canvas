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

export const paths = {
  courses: "/courses?enrollment_state=active&include[]=total_scores&per_page=100",
  groups: (courseId: number) =>
    `/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission` +
    `&exclude_response_fields[]=rubric&per_page=100`,
  posts: (courseId: number) =>
    `/courses/${courseId}/discussion_topics?only_announcements=true&per_page=100`,
};

export type Site = "canvas" | "gradescope";

// One login window per site; every request that hits a signed-out response waits on the same promise.
const logins: Partial<Record<Site, Promise<void>>> = {};

export function ensureLogin(site: Site): Promise<void> {
  logins[site] ??= (async () => {
    let done!: () => void;
    const loggedIn = new Promise<void>((r) => (done = r));
    const unlisten = await listen<Site>("logged-in", (e) => e.payload === site && done());
    await invoke("login", { site });
    await loggedIn;
    unlisten();
    delete logins[site];
  })();
  return logins[site];
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
