<script lang="ts">
  import type { Assignment } from "./api";
  import { doneReason, gradescopeFor, scoreOf, toggleMark } from "./status.svelte";
  import { relative, shortDate, urgency } from "./time.svelte";

  let { a, course }: { a: Assignment; course?: string } = $props();

  let reason = $derived(doneReason(a));

  // Right-click toggles a manual done mark. Work already submitted on Canvas or Gradescope stays done.
  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (reason === null || reason === "manual") toggleMark(a.id);
  }

  function status(): string {
    const s = a.submission;
    if (s?.excused) return "Excused";
    const score = scoreOf(a);
    if (score !== null) return `${score} / ${a.points_possible ?? "?"}`;
    const gs = gradescopeFor(a);
    if (gs?.submitted) return gs.status;
    if (s?.submitted_at) return "Submitted";
    if (reason === "manual") return "Done";
    return "";
  }
</script>

<li>
  <a class="row panel" class:done={reason} href="#/course/{a.course_id}/a/{a.id}" oncontextmenu={onContextMenu}>
    <span class="title">
      {#if course}<span class="course">{course}</span>{/if}
      <span class="name">{a.name}</span>
    </span>
    {#if status()}<span class="status">{status()}</span>{/if}
    {#if a.due_at}
      <span class="due">
        <span class={urgency(a.due_at)}>{relative(a.due_at)}</span>
        <span class="muted small">{shortDate(a.due_at)}</span>
      </span>
    {:else}
      <span class="due muted">No due date</span>
    {/if}
  </a>
</li>

<style>
  .row {
    display: flex;
    gap: 24px;
    align-items: center;
    padding: 14px 20px;
    color: var(--text);
    text-decoration: none;
  }
  .row:hover {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .title {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .done .name {
    color: var(--muted);
  }
  .course {
    color: var(--accent);
  }
  .due {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    white-space: nowrap;
  }
  .small {
    font-size: 0.85em;
  }
  .soon,
  .past {
    color: var(--red);
  }
  .near {
    color: var(--yellow);
  }
  .status {
    color: var(--green);
    white-space: nowrap;
  }
</style>
