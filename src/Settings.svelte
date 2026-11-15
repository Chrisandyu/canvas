<script lang="ts">
  import { logout } from "./api";
  import { datePrefs, setFullDate } from "./time.svelte";
  import { ACCENTS, FEATURED, defaultTheme, fetchScheme, listSchemes, loadTheme, saveTheme } from "./theme";

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

  function setAccent(accent: string) {
    theme = { ...theme, accent };
    saveTheme(theme);
  }

  function reset() {
    theme = defaultTheme();
    saveTheme(theme);
  }
</script>

<h1>Settings</h1>

<h2>Account</h2>
<div class="current panel">
  <span>Signed in to Bruin Learn and Gradescope</span>
  <button class="reset" onclick={logout}>Log out</button>
</div>

<h2>Due dates</h2>
<label class="current panel toggle">
  <span>Show month and day <span class="muted">({datePrefs.full ? "Sun, Nov 15, 23:59" : "Sun 23:59"})</span></span>
  <input type="checkbox" checked={datePrefs.full} onchange={(e) => setFullDate(e.currentTarget.checked)} />
</label>

<h2>Theme</h2>
<div class="current panel">
  <div>
    <span class="muted">Current</span>
    <b>{theme.scheme.name}</b>
  </div>
  <button class="reset" onclick={reset}>Reset to default</button>
</div>

<h2>Accent</h2>
<div class="swatches">
  {#each ACCENTS as { name, hex } (hex)}
    <button
      class="swatch"
      class:selected={theme.accent === hex}
      style:background={hex}
      title={name}
      onclick={() => setAccent(hex)}
    ></button>
  {/each}
  <label class="custom" title="Custom colour">
    <input type="color" value={theme.accent} oninput={(e) => setAccent(e.currentTarget.value)} />
    Custom
  </label>
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
  .toggle {
    cursor: pointer;
  }
  /* Drawn by hand: WebKitGTK's native checkbox draws its tick outside a resized box. */
  .toggle input {
    appearance: none;
    flex: none;
    width: 20px;
    height: 20px;
    margin: 0;
    display: grid;
    place-content: center;
    border: 2px solid var(--muted);
    border-radius: 5px;
    cursor: pointer;
  }
  .toggle input:checked {
    background: var(--accent);
    border-color: var(--accent);
  }
  .toggle input:checked::after {
    content: "";
    width: 5px;
    height: 10px;
    margin-top: -2px;
    border: solid var(--bg);
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg);
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
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .swatch {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 3px;
  }
  .swatch:hover {
    transform: scale(1.08);
  }
  .swatch.selected {
    outline-color: var(--text);
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
    cursor: pointer;
  }
  .custom input {
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: none;
    cursor: pointer;
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
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .search {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    outline: none;
  }
  .search:focus {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
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
