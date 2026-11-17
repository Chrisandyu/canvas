<script lang="ts">
  import { logout } from "./api";
  import {
    gradescope,
    connectGradescope,
    disconnectGradescope,
  } from "./gradescope.svelte";
  import { dashboardPrefs, setDashboardPosts, setSeparateLater } from "./dashboard.svelte";
  import { ACTIONS, bindParts, clickCombo, keyCombo, keys, resetBinds, setBind, type Action } from "./keys.svelte";
  import { SCALE_STEP, setScale, zoom } from "./zoom.svelte";
  import { MAX_BORDER, look, setLook } from "./look.svelte";
  import { forgetLogin, loadSavedLogin, rememberLogin, setRememberLogin } from "./rememberLogin.svelte";
  import { datePrefs, setFullDate, setHour24, shortDate } from "./time.svelte";
  import { ACCENTS, FEATURED, defaultTheme, fetchScheme, listSchemes, loadTheme, saveTheme } from "./theme";

  /** A due date for the format example; no zone, so it reads as local time. */
  const SAMPLE_DUE = "2026-11-15T23:59:00";

  let theme = $state(loadTheme());
  let all = $state<string[]>([]);
  let query = $state("");
  let error = $state<string>();

  let matches = $derived(all.filter((n) => n.toLowerCase().includes(query.toLowerCase())));

  let loginError = $state<string>();
  loadSavedLogin().catch((e) => (loginError = String(e)));

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

  // Rebinding: click a binding, then press the new key (or click with the new mouse button).
  // Clicking it again with the left button cancels.
  function toggleRecording(action: Action) {
    keys.recording = keys.recording === action ? undefined : action;
  }

  // Capture phase, so the key never reaches the app's own shortcuts.
  function onRecordKey(e: KeyboardEvent) {
    const action = keys.recording;
    if (!action || ACTIONS.find((x) => x.action === action)!.mouse) return;
    const combo = keyCombo(e);
    e.preventDefault();
    e.stopPropagation();
    if (!combo) return;
    setBind(action, combo);
    keys.recording = undefined;
  }

  function onRecordClick(e: MouseEvent, action: Action) {
    const combo = clickCombo(e);
    if (keys.recording !== action || !combo) return;
    e.preventDefault();
    setBind(action, combo);
    keys.recording = undefined;
  }

  function reset() {
    theme = defaultTheme();
    saveTheme(theme);
  }
</script>

<svelte:window onkeydowncapture={onRecordKey} />

<h1>Settings</h1>

<h2>Account</h2>
<div class="box panel">
  <div class="row">
    <span>Signed into canvas</span>
    <button class="button" onclick={logout}>Log out</button>
  </div>
  <div class="row">
    {#if gradescope.connected === false}
      <span class="muted">Not signed into gradescope</span>
      <button class="button" onclick={connectGradescope}>Log in</button>
    {:else if gradescope.connected}
      <span>Signed into gradescope</span>
      <button class="button" onclick={disconnectGradescope}>Log out</button>
    {:else}
      <span class="muted">Checking gradescope...</span>
    {/if}
  </div>
  <label class="row toggle">
    <span>Remember user+pass for manual login</span>
    <input type="checkbox" checked={rememberLogin.on} onchange={(e) => setRememberLogin(e.currentTarget.checked)} />
  </label>
  {#if rememberLogin.saved}
    <div class="row attached">
      <span>Saved user <span class="muted">{rememberLogin.saved}</span></span>
      <button class="button" onclick={() => forgetLogin().catch((e) => (loginError = String(e)))}>Forget</button>
    </div>
  {:else if rememberLogin.on && !loginError}
    <p class="row attached muted">Need to login manually once to save</p>
  {/if}
  {#if loginError}<p class="note-error error">{loginError}</p>{/if}
</div>

<h2>Dashboard</h2>
<div class="box panel">
  <label class="row toggle">
    <span>Posts tab</span>
    <input type="checkbox" checked={dashboardPrefs.posts} onchange={(e) => setDashboardPosts(e.currentTarget.checked)} />
  </label>
  <label class="row toggle">
    <span>Separate assignments due after this week</span>
    <input
      type="checkbox"
      checked={dashboardPrefs.separateLater}
      onchange={(e) => setSeparateLater(e.currentTarget.checked)}
    />
  </label>
</div>

<h2>Due dates</h2>
<div class="box panel">
  <p class="row muted note">Example: {shortDate(SAMPLE_DUE)}</p>
  <label class="row toggle">
    <span>Show month and day</span>
    <input type="checkbox" checked={datePrefs.full} onchange={(e) => setFullDate(e.currentTarget.checked)} />
  </label>
  <label class="row toggle">
    <span>24-hour time</span>
    <input type="checkbox" checked={datePrefs.hour24} onchange={(e) => setHour24(e.currentTarget.checked)} />
  </label>
</div>

<h2>Style</h2>
<div class="box panel">
  <div class="row">
    <span>Size <span class="muted">{Math.round(zoom.scale * 100)}%</span></span>
    <span class="buttons">
      <button class="button" onclick={() => setScale(zoom.scale - SCALE_STEP)} title="Smaller">−</button>
      <button class="button" onclick={() => setScale(zoom.scale + SCALE_STEP)} title="Larger">+</button>
      <button class="button" onclick={() => setScale(1)}>Reset</button>
    </span>
  </div>
  <label class="row">
    <span>Border width</span>
    <span class="buttons">
      <input
        type="range"
        min="0"
        max={MAX_BORDER}
        step="0.5"
        value={look.border}
        oninput={(e) => setLook({ border: Number(e.currentTarget.value) })}
      />
      <span class="value">{look.border}px</span>
    </span>
  </label>
  <label class="row toggle">
    <span>Outline on hover</span>
    <input type="checkbox" checked={look.accentHover} onchange={(e) => setLook({ accentHover: e.currentTarget.checked })} />
  </label>
  <label class="row toggle">
    <span>Bold text</span>
    <input type="checkbox" checked={look.bold} onchange={(e) => setLook({ bold: e.currentTarget.checked })} />
  </label>
</div>

<h2>Shortcuts</h2>
<div class="box panel">
  {#each ACTIONS as { action, label, mouse } (action)}
    <div class="row">
      <span>{label}</span>
      <button
        class="bind"
        class:recording={keys.recording === action}
        onclick={() => toggleRecording(action)}
        onmousedown={(e) => onRecordClick(e, action)}
        oncontextmenu={(e) => e.preventDefault()}
      >
        {#if keys.recording === action}
          <span class="muted">{mouse ? "Right or middle click" : "Press a key"}</span>
        {:else}
          {#each bindParts(keys.binds[action]) as part, i (i)}<kbd>{part}</kbd>{/each}
        {/if}
      </button>
    </div>
  {/each}
  <div class="row end">
    <button class="button" onclick={resetBinds}>Reset shortcuts</button>
  </div>
</div>

<h2>Theme</h2>
<div class="box panel">
  <div class="row">
    <div>
      <span class="muted">Current</span>
      <b>{theme.scheme.name}</b>
    </div>
    <button class="button" onclick={reset}>Reset to default</button>
  </div>
  <div class="row stack">
    <span class="label">Accent</span>
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
  </div>
  <div class="row stack">
    <span class="label">Popular</span>
    <div class="chips">
      {#each FEATURED as name (name)}
        <button class="button" class:selected={theme.scheme.name === name} onclick={() => pick(name)}>{name}</button>
      {/each}
    </div>
  </div>
  <div class="row stack">
    <span class="label">All themes {all.length ? `(${all.length})` : ""}</span>
    {#if error}<p class="error">{error}</p>{/if}
    <input class="search" placeholder="Search themes" bind:value={query} />
    <div class="all">
      {#each matches as name (name)}
        <button class="item" class:selected={theme.scheme.name === name} onclick={() => pick(name)}>{name}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .box {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--gap);
    margin: 0;
    padding: 12px var(--pad);
  }
  .row + .row {
    border-top: 1px solid var(--border);
  }
  .row.stack {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  /* A row that belongs to the one above it: no dividing line. */
  .row + .row.attached {
    border-top: none;
    padding-top: 0;
  }
  .row.end {
    justify-content: flex-end;
  }
  .note {
    display: block;
  }
  /* Sits under the row it's about, without a dividing line. */
  .note-error {
    margin: -6px 0 0;
    padding: 0 var(--pad) 12px;
  }
  .label {
    color: var(--muted);
  }
  .toggle {
    cursor: pointer;
  }
  .row b {
    margin-left: 8px;
  }
  .button {
    background: none;
    border: var(--bw) solid var(--border);
    border-radius: var(--radius);
    padding: 5px 12px;
    cursor: pointer;
    transition: border-color 120ms, color 120ms;
  }
  .button:hover,
  .button.selected {
    border-color: var(--accent);
    color: var(--accent);
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* Drawn by the app, not the system, so it looks the same on Linux, Windows and macOS. */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 180px;
    height: 4px;
    margin: 0;
    background: var(--border);
    border-radius: 2px;
    cursor: pointer;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
  }
  .value {
    width: 3.5em;
    text-align: right;
  }
  .bind {
    display: flex;
    gap: 4px;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: 4px 6px;
    cursor: pointer;
  }
  .bind:hover,
  .bind.recording {
    border-color: var(--accent);
  }
  kbd {
    font: inherit;
    font-size: 0.85em;
    padding: 2px 8px;
    background: var(--bg);
    border: var(--bw) solid var(--border);
    border-bottom-width: 2px;
    border-radius: 5px;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .swatch {
    width: 28px;
    height: 28px;
    border-radius: 6px;
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
  .custom input::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .custom input::-webkit-color-swatch {
    border: none;
    border-radius: 5px;
  }
  .custom input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: var(--bw) solid var(--border);
    border-radius: 6px;
    background: none;
    cursor: pointer;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .search {
    background: var(--bg);
    border: var(--bw) solid var(--border);
    border-radius: var(--radius);
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
    max-height: 360px;
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
    background: var(--bg);
  }
  .item.selected {
    color: var(--accent);
  }
</style>
