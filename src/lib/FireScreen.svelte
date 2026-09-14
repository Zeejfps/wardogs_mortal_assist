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
  import { solve, fmt, num } from './mortar';
  import { store, type Recent } from './store.svelte';

  const map = $derived(store.map);
  const gun = $derived(store.gun);
  const image = $derived(imageById(map.image));
  let view: MapView | undefined = $state();
  // A row left blank on the edit screen is not a target yet.
  const targets = $derived(map.locations.filter((l) => l.name || l.x || l.y));
  const recents = $derived(store.mapRecents);
  const result = $derived(solve(store.pos));
  const manualMode = $derived(store.locationId == null);
  const hasTiles = $derived(targets.length + recents.length > 0);
  // Focus the target field on an empty map, unless the map panel is the
  // obvious place to tap: focusing would scroll it away and raise the keyboard.
  const focusTarget = $derived(!hasTiles && !(image && store.mapOpen));

  function matches(r: Recent): boolean {
    return manualMode && num(r.x) === num(store.manual.tx) && num(r.y) === num(store.manual.ty);
  }
  // The Manual tile lights up only when no recent tile already does.
  const manualTileActive = $derived(manualMode && !recents.some(matches));

  type FieldId = 'mx' | 'my' | 'tx' | 'ty';
  const fields: Partial<Record<FieldId, Field>> = {};
  const order: FieldId[] = ['mx', 'my', 'tx', 'ty'];

  // Enter moves to the next field: X -> Y -> X1 -> Y1 -> back to X1.
  function next(id: FieldId): void {
    const i = order.indexOf(id);
    const to = i === order.length - 1 ? 'tx' : order[i + 1];
    fields[to]?.focus();
  }

  function manual(): void {
    store.selectLocation(null);
    fields.tx?.focus();
  }

</script>

<section class="result">
  <div class="range">
    <div class="label">
      {#if store.location}To <b>{store.location.name || 'Unnamed'}</b>{:else}Range{/if}
    </div>
    <div class="value">{fmt(result.dist)}<small>m</small></div>
  </div>
  <div class="stats">
    <span class="brg">Brg <b>{fmt(result.brg, 1)}°</b></span>
    <span>ΔX <b>{fmt(result.dx)}</b></span>
    <span>ΔY <b>{fmt(result.dy)}</b></span>
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
        <p class="hint tiny">Tap sets the target · hold (or drag the gun) moves the gun</p>
      {:else}
        <div class="row"><ImagePicker /></div>
        <p class="hint">Pick an image to tap targets straight on the map.</p>
      {/if}
    {/if}
  </section>

  <section>
    <h2>Mortar</h2>
    <div class="row">
      <Field label="X" bind:value={() => gun.x, (v) => (gun.x = v)}
             bind:this={fields.mx} onenter={() => next('mx')} />
      <Field label="Y" bind:value={() => gun.y, (v) => (gun.y = v)}
             bind:this={fields.my} onenter={() => next('my')} />
    </div>
    <div class="guns" role="tablist" aria-label="Gun position">
      {#each map.guns as g (g.id)}
        <button class="pill" class:active={gun.id === g.id} role="tab"
                aria-selected={gun.id === g.id} onclick={() => store.selectGun(g.id)}>
          {g.name || '?'}
        </button>
      {/each}
      <button class="pill add" onclick={() => store.addGun()} aria-label="Add gun position">+</button>
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
          <button class="loc" class:active={store.locationId === loc.id}
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
</main>

<style>
  /* Pinned above the scrolling main, so it never moves or shrinks. */
  .result {
    flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin: 12px 12px 0;
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
    border: 1px solid var(--border); border-radius: 999px;
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .pill.active { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
  .pill.add { min-width: 30px; padding: 0 9px; border-style: dashed; }

  .grid {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    grid-auto-rows: 52px;
  }
  .loc {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px;
    padding: 8px 10px; text-align: left;
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
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
    background: transparent; color: var(--muted); border: 1px solid transparent; border-radius: 6px;
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
    border: 1px solid var(--border); border-radius: 6px;
    padding: 2px 8px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
    letter-spacing: normal; text-transform: none; line-height: 1.4;
    -webkit-tap-highlight-color: transparent;
  }
  .tool:active { background: var(--border); }
  .canvas { height: 300px; }

  @media (pointer: coarse) {
    .result { margin: 14px 14px 0; }
    .result .value { font-size: 52px; }
    .result .value small { font-size: 18px; }
    .result .stats { font-size: 14px; gap: 3px; }
    .result .stats .brg { font-size: 17px; }
    .btn.keep { padding: 12px 14px; font-size: 19px; border-radius: 8px; }
    .guns, .grid { margin-top: 12px; }
    .guns { gap: 8px; }
    .pill { height: 36px; font-size: 14px; padding: 0 14px; min-width: 44px; max-width: 110px; border-radius: 10px; }
    .pill.add { min-width: 38px; }
    .grid {
      gap: 10px; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      grid-auto-rows: 64px;
    }
    .loc { padding: 10px 12px; border-radius: 10px; }
    .loc.recent { padding: 0; }
    .loc.recent .hit { padding: 10px 38px 10px 12px; }
    .loc .name { font-size: 16px; }
    .loc .xy { font-size: 12px; }
    .star, .del { width: 32px; height: 28px; font-size: 17px; }
    .del { font-size: 20px; }
    .hint { font-size: 13px; }
    .hint.tiny { font-size: 11px; }
    .tool { font-size: 13px; padding: 5px 10px; border-radius: 8px; }
    .canvas { height: 42dvh; min-height: 220px; }
  }
</style>
