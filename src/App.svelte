<script lang="ts">
  import Dashboard from "./Dashboard.svelte";
  import CoursePage from "./CoursePage.svelte";
  import Grades from "./Grades.svelte";
  import Themes from "./Themes.svelte";
  import AssignmentPage from "./AssignmentPage.svelte";
  import { undoMark } from "./status.svelte";

  let hash = $state(location.hash || "#/");
  window.addEventListener("hashchange", () => (hash = location.hash || "#/"));

  let courseId = $derived(hash.match(/^#\/course\/(\d+)/)?.[1]);
  let assignmentId = $derived(hash.match(/^#\/course\/\d+\/a\/(\d+)/)?.[1]);

  // Escape goes up one level (assignment → course → dashboard); Ctrl+Z undoes the last done mark.
  // Inputs keep both keys for themselves.
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape") location.hash = assignmentId ? `#/course/${courseId}` : "#/";
    if (e.key === "z" && e.ctrlKey) undoMark();
  }
</script>

<svelte:window onkeydown={onKey} />

<nav>
  <a href="#/" class:active={hash === "#/" || courseId}>Dashboard</a>
  <a href="#/grades" class:active={hash === "#/grades"}>Grades</a>
  <a href="#/themes" class:active={hash === "#/themes"}>Themes</a>
</nav>

<main>
  {#if assignmentId}
    {#key assignmentId}
      <AssignmentPage courseId={Number(courseId)} id={Number(assignmentId)} />
    {/key}
  {:else if courseId}
    {#key courseId}
      <CoursePage id={Number(courseId)} />
    {/key}
  {:else if hash === "#/grades"}
    <Grades />
  {:else if hash === "#/themes"}
    <Themes />
  {:else}
    <Dashboard />
  {/if}
</main>

<style>
  nav {
    display: flex;
    gap: 4px;
    padding: 12px 40px;
    border-bottom: 1px solid var(--border);
  }
  nav a {
    padding: 6px 12px;
    border-radius: var(--radius);
    color: var(--muted);
    text-decoration: none;
  }
  nav a:hover {
    color: var(--text);
  }
  nav a.active {
    color: var(--accent);
    background: var(--surface);
  }
</style>
