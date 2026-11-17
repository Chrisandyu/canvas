const POSTS_KEY = "dashboardPosts";
const SEPARATE_LATER_KEY = "separateLater";

export const dashboardPrefs = $state({
  /** Shows the Posts tab on the dashboard. On by default. */
  posts: localStorage.getItem(POSTS_KEY) !== "false",
  /** Puts assignments due after this week in their own folded "Later" list. On by default. */
  separateLater: localStorage.getItem(SEPARATE_LATER_KEY) !== "false",
});

export function setDashboardPosts(on: boolean): void {
  dashboardPrefs.posts = on;
  localStorage.setItem(POSTS_KEY, String(on));
}

export function setSeparateLater(on: boolean): void {
  dashboardPrefs.separateLater = on;
  localStorage.setItem(SEPARATE_LATER_KEY, String(on));
}
