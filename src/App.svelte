<script lang="ts">
  import Dashboard from "./Dashboard.svelte";
  import CoursePage, { type Tab } from "./CoursePage.svelte";
  import PageView from "./PageView.svelte";
  import FileView from "./FileView.svelte";
  import Grades from "./Grades.svelte";
  import Settings from "./Settings.svelte";
  import { LOGGED_OUT } from "./api";
  import AssignmentPage from "./AssignmentPage.svelte";
  import Splash from "./Splash.svelte";
  import UpdateButton from "./UpdateButton.svelte";
  import { checkForUpdate } from "./update.svelte";
  import { undoMark } from "./status.svelte";
  import { start, store } from "./store.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  const quit = () => getCurrentWindow().close();

  checkForUpdate();

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
  let fileId = $derived(hash.match(/^#\/file\/(\d+)/)?.[1]);
  let pageUrl = $derived(hash.match(/^#\/course\/\d+\/page\/([^/]+)/)?.[1]);
  let tab = $derived((hash.match(/^#\/course\/\d+\/(posts|materials)$/)?.[1] ?? "assignments") as Tab);

  // Escape goes up one level: an assignment, page or file returns to wherever it was opened from,
  // a course returns to the dashboard. Ctrl+Z undoes the last done mark.
  // Inputs keep both keys for themselves.
  function onKey(e: KeyboardEvent) {
    if (!ready || e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape") {
      if (assignmentId || pageUrl || fileId) history.back();
      else location.hash = "#/";
    }
    if (e.key === "z" && e.ctrlKey) undoMark();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !ready}
  <Splash onReady={enter} {auto} />
{:else}
  <!-- The window has no OS title bar (decorations: false), so this nav doubles as the drag
       handle on Windows and macOS. data-tauri-drag-region starts the native window drag;
       the links inside are children, so they stay clickable. -->
  <nav data-tauri-drag-region>
    <a href="#/" class:active={hash === "#/" || courseId}>Dashboard</a>
    <a href="#/grades" class:active={hash === "#/grades"}>Grades</a>
    <a href="#/settings" class:active={hash === "#/settings"}>Settings</a>
    <span class="spacer"></span>
    {#if store.offline}<span class="offline">Offline · showing saved data</span>{/if}
    <UpdateButton />
    <button class="exit" onclick={quit} title="Quit Canvas">Exit</button>
  </nav>

  <main>
    {#if fileId}
      {#key fileId}
        <FileView id={Number(fileId)} />
      {/key}
    {:else if pageUrl}
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
    user-select: none;
    -webkit-user-select: none;
  }
  /* Pushes the offline note and Exit button to the right edge; also a draggable gap. */
  .spacer {
    margin-left: auto;
  }
  .offline {
    color: var(--yellow);
    margin-right: 8px;
  }
  /* Matches the plain nav links: no border, no background, no hover change. */
  .exit {
    background: none;
    border: none;
    padding: 6px 12px;
    border-radius: var(--radius);
    color: var(--text);
    cursor: pointer;
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
