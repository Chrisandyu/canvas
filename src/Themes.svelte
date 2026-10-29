<script lang="ts">
  import { ACCENTS, FEATURED, defaultTheme, fetchScheme, listSchemes, loadTheme, saveTheme, type Accent } from "./theme";

  let theme = $state(loadTheme());
  let all = $state<string[]>([]);
  let query = $state("");
  let error = $state<string>();

  let matches = $derived(all.filter((n) => n.toLowerCase().includes(query.toLowerCase())));

  listSchemes()
    .then((names) => (all = names))
    .catch((e) => (error = String(e)));

  async function pick(name: string) {
    try {
      theme = { scheme: await fetchScheme(name), accent: theme.accent };
      saveTheme(theme);
    } catch (e) {
      error = String(e);
    }
  }

  function setAccent(accent: Accent) {
    theme = { ...theme, accent };
    saveTheme(theme);
  }

  function reset() {
    theme = defaultTheme();
    saveTheme(theme);
  }
</script>

<h1>Themes</h1>

<div class="current panel">
  <div>
    <span class="muted">Current</span>
    <b>{theme.scheme.name}</b>
  </div>
  <button class="reset" onclick={reset}>Reset to default</button>
</div>

<h2>Accent</h2>
<div class="swatches">
  {#each ACCENTS as key (key)}
    <button
      class="swatch"
      class:selected={theme.accent === key}
      style:background={theme.scheme[key]}
      title={key}
      onclick={() => setAccent(key)}
    ></button>
  {/each}
</div>

<h2>Popular</h2>
<div class="chips">
  {#each FEATURED as name (name)}
    <button class="chip panel" class:selected={theme.scheme.name === name} onclick={() => pick(name)}>{name}</button>
  {/each}
</div>

<h2>All themes {all.length ? `(${all.length})` : ""}</h2>
{#if error}<p class="error">{error}</p>{/if}
<input class="search panel" placeholder="Search themes…" bind:value={query} />
<div class="all">
  {#each matches as name (name)}
    <button class="item" class:selected={theme.scheme.name === name} onclick={() => pick(name)}>{name}</button>
  {/each}
</div>

<style>
  .current {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px var(--pad);
  }
  .current b {
    margin-left: 8px;
  }
  .reset {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 12px;
    cursor: pointer;
  }
  .swatches {
    display: flex;
    gap: 8px;
  }
  .swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .swatch.selected {
    border-color: var(--text);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    padding: 6px 12px;
    cursor: pointer;
  }
  .chip:hover,
  .chip.selected {
    border-color: var(--accent);
  }
  .search {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    outline: none;
  }
  .search:focus {
    border-color: var(--accent);
  }
  .all {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 2px;
    margin-top: var(--gap);
    max-height: 420px;
    overflow-y: auto;
  }
  .item {
    background: none;
    border: none;
    text-align: left;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .item:hover {
    background: var(--surface);
  }
  .item.selected {
    color: var(--accent);
  }
</style>
