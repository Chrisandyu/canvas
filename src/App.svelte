<script lang="ts">
  import Dashboard from "./Dashboard.svelte";
  import CoursePage, { type Tab } from "./CoursePage.svelte";
  import PageView from "./PageView.svelte";
  import Grades from "./Grades.svelte";
  import Settings from "./Settings.svelte";
  import { LOGGED_OUT } from "./api";
  import AssignmentPage from "./AssignmentPage.svelte";
  import Splash from "./Splash.svelte";
  import { undoMark } from "./status.svelte";
  import { start, store } from "./store.svelte";

  let ready = $state(false);

  // Right after logging out, the start screen waits for the user instead of signing back in.
  const auto = location.hash !== LOGGED_OUT;

  function enter() {
    if (!auto) location.hash = "#/";
    ready = true;
    start();
  }

  let hash = $state(location.hash || "#/");
  window.addEventListener("hashchange", () => (hash = location.hash || "#/"));

  let courseId = $derived(hash.match(/^#\/course\/(\d+)/)?.[1]);
  let assignmentId = $derived(hash.match(/^#\/course\/\d+\/a\/(\d+)/)?.[1]);
  let pageUrl = $derived(hash.match(/^#\/course\/\d+\/page\/([^/]+)/)?.[1]);
  let tab = $derived((hash.match(/^#\/course\/\d+\/(posts|materials)$/)?.[1] ?? "assignments") as Tab);

  // Escape goes up one level: an assignment or page returns to wherever it was opened from,
  // a course returns to the dashboard. Ctrl+Z undoes the last done mark.
  // Inputs keep both keys for themselves.
  function onKey(e: KeyboardEvent) {
    if (!ready || e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape") {
      if (assignmentId || pageUrl) history.back();
      else location.hash = "#/";
    }
    if (e.key === "z" && e.ctrlKey) undoMark();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !ready}
  <Splash onReady={enter} {auto} />
{:else}
  <nav>
    <a href="#/" class:active={hash === "#/" || courseId}>Dashboard</a>
    <a href="#/grades" class:active={hash === "#/grades"}>Grades</a>
    <a href="#/settings" class:active={hash === "#/settings"}>Settings</a>
    {#if store.offline}<span class="offline">Offline · showing saved data</span>{/if}
  </nav>

  <main>
    {#if pageUrl}
      {#key pageUrl}
        <PageView courseId={Number(courseId)} url={decodeURIComponent(pageUrl)} />
      {/key}
    {:else if assignmentId}
      {#key assignmentId}
        <AssignmentPage courseId={Number(courseId)} id={Number(assignmentId)} />
      {/key}
    {:else if courseId}
      {#key courseId}
        <CoursePage id={Number(courseId)} {tab} />
      {/key}
    {:else if hash === "#/grades"}
      <Grades />
    {:else if hash === "#/settings"}
      <Settings />
    {:else}
      <Dashboard />
    {/if}
  </main>
{/if}

<style>
  nav {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 12px 40px;
    border-bottom: 1px solid var(--border);
  }
  .offline {
    margin-left: auto;
    color: var(--yellow);
  }
  nav a {
    padding: 6px 12px;
    border-radius: var(--radius);
    color: var(--text);
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
