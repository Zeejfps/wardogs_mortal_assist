<script lang="ts">
  // Which built-in image, if any, the current map is drawn on. Shared by the
  // edit screen and the fire screen's "no image" placeholder.
  import { MAP_IMAGES } from './maps';
  import { store } from './store.svelte';

  const map = $derived(store.map);
</script>

<select
  aria-label="Map image"
  value={map.image ?? ''}
  onchange={(e) => (map.image = e.currentTarget.value || undefined)}
>
  <option value="">No image</option>
  {#each MAP_IMAGES as img (img.id)}
    <option value={img.id}>{img.name}</option>
  {/each}
</select>

<style>
  select {
    min-width: 0; background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 9px; font: inherit; font-size: 15px; outline: none;
  }
  select:focus { border-color: var(--accent); }
  @media (pointer: coarse) {
    select { font-size: 17px; padding: 11px 10px; border-radius: 8px; }
  }
</style>
