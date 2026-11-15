<script lang="ts">
  import { cached, fetchFresh, paths, type Page } from "./api";
  import { externalLinks, safeHtml } from "./links";
  import { courseTitle } from "./names.svelte";
  import { courseById } from "./store.svelte";

  let { courseId, url }: { courseId: number; url: string } = $props();

  let course = $derived(courseById(courseId));
  let page = $state<Page>();
  let error = $state<string>();

  // Saved copy first (instant, works offline), then the current version if online.
  // svelte-ignore state_referenced_locally
  const path = paths.page(courseId, url);
  cached<Page>(path).then((hit) => hit && (page = hit));
  fetchFresh<Page>(path)
    .then((fresh) => (page = fresh))
    .catch((e) => {
      if (e !== "offline") error = String(e);
    });
</script>

{#if course}<span class="course">{courseTitle(course)}</span>{/if}

{#if error}<p class="error">{error}</p>{/if}

{#if page}
  <h1>{page.title}</h1>
  {#if page.body}
    <div class="body" use:externalLinks>{@html safeHtml(page.body)}</div>
  {:else}
    <p class="muted">This page is empty.</p>
  {/if}
{:else if !error}
  <p class="muted">Loading…</p>
{/if}

<style>
  .course {
    color: var(--accent);
  }
  h1 {
    margin-top: 4px;
  }
  .body {
    line-height: 1.65;
    overflow-x: auto;
  }
  .body :global(img) {
    max-width: 100%;
  }
  .body :global(a) {
    color: var(--accent);
  }
  .body :global(a.embed) {
    display: inline-block;
    padding: 10px 16px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    text-decoration: none;
  }
  .body :global(table) {
    border-collapse: collapse;
  }
  .body :global(td),
  .body :global(th) {
    border: 1px solid var(--border);
    padding: 4px 8px;
  }
</style>
