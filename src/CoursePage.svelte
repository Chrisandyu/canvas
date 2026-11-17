<script module lang="ts">
  export type Tab = "assignments" | "posts" | "materials";
</script>

<script lang="ts">
  import AssignmentRow from "./AssignmentRow.svelte";
  import Materials from "./Materials.svelte";
  import PostList from "./PostList.svelte";
  import Tabs from "./Tabs.svelte";
  import { courseCode, courseTitle } from "./names.svelte";
  import { split } from "./status.svelte";
  import { assignmentsOf, courseById, store } from "./store.svelte";

  let { id, tab }: { id: number; tab: Tab } = $props();

  let course = $derived(courseById(id));
  let parts = $derived(split(assignmentsOf(id)));
  let posts = $derived(store.posts[id]);
</script>

{#if course}
  <span class="code">{courseCode(course) || "N/A"}</span>
  <h1>{courseTitle(course)}</h1>
{/if}

<Tabs
  tabs={[
    { href: `#/course/${id}`, label: "Assignments", active: tab === "assignments" },
    { href: `#/course/${id}/posts`, label: "Posts", active: tab === "posts" },
    { href: `#/course/${id}/materials`, label: "Materials", active: tab === "materials" },
  ]}
>
  {#if store.errors[id]}
    <p class="error">{store.errors[id]}</p>
  {/if}

  {#if !store.groups[id]}
    <p class="muted">Loading...</p>
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
        <li class="muted">Nothing upcoming</li>
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
    <PostList {posts} empty="No posts" />
  {/if}
</Tabs>

<style>
  .code {
    display: block;
    color: var(--accent);
  }
  h1 {
    margin-top: 4px;
  }
</style>
