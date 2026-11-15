<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { ensureLogin, signedIn } from "./api";

  /** `auto` tries the saved and Firefox sessions on its own; off right after logging out. */
  let { onReady, auto }: { onReady: () => void; auto: boolean } = $props();

  // `auto` only matters on mount.
  // svelte-ignore state_referenced_locally
  let busy = $state(auto);
  let error = $state<string>();

  /** Runs one sign-in attempt; enters the app if Bruin Learn accepts the session afterwards. */
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
      error = String(e);
    }
    busy = false;
    return false;
  }

  const detect = () =>
    attempt(() => invoke("import_browser_session")).then((ok) => {
      if (!ok) error ??= "The Firefox session has expired. Open Bruin Learn in Firefox, then try again.";
    });

  const manual = () => attempt(() => ensureLogin("canvas"));

  // On launch: the session saved last time, then Firefox. The menu only shows if both fail.
  // svelte-ignore state_referenced_locally
  if (auto) {
    attempt(() => invoke("restore_session")).then((ok) => {
      if (!ok) detect();
    });
  }
</script>

<div class="splash">
  <h1>CANVAS</h1>

  {#if !busy}
    <button class="link" onclick={manual}>Log in manually</button>
    <span class="or">OR</span>
    <button class="link" onclick={detect}>Detect browser session</button>
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
  .or {
    color: var(--muted);
  }
  .error {
    max-width: 420px;
    text-align: center;
    margin-top: 16px;
  }
</style>
