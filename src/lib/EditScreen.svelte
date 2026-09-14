<script lang="ts">
  // Data entry and sharing. Kept off the fire screen so in-game use is just
  // tapping targets. Enter walks name -> X -> Y -> a fresh row for fast typing.
  import { tick } from 'svelte';
  import { str, type Gun, type Location } from './library';
  import { store } from './store.svelte';

  const map = $derived(store.map);
  const onlyMap = $derived(store.library.maps.length <= 1);
  const onlyGun = $derived(map.guns.length <= 1);

  let status = $state('');
  let fileInput: HTMLInputElement;
  const refs: Record<string, HTMLInputElement> = {};

  // Number inputs bind as numbers (null when blank); coordinates are kept as
  // the typed strings so they round-trip exactly, hence the function bindings.
  function setX(o: { x: string }): (v: unknown) => void {
    return (v) => (o.x = str(v));
  }
  function setY(o: { y: string }): (v: unknown) => void {
    return (v) => (o.y = str(v));
  }

  async function addLocation(): Promise<void> {
    const loc = store.addLocation();
    await tick();
    refs[`${loc.id}:name`]?.focus();
  }

  function onEnter(e: KeyboardEvent, loc: Location, col: 'name' | 'x' | 'y'): void {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (col === 'name') refs[`${loc.id}:x`]?.focus();
    else if (col === 'x') refs[`${loc.id}:y`]?.focus();
    else void addLocation();
  }

  function deleteGun(gun: Gun): void {
    const blank = !gun.x && !gun.y;
    if (blank || confirm(`Delete gun "${gun.name}"?`)) store.deleteGun(gun.id);
  }

  function deleteLocation(loc: Location): void {
    const blank = !loc.name && !loc.x && !loc.y;
    if (blank || confirm(`Delete "${loc.name || 'Unnamed'}"?`)) store.deleteLocation(loc.id);
  }

  function deleteMap(): void {
    const n = map.locations.length;
    const what = n ? ` and its ${n} target${n === 1 ? '' : 's'}` : '';
    if (confirm(`Delete "${map.name}"${what}?`)) store.deleteMap(map.id);
  }

  async function exportMap(): Promise<void> {
    status = (await store.exportMap(map)) ? `Exported ${map.name}` : '';
  }

  async function exportAll(): Promise<void> {
    status = (await store.exportAll()) ? 'Exported all maps' : '';
  }

  async function onFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const r = store.importText(await file.text());
      status = `Imported ${r.maps} new map${r.maps === 1 ? '' : 's'}, ${r.locations} target${r.locations === 1 ? '' : 's'}`;
    } catch (err) {
      status = `Import failed: ${(err as Error).message}`;
    } finally {
      input.value = '';
    }
  }
</script>

<main>
  <section>
    <h2>Map</h2>
    <div class="row">
      <input class="text" type="text" placeholder="Map name" bind:value={map.name} />
      <button class="btn danger" onclick={deleteMap} disabled={onlyMap} title="Delete this map">Delete</button>
    </div>
    <div class="row top">
      <button class="btn" onclick={() => store.addMap()}>+ New map</button>
    </div>
  </section>

  <section>
    <h2>Guns <span class="tag">{map.guns.length}</span></h2>
    <div class="head">
      <span>Name</span><span>X</span><span>Y</span><span></span>
    </div>
    {#each map.guns as gun (gun.id)}
      <div class="loc">
        <input class="text" type="text" placeholder="A" bind:value={gun.name}
               enterkeyhint="next" autocomplete="off" maxlength="12" />
        <input class="num" type="number" step="any" inputmode="decimal" placeholder="0" bind:value={() => gun.x, setX(gun)}
               enterkeyhint="next" autocomplete="off" onfocus={(e) => e.currentTarget.select()} />
        <input class="num" type="number" step="any" inputmode="decimal" placeholder="0" bind:value={() => gun.y, setY(gun)}
               enterkeyhint="done" autocomplete="off" onfocus={(e) => e.currentTarget.select()} />
        <button class="x" onclick={() => deleteGun(gun)} disabled={onlyGun} aria-label="Delete gun">×</button>
      </div>
    {/each}
    <button class="btn wide" onclick={() => store.addGun()}>+ Add gun</button>
    <p class="hint">Short names work best: they show as pills on the fire screen.</p>
  </section>

  <section>
    <h2>Targets <span class="tag">{map.locations.length}</span></h2>
    {#if map.locations.length}
      <div class="head">
        <span>Name</span><span>X1</span><span>Y1</span><span></span>
      </div>
    {/if}
    {#each map.locations as loc (loc.id)}
      <div class="loc">
        <input class="text" type="text" placeholder="Name" bind:value={loc.name}
               bind:this={refs[`${loc.id}:name`]} onkeydown={(e) => onEnter(e, loc, 'name')}
               enterkeyhint="next" autocomplete="off" />
        <input class="num" type="number" step="any" inputmode="decimal" placeholder="0" bind:value={() => loc.x, setX(loc)}
               bind:this={refs[`${loc.id}:x`]} onkeydown={(e) => onEnter(e, loc, 'x')}
               enterkeyhint="next" autocomplete="off" onfocus={(e) => e.currentTarget.select()} />
        <input class="num" type="number" step="any" inputmode="decimal" placeholder="0" bind:value={() => loc.y, setY(loc)}
               bind:this={refs[`${loc.id}:y`]} onkeydown={(e) => onEnter(e, loc, 'y')}
               enterkeyhint="done" autocomplete="off" onfocus={(e) => e.currentTarget.select()} />
        <button class="x" onclick={() => deleteLocation(loc)} aria-label="Delete target">×</button>
      </div>
    {/each}
    <button class="btn wide" onclick={addLocation}>+ Add target</button>
  </section>

  <section>
    <h2>Share</h2>
    <div class="row">
      <button class="btn" onclick={exportMap}>Export this map</button>
      <button class="btn" onclick={exportAll}>Export all</button>
      <button class="btn" onclick={() => fileInput.click()}>Import…</button>
    </div>
    <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onFile} />
    {#if status}<p class="status">{status}</p>{/if}
    <p class="hint">Exports a JSON file you can send to a friend. Importing merges by id, so re-importing an updated file replaces what changed.</p>
  </section>
</main>

<style>
  .row.top { margin-top: 8px; }

  input.text, input.num {
    min-width: 0; background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 9px; font: inherit; font-size: 15px; outline: none;
    transition: border-color 0.12s;
  }
  input.num { font-variant-numeric: tabular-nums; }
  input:focus { border-color: var(--accent); }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
  input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  .row input.text { flex: 1; }

  .head, .loc {
    display: grid; grid-template-columns: 2fr 1fr 1fr 32px; gap: 6px; align-items: center;
  }
  .head { font-size: 11px; color: var(--muted); padding: 0 2px 4px; }
  .loc { margin-bottom: 6px; }
  .loc .x {
    width: 32px; height: 32px; padding: 0; border-radius: 6px;
    background: transparent; color: var(--muted); border: 1px solid transparent;
    font-size: 18px; line-height: 1; cursor: pointer;
  }
  .loc .x:hover, .loc .x:active { color: var(--danger); border-color: var(--border); }
  .loc .x:disabled { opacity: 0.3; cursor: default; color: var(--muted); border-color: transparent; }

  .btn.wide { width: 100%; margin-top: 4px; }

  .status { margin: 8px 0 0; font-size: 12px; color: var(--accent); }
  .hint { margin: 8px 0 0; font-size: 11px; color: var(--muted); }

  @media (pointer: coarse) {
    input.text, input.num { font-size: 17px; padding: 11px 10px; border-radius: 8px; }
    .head, .loc { grid-template-columns: 2fr 1fr 1fr 40px; gap: 8px; }
    .loc { margin-bottom: 8px; }
    .loc .x { width: 40px; height: 44px; font-size: 22px; }
    .head { font-size: 12px; }
    .status { font-size: 13px; }
    .hint { font-size: 12px; }
  }
</style>
