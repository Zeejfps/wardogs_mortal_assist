<script lang="ts">
  // Native select: compact in the titlebar and gets the platform picker on
  // phones. Changing map is rare, so it does not need to be any bigger.
  import { getStore } from './store.svelte';

  const store = getStore();

  // The DOM hands back a plain string; only a map that actually exists is selected.
  function pick(value: string): void {
    const m = store.library.maps.find((m) => m.id === value);
    if (m) store.selectMap(m.id);
  }
</script>

<select
  aria-label="Map"
  value={store.mapId}
  onchange={(e) => pick(e.currentTarget.value)}
>
  {#each store.library.maps as m (m.id)}
    <option value={m.id}>{m.name || 'Untitled'}</option>
  {/each}
</select>

<style>
  select {
    max-width: 45vw; background-color: var(--panel-2); color: var(--text);
    border: 1px solid var(--border);
    padding: 4px 24px 4px 8px; font: inherit; font-size: 12px; font-weight: 600;
    outline: none;
  }
  select:focus { border-color: var(--accent); }
  @media (pointer: coarse) {
    select { font-size: 14px; padding: 7px 26px 7px 10px; background-position: right 10px center; }
  }
</style>
