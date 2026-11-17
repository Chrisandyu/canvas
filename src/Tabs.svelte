<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";

  type Tab = { href: string; label: string; active: boolean };
  let { tabs, children }: { tabs: Tab[]; children: Snippet } = $props();

  let active = $derived(tabs.findIndex((t) => t.active));
</script>

<div class="tabs">
  {#each tabs as t (t.href)}
    <a href={t.href} class:active={t.active}>{t.label}</a>
  {/each}
</div>

{#key active}
  <div in:fly={{ y: 6, duration: 180 }}>{@render children()}</div>
{/key}

<style>
  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  a {
    color: var(--text);
    text-decoration: none;
    border: var(--bw) solid var(--border);
    border-radius: var(--radius);
    padding: 7px 16px;
    transition:
      border-color 120ms,
      color 120ms;
  }
  a.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--accent);
  }
  /* Content starts right under the bar, without the usual space above a heading. */
  div > :global(:first-child) {
    margin-top: 0;
  }
</style>
