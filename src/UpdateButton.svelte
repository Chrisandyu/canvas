<script lang="ts">
  import { installUpdate, update } from "./update.svelte";
</script>

{#if update.done}
  <span class="text">Updated!</span>
{:else if update.installing}
  <span class="text">Updating...</span>
{:else if update.error}
  <span class="error">{update.error}</span>
{:else if update.available}
  <button class="text" onclick={installUpdate}>Update</button>
{/if}

<style>
  .text {
    background: none;
    border: none;
    padding: 6px 12px;
    color: var(--accent);
    font: inherit;
  }
  button.text {
    cursor: pointer;
  }
</style>
