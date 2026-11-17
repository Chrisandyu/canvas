<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { renderPdf, renderDocx, renderPptx, kindOf } from "./viewers";

  let { id }: { id: number } = $props();

  let name = $state<string>();
  let error = $state<string>();
  let rendering = $state(true);
  let body = $state<HTMLElement>();
  /** Object URL for images, revoked when the viewer closes. */
  let imageUrl = $state<string>();
  /** Where Download saved the file. */
  let savedTo = $state<string>();

  let kind = $derived(name ? kindOf(name) : undefined);

  async function load(container: HTMLElement) {
    try {
      name = await invoke<string>("download_file", { id });
      const data = await invoke<ArrayBuffer>("read_file", { id });
      const k = kindOf(name);
      if (k === "pdf") await renderPdf(data, container);
      else if (k === "docx") await renderDocx(data, container);
      else if (k === "pptx") await renderPptx(data, container);
      else if (k === "image") imageUrl = URL.createObjectURL(new Blob([data]));
    } catch (e) {
      error = e === "offline" ? "This file hasn't been downloaded yet and you're offline." : String(e);
    }
    rendering = false;
  }

  $effect(() => {
    if (body) load(body);
    return () => imageUrl && URL.revokeObjectURL(imageUrl);
  });

  const download = () =>
    invoke<string>("save_file", { id })
      .then((path) => (savedTo = path))
      .catch((e) => (error = String(e)));
</script>

<div class="head">
  <h1>{name ?? "Loading…"}</h1>
  <button class="download" onclick={download} disabled={!name}>Download</button>
</div>

{#if savedTo}<p class="muted">Saved to {savedTo}</p>{/if}
{#if error}<p class="error">{error}</p>{/if}
{#if rendering && !error}<p class="muted">Loading…</p>{/if}
{#if kind === "other"}<p class="muted">This file type can't be shown in the app. Use Download to open it in another app.</p>{/if}

<div class="body" bind:this={body}>
  {#if imageUrl}<img src={imageUrl} alt={name} />{/if}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
  }
  h1 {
    overflow-wrap: anywhere;
  }
  .download {
    flex: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 12px;
    cursor: pointer;
  }
  /*
   * Documents bring their own fonts; anything they leave unset gets Office's default (Calibri) at
   * normal weight and spacing, never the app's font.
   */
  .body {
    font-family: Calibri, sans-serif;
    font-weight: 400;
    line-height: normal;
    letter-spacing: normal;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .body :global(canvas),
  .body img {
    max-width: 100%;
    border-radius: 4px;
  }
  /* pptx-preview puts every slide in a scroll box one slide tall; let them stack like pages. */
  .body :global(.pptx-preview-wrapper) {
    height: auto !important;
    overflow: visible !important;
    background: none !important;
  }
  .body :global(.pptx-preview-slide-wrapper) {
    margin-bottom: 12px;
  }
  /* docx-preview draws white pages; keep them inside the column. */
  .body :global(.docx-wrapper) {
    background: none;
    padding: 0;
  }
  .body :global(.docx-wrapper > section) {
    max-width: 100%;
    margin-bottom: 12px;
  }
</style>
