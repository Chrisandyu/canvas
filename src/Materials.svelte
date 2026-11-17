<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import type { ModuleItem } from "./api";
  import { store } from "./store.svelte";

  let { courseId }: { courseId: number } = $props();

  let modules = $derived(store.modules[courseId]);

  // Nerd Font (Font Awesome) icons per item type.
  const ICONS: Record<ModuleItem["type"], string> = {
    File: "",
    Page: "",
    Assignment: "",
    Quiz: "",
    Discussion: "",
    ExternalUrl: "",
    ExternalTool: "",
    SubHeader: "",
  };

  /** Assignments, pages and files open inside the app; the rest in the browser. */
  function open(item: ModuleItem) {
    switch (item.type) {
      case "Assignment":
        location.hash = `#/course/${courseId}/a/${item.content_id}`;
        break;
      case "Page":
        location.hash = `#/course/${courseId}/page/${encodeURIComponent(item.page_url!)}`;
        break;
      case "File":
        location.hash = `#/file/${item.content_id}`;
        break;
      case "ExternalUrl":
        openUrl(item.external_url!);
        break;
      default:
        openUrl(item.html_url!);
    }
  }
</script>

{#if !modules}
  <p class="muted">Loading…</p>
{:else}
  <div class="modules">
    {#each modules as m (m.id)}
      <details class="panel">
        <summary>{m.name}</summary>
        <ul>
          {#each m.items ?? [] as item (item.id)}
            <li style:padding-left="{item.indent * 24}px">
              {#if item.type === "SubHeader"}
                <span class="subheader">{item.title}</span>
              {:else}
                <button class="item" onclick={() => open(item)}>
                  <span class="icon">{ICONS[item.type]}</span>
                  <span class="title">{item.title}</span>
                </button>
              {/if}
            </li>
          {:else}
            <li class="muted empty">Empty module</li>
          {/each}
        </ul>
      </details>
    {:else}
      <p class="muted">This course has no modules.</p>
    {/each}
  </div>
{/if}

<style>
  .modules {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  details > summary {
    margin: 0;
    padding: 14px 20px;
  }
  details[open] > summary {
    border-bottom: 1px solid var(--border);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 8px 10px;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: none;
    border: none;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
  }
  .item:hover {
    background: var(--bg);
  }
  .item:hover .title {
    color: var(--accent);
  }
  .icon {
    width: 16px;
    color: var(--muted);
    text-align: center;
  }
  .title {
    flex: 1;
  }
  .subheader {
    display: block;
    padding: 12px 10px 4px;
    font-weight: 700;
    color: var(--muted);
  }
  .empty {
    padding: 8px 10px;
  }
</style>
