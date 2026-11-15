<script module lang="ts">
  export type Tab = "assignments" | "posts" | "materials";
</script>

<script lang="ts">
  import AssignmentRow from "./AssignmentRow.svelte";
  import Materials from "./Materials.svelte";
  import { externalLinks, safeHtml } from "./links";
  import { courseCode, courseTitle } from "./names.svelte";
  import { split } from "./status.svelte";
  import { assignmentsOf, courseById, store } from "./store.svelte";
  import { shortDate } from "./time.svelte";

  let { id, tab }: { id: number; tab: Tab } = $props();

  let openPost = $state<number>();

  let course = $derived(courseById(id));
  let parts = $derived(split(assignmentsOf(id)));
  let posts = $derived(store.posts[id]);
</script>

{#if course}
  <span class="code">{courseCode(course) || "N/A"}</span>
  <h1>{courseTitle(course)}</h1>
{/if}

<div class="tabs">
  <a href="#/course/{id}" class:active={tab === "assignments"}>Assignments</a>
  <a href="#/course/{id}/posts" class:active={tab === "posts"}>Posts</a>
  <a href="#/course/{id}/materials" class:active={tab === "materials"}>Materials</a>
</div>

{#if store.errors[id]}
  <p class="error">{store.errors[id]}</p>
{/if}

{#if !store.groups[id]}
  <p class="muted">Loading…</p>
{:else if tab === "materials"}
  <Materials courseId={id} />
{:else if tab === "assignments"}
  {#if parts.pastDue.length}
    <h2>Past due</h2>
    <ul class="list">
      {#each parts.pastDue as a (a.id)}<AssignmentRow {a} />{/each}
    </ul>
  {/if}

  <h2>Upcoming</h2>
  <ul class="list">
    {#each parts.upcoming as a (a.id)}
      <AssignmentRow {a} />
    {:else}
      <li class="muted">Nothing upcoming.</li>
    {/each}
  </ul>

  {#if parts.done.length}
    <details>
      <summary>Completed ({parts.done.length})</summary>
      <ul class="list">
        {#each parts.done as a (a.id)}<AssignmentRow {a} />{/each}
      </ul>
    </details>
  {/if}
{:else if posts}
  <ul class="list">
    {#each posts as p (p.id)}
      <li class="panel">
        <button class="post" onclick={() => (openPost = openPost === p.id ? undefined : p.id)}>
          <span class="title">{p.title}</span>
          <span class="muted">{p.author?.display_name ?? ""}</span>
          <span class="muted">{shortDate(p.posted_at)}</span>
        </button>
        {#if openPost === p.id}
          <div class="message" use:externalLinks>{@html safeHtml(p.message)}</div>
        {/if}
      </li>
    {:else}
      <li class="muted">No posts.</li>
    {/each}
  </ul>
{/if}

<style>
  .code {
    display: block;
    color: var(--accent);
  }
  h1 {
    margin-top: 4px;
  }
  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .tabs a {
    color: var(--text);
    text-decoration: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 7px 16px;
    cursor: pointer;
  }
  .tabs a.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--accent);
  }
  .tabs + :not(h2) {
    margin-top: 20px;
  }
  .post {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 180px 180px;
    gap: var(--gap);
    text-align: left;
    padding: 14px 20px;
    background: none;
    border: none;
    cursor: pointer;
  }
  .post:hover .title {
    color: var(--accent);
  }
  .message {
    padding: 4px 20px 18px;
    line-height: 1.65;
    overflow-x: auto;
  }
  .message :global(img) {
    max-width: 100%;
  }
  .message :global(a) {
    color: var(--accent);
  }
</style>
