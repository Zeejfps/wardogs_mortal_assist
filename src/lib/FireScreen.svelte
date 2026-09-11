<script lang="ts">
  // In-game view. Targets are big buttons so swapping between them is one
  // tap; the gun position stays editable because it moves during a match.
  import Field from './Field.svelte';
  import { solve, fmt } from './mortar';
  import { store } from './store.svelte';

  const map = $derived(store.map);
  // A row left blank on the edit screen is not a target yet.
  const targets = $derived(map.locations.filter((l) => l.name || l.x || l.y));
  const result = $derived(solve(store.pos));
  const manualMode = $derived(store.locationId == null);

  type FieldId = 'mx' | 'my' | 'tx' | 'ty';
  const fields: Partial<Record<FieldId, Field>> = {};

  // Enter moves to the next field: X -> Y -> X1 -> Y1 -> back to X1.
  function next(id: FieldId): void {
    const order: FieldId[] = manualMode ? ['mx', 'my', 'tx', 'ty'] : ['mx', 'my'];
    const i = order.indexOf(id);
    const to = i === order.length - 1 ? (manualMode ? 'tx' : 'mx') : order[i + 1];
    fields[to]?.focus();
  }

  function manual(): void {
    store.selectLocation(null);
    // The fields mount after the state change; focus once they exist.
    setTimeout(() => fields.tx?.focus());
  }
</script>

<main>
  <section>
    <h2>Mortar <span class="tag">saved</span></h2>
    <div class="row">
      <Field label="X" bind:value={() => map.mortar.x, (v) => (map.mortar.x = v)}
             bind:this={fields.mx} onenter={() => next('mx')} />
      <Field label="Y" bind:value={() => map.mortar.y, (v) => (map.mortar.y = v)}
             bind:this={fields.my} onenter={() => next('my')} />
    </div>
  </section>

  <section>
    <h2>Target</h2>
    {#if targets.length}
      <div class="grid">
        {#each targets as loc (loc.id)}
          <button class="loc" class:active={store.locationId === loc.id}
                  onclick={() => store.selectLocation(loc.id)}>
            <span class="name">{loc.name || 'Unnamed'}</span>
            <span class="xy">{loc.x || '0'}, {loc.y || '0'}</span>
          </button>
        {/each}
        <button class="loc other" class:active={manualMode} onclick={manual}>
          <span class="name">Manual</span>
          <span class="xy">type X1, Y1</span>
        </button>
      </div>
    {:else}
      <p class="hint">No saved targets for this map yet. Tap <b>Edit</b> to add some.</p>
    {/if}
    {#if manualMode}
      <div class="row" class:spaced={targets.length > 0}>
        <Field label="X1" bind:value={store.manual.tx} bind:this={fields.tx}
               onenter={() => next('tx')} autofocus={targets.length === 0} />
        <Field label="Y1" bind:value={store.manual.ty} bind:this={fields.ty}
               onenter={() => next('ty')} />
      </div>
    {/if}
  </section>

  <section class="result">
    <div class="label">
      {#if store.location}Distance to <b>{store.location.name || 'Unnamed'}</b>{:else}Distance{/if}
    </div>
    <div class="value">{fmt(result.dist)}<small>m</small></div>
    <div class="sub">
      <span>ΔX <b>{fmt(result.dx)}</b></span>
      <span>ΔY <b>{fmt(result.dy)}</b></span>
      <span>Brg <b>{fmt(result.brg, 1)}°</b></span>
    </div>
  </section>
</main>

<style>
  .grid {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
  .loc {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    min-height: 52px; padding: 8px 10px; text-align: left;
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
  }
  .loc .xy { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .loc.active .xy { color: var(--accent); }
  .loc.other { border-style: dashed; }
  .loc.other .name { color: var(--muted); }
  .loc.other.active .name { color: var(--text); }

  .row.spaced { margin-top: 10px; }
  .hint { margin: 0 0 8px; color: var(--muted); font-size: 12px; }
  .hint b { color: var(--text); }

  .result {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center;
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  }
  .result .label { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
  .result .label b { color: var(--text); }
  .result .value {
    font-size: 44px; font-weight: 700; line-height: 1.1;
    color: var(--accent); font-variant-numeric: tabular-nums;
    margin: 4px 0 2px;
  }
  .result .value small { font-size: 16px; font-weight: 500; color: var(--muted); margin-left: 4px; }
  .result .sub {
    display: flex; gap: 14px; margin-top: 8px; font-size: 12px; color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .result .sub b { color: var(--text); font-weight: 600; }

  @media (pointer: coarse) {
    .grid { gap: 10px; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
    .loc { min-height: 64px; padding: 10px 12px; border-radius: 10px; }
    .loc .name { font-size: 16px; }
    .loc .xy { font-size: 12px; }
    .hint { font-size: 13px; }
    .result .value { font-size: 56px; }
    .result .value small { font-size: 20px; }
    .result .sub { font-size: 14px; gap: 18px; }
  }
</style>
