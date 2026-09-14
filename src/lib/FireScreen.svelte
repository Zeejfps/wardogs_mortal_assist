<script lang="ts">
  // In-game view. The answer sits at the top at a fixed size so nothing added
  // below can ever squeeze it. Each card below is inputs first, then the quick
  // switches under them: gun pills on the mortar card, target tiles on the
  // target card. Tiles fill the pick into the fields; typing over a saved
  // target turns it into a manual entry rather than editing the target, and
  // a manual entry only becomes a tile when the user taps Add.
  import Field from './Field.svelte';
  import ImagePicker from './ImagePicker.svelte';
  import MapView from './MapView.svelte';
  import { imageById } from './maps';
  import { solve, fmt, isSet, num } from './mortar';
  import Version from './Version.svelte';
  import { getStore, type Recent } from './store.svelte';

  const store = getStore();
  const map = $derived(store.map);
  const gun = $derived(store.gun);
  const image = $derived(imageById(map.image));
  let view: MapView | undefined = $state();
  // A row left blank on the edit screen is not a target yet.
  const targets = $derived(map.locations.filter((l) => l.name || l.x || l.y));
  const recents = $derived(store.mapRecents);
  const result = $derived(solve(store.pos));
  // No number until both ends are placed: a range from a blank gun would be measured from 0,0.
  const hasTarget = $derived(isSet(store.pos.tx, store.pos.ty));
  const ready = $derived(store.gunPlaced && hasTarget);
  const manualMode = $derived(store.target.kind === 'manual');
  const hasTiles = $derived(targets.length + recents.length > 0);
  // Focus the target field on an empty map, unless the map panel is the
  // obvious place to tap: focusing would scroll it away and raise the keyboard.
  const focusTarget = $derived(!hasTiles && !(image && store.mapOpen));

  function matches(r: Recent): boolean {
    const t = store.target;
    return t.kind === 'manual' && num(r.x) === num(t.tx) && num(r.y) === num(t.ty);
  }
  // The Manual tile lights up only when no recent tile already does.
  const manualTileActive = $derived(manualMode && !recents.some(matches));

  type FieldId = 'mx' | 'my' | 'tx' | 'ty';
  const fields: Partial<Record<FieldId, Field>> = {};
  const order: FieldId[] = ['mx', 'my', 'tx', 'ty'];

  // Enter moves to the next field: X -> Y -> X1 -> Y1 -> back to X1.
  function next(id: FieldId): void {
    const i = order.indexOf(id);
    const to = order[i + 1] ?? 'tx';
    fields[to]?.focus();
  }

  function manual(): void {
    store.selectManual();
    fields.tx?.focus();
  }

  // Drops the selected gun. A blank one goes without asking, as on the edit screen.
  function deleteGun(): void {
    if (!gun) return;
    const blank = !gun.x && !gun.y;
    if (blank || confirm(`Delete gun "${gun.name}"?`)) store.deleteGun(gun.id);
  }

</script>

<section class="result">
  <div class="range">
    <div class="label">
      {#if !store.gunPlaced}Place the mortar
      {:else if !hasTarget}Pick a target
      {:else if store.location}To <b>{store.location.name || 'Unnamed'}</b>
      {:else}Range{/if}
    </div>
    <div class="value">{ready ? fmt(result.dist) : '—'}<small>m</small></div>
  </div>
  <div class="stats">
    <span class="brg">Brg <b>{ready ? `${fmt(result.brg, 1)}°` : '—'}</b></span>
    <span>ΔX <b>{ready ? fmt(result.dx) : '—'}</b></span>
    <span>ΔY <b>{ready ? fmt(result.dy) : '—'}</b></span>
  </div>
</section>

<main>
  <section class="mapcard">
    <h2>
      <span>Map</span>
      <span class="tools">
        {#if store.mapOpen && image}
          <button class="tool" onclick={() => view?.home()} title="Centre on the gun" aria-label="Centre on the gun">⌖</button>
        {/if}
        <button class="tool" onclick={() => (store.mapOpen = !store.mapOpen)}>
          {store.mapOpen ? 'Hide' : 'Show'}
        </button>
      </span>
    </h2>
    {#if store.mapOpen}
      {#if image}
        <div class="canvas"><MapView bind:this={view} /></div>
        {#if store.gunPlaced}
          <p class="hint tiny">Tap sets the target · hold (or drag the gun) moves the gun</p>
        {:else}
          <p class="hint tiny">Tap the map to place {#if gun}mortar <b>{gun.name}</b>{:else}the mortar{/if}</p>
        {/if}
      {:else}
        <div class="row"><ImagePicker /></div>
        <p class="hint">Pick an image to tap targets straight on the map.</p>
      {/if}
    {/if}
  </section>

  <section>
    <h2>Mortar</h2>
    <div class="row">
      <Field label="X" bind:value={() => gun?.x ?? '', (v) => store.typeGun('x', v)}
             bind:this={fields.mx} onenter={() => next('mx')} />
      <Field label="Y" bind:value={() => gun?.y ?? '', (v) => store.typeGun('y', v)}
             bind:this={fields.my} onenter={() => next('my')} />
    </div>
    <div class="guns" role="tablist" aria-label="Gun position">
      {#each map.guns as g (g.id)}
        <button class="pill" class:active={gun?.id === g.id} role="tab"
                aria-selected={gun?.id === g.id} onclick={() => store.selectGun(g.id)}>
          {g.name || '?'}
        </button>
      {/each}
      <button class="pill add" onclick={() => store.addGun()} aria-label="Add gun position">+</button>
      {#if gun}
        <button class="pill add remove" onclick={deleteGun}
                aria-label="Delete selected gun position" title="Delete selected gun">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
          </svg>
        </button>
      {/if}
    </div>
  </section>

  <section>
    <h2>Target</h2>
    <div class="row target">
      <Field label="X1" bind:value={() => store.pos.tx, (v) => store.typeTarget('tx', v)}
             bind:this={fields.tx} onenter={() => next('tx')} autofocus={focusTarget} />
      <Field label="Y1" bind:value={() => store.pos.ty, (v) => store.typeTarget('ty', v)}
             bind:this={fields.ty} onenter={() => next('ty')} />
      <button class="btn keep" onclick={() => store.addRecent()} disabled={!store.canAddRecent}
              title="Keep as a recent tile">Add</button>
    </div>
    {#if hasTiles}
      <div class="grid">
        {#each targets as loc (loc.id)}
          <button class="loc" class:active={store.location?.id === loc.id}
                  onclick={() => store.selectLocation(loc.id)}>
            <span class="name">{loc.name || 'Unnamed'}</span>
            <span class="xy">{loc.x || '0'}, {loc.y || '0'}</span>
          </button>
        {/each}
        <button class="loc other" class:active={manualTileActive} onclick={manual}>
          <span class="name">Manual</span>
          <span class="xy">type X1, Y1</span>
        </button>
        {#each recents as r (`${r.x},${r.y}`)}
          <div class="loc recent" class:active={matches(r)}>
            <button class="hit" onclick={() => store.useRecent(r)}>
              <span class="name">{r.x}, {r.y}</span>
              <span class="xy">recent</span>
            </button>
            <div class="side">
              <button class="star" onclick={() => store.promoteRecent(r)}
                      aria-label="Save as target" title="Save as target">★</button>
              <button class="del" onclick={() => store.removeRecent(r)}
                      aria-label="Remove recent" title="Remove">×</button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="hint">No saved targets for this map yet. Tap <b>Edit</b> to add some.</p>
    {/if}
  </section>
  <Version />
</main>

<style>
  /* Pinned above the scrolling main, so it never moves or shrinks. */
  .result {
    flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  }
  .result .label {
    font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .result .label b { color: var(--text); }
  .result .range { min-width: 0; }
  .result .value {
    font-size: 40px; font-weight: 700; line-height: 1.05;
    color: var(--accent); font-variant-numeric: tabular-nums;
  }
  .result .value small { font-size: 15px; font-weight: 500; color: var(--muted); margin-left: 4px; }
  .result .stats {
    flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
    font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .result .stats b { color: var(--text); font-weight: 600; }
  .result .stats .brg { font-size: 14px; }
  .result .stats .brg b { color: var(--accent); }

  /* Add sits beside the target fields, lined up with the inputs (same padding and text size). */
  .row.target { align-items: flex-end; }
  .btn.keep { flex: none; padding: 7px 12px; font-size: 15px; line-height: normal; }

  /* Quick switches sit under the fields on both cards. */
  .guns, .grid { margin-top: 10px; }
  .guns { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill {
    flex: none; min-width: 36px; height: 28px; padding: 0 12px;
    background: var(--panel-2); color: var(--muted);
    border: 1px solid var(--border);
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .pill.active { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
  .pill.add { min-width: 30px; padding: 0 9px; border-style: dashed; }
  .pill.remove { display: inline-flex; align-items: center; justify-content: center; }
  .pill.remove:hover, .pill.remove:active { color: var(--danger); }

  .grid {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    grid-auto-rows: 52px;
  }
  .loc {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px;
    padding: 8px 10px; text-align: left;
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border);
    font: inherit; cursor: pointer; transition: border-color 0.12s, background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }
  .loc:active { background: var(--border); }
  .loc.active { border-color: var(--accent); background: var(--accent-dim); }
  .loc .name {
    font-weight: 600; font-size: 14px; line-height: 1.2;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
    font-variant-numeric: tabular-nums;
  }
  .loc .xy { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .loc.active .xy { color: var(--accent); }
  .loc.other { border-style: dashed; }
  .loc.other .name { color: var(--muted); }
  .loc.other.active .name { color: var(--text); }

  /* A recent is a tile with a star (keep) and a cross (drop) stacked down its
     right edge; each is its own button, sitting beside the main hit area. */
  .loc.recent { position: relative; padding: 0; cursor: default; }
  .loc.recent .hit {
    flex: 1; width: 100%; display: flex; flex-direction: column; align-items: flex-start;
    justify-content: center; gap: 2px; padding: 8px 32px 8px 10px; text-align: left;
    background: transparent; color: inherit; border: 0; border-radius: inherit;
    font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .loc.recent .hit:active { background: var(--border); }
  .loc.recent .xy { font-style: italic; }
  .side {
    position: absolute; top: 0; right: 0; bottom: 0; padding: 2px;
    display: flex; flex-direction: column; justify-content: space-evenly;
  }
  .star, .del {
    width: 26px; height: 22px; padding: 0;
    background: transparent; color: var(--muted); border: 1px solid transparent;
    font-size: 14px; line-height: 1; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .del { font-size: 17px; }
  .star:hover, .star:active { color: var(--accent); border-color: var(--border); }
  .del:hover, .del:active { color: var(--danger); border-color: var(--border); }

  .hint { margin: 10px 0 0; color: var(--muted); font-size: 12px; }
  .hint b { color: var(--text); }
  .hint.tiny { margin-top: 6px; font-size: 11px; text-align: center; }

  /* The map card: header tools, then a fixed-height canvas the map fills. */
  .mapcard { flex: none; }
  .mapcard .tools { display: flex; gap: 6px; }
  .tool {
    background: var(--panel-2); color: var(--muted);
    border: 1px solid var(--border);
    padding: 2px 8px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
    letter-spacing: normal; text-transform: none; line-height: 1.4;
    -webkit-tap-highlight-color: transparent;
  }
  .tool:active { background: var(--border); }
  /* Negative margins pull the map out to the section edges. */
  .canvas { height: 300px; margin: 0 -10px; }

  @media (pointer: coarse) {
    .result .value { font-size: 52px; }
    .result .value small { font-size: 18px; }
    .result .stats { font-size: 14px; gap: 3px; }
    .result .stats .brg { font-size: 17px; }
    .btn.keep { padding: 12px 14px; font-size: 19px; }
    .guns, .grid { margin-top: 12px; }
    .guns { gap: 8px; }
    .pill { height: 36px; font-size: 14px; padding: 0 14px; min-width: 44px; max-width: 110px; }
    .pill.add { min-width: 38px; }
    .grid {
      gap: 10px; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      grid-auto-rows: 64px;
    }
    .loc { padding: 10px 12px; }
    .loc.recent { padding: 0; }
    .loc.recent .hit { padding: 10px 38px 10px 12px; }
    .loc .name { font-size: 16px; }
    .loc .xy { font-size: 12px; }
    .star, .del { width: 32px; height: 28px; font-size: 17px; }
    .del { font-size: 20px; }
    .hint { font-size: 13px; }
    .hint.tiny { font-size: 11px; }
    .tool { font-size: 13px; padding: 5px 10px; }
    .canvas { height: 42dvh; min-height: 220px; margin: 0 -12px; }
  }
</style>
