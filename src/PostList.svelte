<script lang="ts">
  import type { Post } from "./api";
  import { externalLinks, safeHtml } from "./links";
  import { shortDate } from "./time.svelte";

  /** `course` labels each post with its course, for lists that mix courses. */
  let { posts, course, empty }: { posts: Post[]; course?: (p: Post) => string; empty: string } = $props();

  let openPost = $state<number>();
  /**
   * Post title under the mouse. Tracked in JS because WebKit's :hover goes stale when a message
   * opening or closing moves the rows. An open post never lights up.
   */
  let hovered = $state<number>();
</script>

<ul class="list">
  {#each posts as p (p.id)}
    <li class="panel item" class:lit={hovered === p.id && openPost !== p.id}>
      <button
        class="post"
        onpointerenter={() => (hovered = p.id)}
        onpointerleave={() => hovered === p.id && (hovered = undefined)}
        onclick={() => (openPost = openPost === p.id ? undefined : p.id)}
      >
        <span class="title">
          {#if course}<span class="course">{course(p)}</span>{/if}
          <span class="name">{p.title}</span>
        </span>
        <span class="muted">{p.author?.display_name ?? ""}</span>
        <span class="muted">{shortDate(p.posted_at)}</span>
      </button>
      {#if openPost === p.id}
        <div class="message selectable" use:externalLinks>{@html safeHtml(p.message)}</div>
      {/if}
    </li>
  {:else}
    <li class="muted">{empty}</li>
  {/each}
</ul>

<style>
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
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .course {
    color: var(--accent);
  }
  /* Same hover as assignment rows (see .panel in theme.css), over the title row only. */
  .item {
    transition: background-color 120ms;
  }
  .item.lit {
    background: var(--hover);
  }
  :global(.accent-hover) .item.lit {
    background: var(--surface);
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
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
