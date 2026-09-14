<script lang="ts">
  // Which built-in image, if any, the current map is drawn on. Shared by the
  // edit screen and the fire screen's "no image" placeholder.
  import { MAP_IMAGES } from './maps';
  import { getStore } from './store.svelte';

  const store = getStore();
  const map = $derived(store.map);

  // The DOM hands back a plain string; anything but a known image (the "No image" option) clears it.
  function pick(value: string): void {
    const img = MAP_IMAGES.find((i) => i.id === value);
    map.image = img?.id;
  }
</script>

<select
  aria-label="Map image"
  value={map.image ?? ''}
  onchange={(e) => pick(e.currentTarget.value)}
>
  <option value="">No image</option>
  {#each MAP_IMAGES as img (img.id)}
    <option value={img.id}>{img.name}</option>
  {/each}
</select>

<style>
  select {
    min-width: 0; background-color: var(--bg); color: var(--text);
    border: 1px solid var(--border);
    padding: 7px 26px 7px 9px; font: inherit; font-size: 15px; outline: none;
  }
  select:focus { border-color: var(--accent); }
  @media (pointer: coarse) {
    select { font-size: 17px; padding: 11px 28px 11px 10px; background-position: right 10px center; }
  }
</style>
