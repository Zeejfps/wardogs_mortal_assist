<script lang="ts">
  import EditScreen from './lib/EditScreen.svelte';
  import FireScreen from './lib/FireScreen.svelte';
  import InstallBar from './lib/InstallBar.svelte';
  import MapPicker from './lib/MapPicker.svelte';
  import { store } from './lib/store.svelte';

  // Two screens: 'fire' is the in-game view (tap a target, read the range),
  // 'edit' is where maps and targets are entered and shared.
  let screen = $state<'fire' | 'edit'>('fire');

  function toggle(): void {
    if (screen === 'edit') store.pruneBlank();
    screen = screen === 'fire' ? 'edit' : 'fire';
  }

  // Save everything whenever any of it changes.
  $effect(() => {
    store.persist();
  });
</script>

<header class="titlebar">
  <span class="title">Mortar Calc</span>
  <MapPicker />
  <button class="mode" class:active={screen === 'edit'} onclick={toggle}>
    {screen === 'fire' ? 'Edit' : 'Done'}
  </button>
</header>

{#if screen === 'fire'}
  <FireScreen />
{:else}
  <EditScreen />
{/if}

<InstallBar />

<style>
  .titlebar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .titlebar .title {
    flex: 1; font-weight: 600; font-size: 12px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
  }
  .mode {
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .mode.active { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }

  @media (pointer: coarse) {
    .titlebar { padding: 12px 14px; }
    .titlebar .title { font-size: 13px; }
    .mode { font-size: 14px; padding: 7px 12px; border-radius: 8px; }
  }
</style>
