<script lang="ts">
  import { installUpdate, update } from "./update.svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { ensureLogin, signedIn } from "./api";

  /** `auto` tries the saved and browser sessions on its own; off right after logging out. */
  let { onReady, auto }: { onReady: () => void; auto: boolean } = $props();

  // `auto` only matters on mount.
  // svelte-ignore state_referenced_locally
  let busy = $state(auto);
  let error = $state<string>();

  /**
   * Runs one sign-in attempt; enters the app if Bruin Learn accepts the session afterwards.
   * Offline, the session can't be checked, so the app opens with its saved data.
   */
  async function attempt(step: () => Promise<unknown>): Promise<boolean> {
    busy = true;
    error = undefined;
    try {
      await step();
      if (await signedIn()) {
        onReady();
        return true;
      }
    } catch (e) {
      if (e === "offline") {
        onReady();
        return true;
      }
      error = String(e);
    }
    busy = false;
    return false;
  }

  const detect = () =>
    attempt(() => invoke("import_browser_session")).then((ok) => {
      if (!ok) error ??= "Browser session expired, open canvas in your browser and try again";
    });

  const manual = () => attempt(() => ensureLogin("canvas"));

  // Restores the session stashed at the last logout — no browser needed.
  const resume = () =>
    attempt(() => invoke("resume_session")).then((ok) => {
      if (!ok) error ??= "No saved session to log back in to, log in manually instead";
    });

  // On launch: the session saved last time, then Firefox and Chrome. The menu only shows if both fail.
  // svelte-ignore state_referenced_locally
  if (auto) {
    attempt(() => invoke("restore_session")).then((ok) => {
      if (!ok) detect();
    });
  }
</script>

<div class="splash" data-tauri-drag-region>
  <div class="title">
    <h1>CANVAS</h1>
    {#if update.done}
      <span class="badge">Updated!</span>
    {:else if update.installing}
      <span class="badge">Updating...</span>
    {:else if update.available}
      <button class="link badge offer" onclick={installUpdate}>Update!</button>
    {/if}
  </div>

  {#if !busy}
    <button class="link" onclick={resume}>Log back in</button>
    <span class="or">OR</span>
    <button class="link" onclick={manual}>Log in manually</button>
    <span class="or">OR</span>
    <button class="link" onclick={detect}>Detect browser session</button>
    {#if update.error}<p class="error">{update.error}</p>{/if}
    {#if error}<p class="error">{error}</p>{/if}
  {/if}
</div>

<style>
  .splash {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  h1 {
    font-size: 72px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0 0 28px;
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--link);
    text-decoration: underline;
    text-underline-offset: 4px;
    font-size: 1.15em;
    cursor: pointer;
  }
  .title {
    position: relative;
  }
  /* Tilted over the top-right corner of the title. "Updating..." takes the same spot and size. */
  .badge {
    position: absolute;
    top: -6px;
    right: -64px;
    transform: rotate(18deg);
    font-size: 1.15em;
    white-space: nowrap;
  }
  /* Shorter than "Updating...", so it sits further in to look centred on the corner. A border
     instead of an underline, which drifts off the letters when the text is rotated. */
  .offer {
    right: -40px;
    text-decoration: none;
    border-bottom: 2px solid var(--link);
    line-height: 1.2;
  }
  .or {
    color: var(--muted);
  }
  .error {
    max-width: 420px;
    text-align: center;
    margin-top: 16px;
  }
</style>
