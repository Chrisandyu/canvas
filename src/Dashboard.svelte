<script lang="ts">
  import AssignmentRow from "./AssignmentRow.svelte";
  import { courseCode, courseTitle, renameCourse } from "./names.svelte";
  import { assignmentsOf, store } from "./store.svelte";
  import { connectGradescope, gradescope } from "./gradescope.svelte";
  import { split } from "./status.svelte";
  import { clock } from "./time.svelte";
  import { moveCourse, sortCourses } from "./order.svelte";

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

  function finish(e: Event, id: number) {
    renameCourse(id, (e.target as HTMLInputElement).value);
    editing = undefined;
  }

  function onKey(e: KeyboardEvent, id: number) {
    if (e.key === "Enter") finish(e, id);
    if (e.key === "Escape") editing = undefined;
  }
</script>

<div class="header">
  <h1>Courses</h1>
  {#if gradescope.connected === false}
    <button class="connect" onclick={connectGradescope}>Connect Gradescope</button>
  {/if}
</div>
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
            placeholder="Empty resets to Canvas name"
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
  <p class="muted">Loading…</p>
{/if}

{#if recentPastDue.length}
  <h2>Past due</h2>
  <ul class="list">
    {#each recentPastDue as a (a.id)}
      <AssignmentRow {a} course={label.get(a.id)} />
    {/each}
  </ul>
{/if}

<h2>Due this week</h2>
<ul class="list">
  {#each thisWeek as a (a.id)}
    <AssignmentRow {a} course={label.get(a.id)} />
  {:else}
    <li class="muted">Nothing due this week.</li>
  {/each}
</ul>

{#if later.length}
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

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .connect {
    background: var(--surface);
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: var(--radius);
    padding: 7px 14px;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--gap);
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px 20px;
    color: var(--text);
    text-decoration: none;
  }
  .card {
    user-select: none;
  }
  .card.dragging {
    opacity: 0.5;
  }
  .sorting .card {
    cursor: grabbing;
  }
  a.card.hover {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .code {
    color: var(--accent);
    font-size: 0.85em;
    min-height: 1em;
  }
  .name {
    font-weight: 700;
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
