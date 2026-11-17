<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { externalLinks, safeHtml } from "./links";
  import { courseTitle } from "./names.svelte";
  import { doneReason, gradescopeFor, isMarked, openTarget, scoreOf, toggleMark, toolOf } from "./status.svelte";
  import { assignmentsOf, courseById } from "./store.svelte";
  import { relative, shortDate, urgency } from "./time.svelte";

  let { courseId, id }: { courseId: number; id: number } = $props();

  let course = $derived(courseById(courseId));
  let a = $derived(assignmentsOf(courseId).find((x) => x.id === id));
  let tool = $derived(a && toolOf(a));
  let gs = $derived(a && gradescopeFor(a));
  let reason = $derived(a && doneReason(a));

  // Tools that need a launch from Canvas get an "Open in <tool>" button; plain uploads/quizzes just open Canvas.
  let target = $derived(tool && ["gradescope", "OWL", "Perusall"].includes(tool) ? tool : "Canvas");

  function statusLine(): string {
    const s = a!.submission;
    if (s?.excused) return "Excused";
    if (s?.score != null) return `Graded: ${s.score} / ${a!.points_possible}`;
    if (scoreOf(a!) !== null) return `Graded on gradescope: ${scoreOf(a!)} / ${a!.points_possible}`;
    if (s?.workflow_state === "graded") return "Graded, score not released";
    if (s?.submitted_at) return `Submitted ${shortDate(s.submitted_at)}`;
    if (gs) return `gradescope: ${gs.status}`;
    if (reason === "manual") return "Marked done by you";
    return "Not submitted";
  }
</script>

{#if course && a}
  <span class="course">{courseTitle(course)}</span>
  <h1>{a.name}</h1>

  <div class="facts">
    {#if a.due_at}
      <span class={urgency(a.due_at)}>{relative(a.due_at)}</span>
      <span class="muted">Due {shortDate(a.due_at)}</span>
    {:else}
      <span class="muted">No due date</span>
    {/if}
    {#if a.points_possible}<span class="muted">{a.points_possible} pts</span>{/if}
    {#if tool}<span class="muted">{tool}</span>{/if}
  </div>

  <div class="status panel" class:done={reason}>{statusLine()}</div>

  <div class="actions">
    <button class="primary" onclick={() => openUrl(openTarget(a!))}>Open in {target}</button>
    {#if reason === null || reason === "manual"}
      <button onclick={() => toggleMark(a!.id)}>{isMarked(a.id) ? "Unmark done" : "Mark as done"}</button>
    {/if}
    {#if target !== "Canvas"}
      <button onclick={() => openUrl(a!.html_url)}>View on Canvas</button>
    {/if}
  </div>

  {#if a.description}
    <div class="description selectable" use:externalLinks>{@html safeHtml(a.description)}</div>
  {:else}
    <p class="muted">No description</p>
  {/if}
{:else}
  <p class="muted">Loading...</p>
{/if}

<style>
  .course {
    color: var(--accent);
  }
  h1 {
    margin-top: 4px;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
  }
  .soon,
  .past {
    color: var(--red);
  }
  .near {
    color: var(--yellow);
  }
  .status {
    margin-top: 20px;
    padding: 12px 18px;
  }
  .status.done {
    color: var(--green);
  }
  .actions {
    display: flex;
    gap: 10px;
    margin: 16px 0 28px;
  }
  .actions button {
    background: var(--surface);
    border: var(--bw) solid var(--border);
    border-radius: var(--radius);
    padding: 8px 16px;
    cursor: pointer;
  }
  .actions button:hover {
    border-color: var(--accent);
  }
  .actions .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
    font-weight: 700;
  }
  .description {
    line-height: 1.65;
    border-top: 1px solid var(--border);
    padding-top: 20px;
    overflow-x: auto;
  }
  .description :global(img) {
    max-width: 100%;
  }
  .description :global(a) {
    color: var(--accent);
  }
  .description :global(table) {
    border-collapse: collapse;
  }
  .description :global(td),
  .description :global(th) {
    border: var(--bw) solid var(--border);
    padding: 4px 8px;
  }
</style>
