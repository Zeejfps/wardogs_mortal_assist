<script lang="ts">
  // Native select: compact in the titlebar and gets the platform picker on
  // phones. Changing map is rare, so it does not need to be any bigger.
  import { store } from './store.svelte';
</script>

<select
  aria-label="Map"
  value={store.mapId}
  onchange={(e) => store.selectMap(e.currentTarget.value)}
>
  {#each store.library.maps as m (m.id)}
    <option value={m.id}>{m.name || 'Untitled'}</option>
  {/each}
</select>

<style>
  select {
    max-width: 45vw; background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 8px; font: inherit; font-size: 12px; font-weight: 600;
    outline: none;
  }
  select:focus { border-color: var(--accent); }
  @media (pointer: coarse) {
    select { font-size: 14px; padding: 7px 10px; border-radius: 8px; }
  }
</style>
