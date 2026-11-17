<script lang="ts">
  import AssignmentRow from "./AssignmentRow.svelte";
  import PostList from "./PostList.svelte";
  import Tabs from "./Tabs.svelte";
  import type { Post } from "./api";
  import { dashboardPrefs } from "./dashboardPrefs.svelte";
  import { courseCode, courseTitle, renameCourse } from "./names.svelte";
  import { assignmentsOf, store } from "./store.svelte";
  import { gradescope } from "./gradescope.svelte";
  import { split } from "./status.svelte";
  import { clock } from "./time.svelte";
  import { moveCourse, sortCourses } from "./order.svelte";

  let { tab }: { tab: "assignments" | "posts" } = $props();

  const WEEK = 7 * 24 * 60 * 60 * 1000;

  let editing = $state<number>();

  let courses = $derived(sortCourses(store.courses ?? []));

  // Drag to reorder: press on a card and move past a small threshold to start dragging.
  // Built on pointer events; HTML drag-and-drop is unreliable inside the Tauri webview.
  const DRAG_THRESHOLD = 6;
  let press: { id: number; x: number; y: number } | undefined;
  let dragging = $state<number>();
  /** Set when a drag just ended, so the release doesn't also open the course. */
  let justDragged = false;
  /**
   * Card under the mouse. Tracked here instead of CSS :hover because WebKit leaves :hover stale on
   * cards that were moved during a drag.
   */
  let hovered = $state<number>();

  function cardAt(x: number, y: number): number | undefined {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-course]");
    return card ? Number(card.dataset.course) : undefined;
  }

  function onPointerDown(e: PointerEvent, id: number) {
    if (e.button === 0) press = { id, x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent) {
    hovered = cardAt(e.clientX, e.clientY);
    if (!press) return;
    if (dragging === undefined) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD) return;
      dragging = press.id;
    }
    if (hovered !== undefined && hovered !== dragging) moveCourse(courses, dragging, hovered);
  }

  function onPointerUp(e: PointerEvent) {
    hovered = cardAt(e.clientX, e.clientY);
    justDragged = dragging !== undefined;
    press = undefined;
    dragging = undefined;
  }

  function onCardClick(e: MouseEvent) {
    if (justDragged) e.preventDefault();
    justDragged = false;
  }

  // Every course's assignments, tagged with a short course label for the row.
  let all = $derived(
    (store.courses ?? []).flatMap((c) =>
      assignmentsOf(c.id).map((a) => ({ a, course: courseCode(c) || courseTitle(c) })),
    ),
  );
  let parts = $derived(split(all.map((x) => x.a)));
  let label = $derived(new Map(all.map((x) => [x.a.id, x.course])));

  let thisWeek = $derived(parts.upcoming.filter((a) => a.due_at && Date.parse(a.due_at) - clock.now < WEEK));
  let later = $derived(parts.upcoming.filter((a) => a.due_at && Date.parse(a.due_at) - clock.now >= WEEK));
  let recentPastDue = $derived(parts.pastDue.filter((a) => clock.now - Date.parse(a.due_at!) < WEEK));
  let recentDone = $derived(parts.done.filter((a) => a.due_at && clock.now - Date.parse(a.due_at) < 2 * WEEK));

  let separate = $derived(dashboardPrefs.separateLater);
  let showPosts = $derived(dashboardPrefs.posts && tab === "posts");

  // Posts from every course in the last 2 weeks, newest first.
  let posts = $derived(
    (store.courses ?? []).flatMap((c) =>
      (store.posts[c.id] ?? []).map((p) => ({ p, course: courseCode(c) || courseTitle(c) })),
    ),
  );
  let recentPosts = $derived(
    posts
      .filter((x) => clock.now - Date.parse(x.p.posted_at) < 2 * WEEK)
      .sort((x, y) => Date.parse(y.p.posted_at) - Date.parse(x.p.posted_at)),
  );
  let postCourse = $derived(new Map(posts.map((x) => [x.p.id, x.course])));

  function finish(e: Event, id: number) {
    renameCourse(id, (e.target as HTMLInputElement).value);
    editing = undefined;
  }

  function onKey(e: KeyboardEvent, id: number) {
    if (e.key === "Enter") finish(e, id);
    if (e.key === "Escape") editing = undefined;
  }
</script>

<h1>Courses</h1>
{#if gradescope.error}
  <p class="error">{gradescope.error}</p>
{/if}

{#if store.errors[0]}
  <p class="error">{store.errors[0]}</p>
{/if}

<!-- pointerout with no relatedTarget means the mouse left the window. -->
<svelte:window
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointerout={(e) => !e.relatedTarget && (hovered = undefined)}
/>

{#if store.courses}
  <div class="grid" class:sorting={dragging !== undefined}>
    {#each courses as c (c.id)}
      {#if editing === c.id}
        <div class="card panel">
          <span class="code">{courseCode(c) || "N/A"}</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            value={courseTitle(c)}
            placeholder="empty"
            autofocus
            onkeydown={(e) => onKey(e, c.id)}
            onblur={(e) => finish(e, c.id)}
          />
        </div>
      {:else}
        <a
          class="card panel"
          class:dragging={dragging === c.id}
          class:hover={dragging === undefined && hovered === c.id}
          href="#/course/{c.id}"
          data-course={c.id}
          draggable="false"
          onpointerdown={(e) => onPointerDown(e, c.id)}
          onclick={onCardClick}
        >
          <span class="code">{courseCode(c) || "N/A"}</span>
          <span class="name">{courseTitle(c)}</span>
          <button
            class="rename"
            title="Rename"
            onclick={(e) => {
              e.preventDefault();
              editing = c.id;
            }}>{"\uf040"}</button
          >
        </a>
      {/if}
    {/each}
  </div>
{:else if !store.errors[0]}
  <p class="muted">Loading...</p>
{/if}

{#snippet lists()}
  {#if showPosts}
    <h2>Last 2 weeks</h2>
    <PostList
      posts={recentPosts.map((x) => x.p)}
      course={(p: Post) => postCourse.get(p.id)!}
      empty="No posts in the last 2 weeks"
    />
  {:else}
    {#if recentPastDue.length}
      <h2>Past due</h2>
      <ul class="list">
        {#each recentPastDue as a (a.id)}
          <AssignmentRow {a} course={label.get(a.id)} />
        {/each}
      </ul>
    {/if}

    <h2>{separate ? "Due this week" : "Upcoming"}</h2>
    <ul class="list">
      {#each separate ? thisWeek : [...thisWeek, ...later] as a (a.id)}
        <AssignmentRow {a} course={label.get(a.id)} />
      {:else}
        <li class="muted">{separate ? "Nothing due this week" : "Nothing upcoming"}</li>
      {/each}
    </ul>

    {#if separate && later.length}
      <details>
        <summary>Later ({later.length})</summary>
        <ul class="list">
          {#each later as a (a.id)}
            <AssignmentRow {a} course={label.get(a.id)} />
          {/each}
        </ul>
      </details>
    {/if}

    {#if recentDone.length}
      <details>
        <summary>Completed in the last 2 weeks ({recentDone.length})</summary>
        <ul class="list">
          {#each recentDone as a (a.id)}
            <AssignmentRow {a} course={label.get(a.id)} />
          {/each}
        </ul>
      </details>
    {/if}
  {/if}
{/snippet}

{#if dashboardPrefs.posts}
  <Tabs
    tabs={[
      { href: "#/", label: "Assignments", active: !showPosts },
      { href: "#/posts", label: "Posts", active: showPosts },
    ]}
  >
    {@render lists()}
  </Tabs>
{:else}
  {@render lists()}
{/if}

<style>
  /* Collapses with the heading below when there are no tabs, so the gap is the same either way. */
  .grid {
    margin-bottom: 36px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--gap);
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    color: var(--text);
    text-decoration: none;
  }
  .card.dragging {
    opacity: 0.5;
  }
  .sorting .card {
    cursor: grabbing;
  }
  a.card:hover {
    background: var(--surface);
  }
  a.card.hover {
    background: var(--hover);
  }
  :global(.accent-hover) a.card.hover {
    background: var(--surface);
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .code {
    color: var(--accent);
    font-size: 0.9em;
    font-weight: 700;
    letter-spacing: 0.04em;
    min-height: 1em;
  }
  .name {
    padding-right: 20px;
  }
  input {
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 4px 6px;
    outline: none;
  }
  .rename {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    opacity: 0;
  }
  .card.hover .rename {
    opacity: 1;
  }
  .rename:hover {
    color: var(--accent);
  }
</style>
