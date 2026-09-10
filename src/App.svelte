<script lang="ts">
  import Field from './lib/Field.svelte';
  import InstallBar from './lib/InstallBar.svelte';
  import { solve, fmt, type Position } from './lib/mortar';
  import { read, write } from './lib/storage';

  const KEY = 'mortar';

  // All four fields persist so the mortar position survives a relaunch.
  const saved = read<Partial<Position>>(KEY, {});
  let pos = $state<Position>({
    mx: saved.mx ?? '',
    my: saved.my ?? '',
    tx: saved.tx ?? '',
    ty: saved.ty ?? '',
  });

  const result = $derived(solve(pos));

  $effect(() => {
    write(KEY, { mx: pos.mx, my: pos.my, tx: pos.tx, ty: pos.ty });
  });

  // Enter moves to the next field: mortar X -> Y -> target X1 -> Y1 -> back to X1.
  const order: (keyof Position)[] = ['mx', 'my', 'tx', 'ty'];
  const fields: Partial<Record<keyof Position, Field>> = {};
  function next(id: keyof Position): void {
    const i = order.indexOf(id);
    const to = i === order.length - 1 ? 'tx' : order[i + 1];
    fields[to]?.focus();
  }
</script>

<header class="titlebar">
  <span class="title">Mortar Calc</span>
</header>

<main>
  <section>
    <h2>Mortar <span class="tag">saved</span></h2>
    <div class="row">
      <Field label="X" bind:value={pos.mx} bind:this={fields.mx} onenter={() => next('mx')} />
      <Field label="Y" bind:value={pos.my} bind:this={fields.my} onenter={() => next('my')} />
    </div>
  </section>

  <section>
    <h2>Target</h2>
    <div class="row">
      <Field label="X1" bind:value={pos.tx} bind:this={fields.tx} onenter={() => next('tx')} autofocus />
      <Field label="Y1" bind:value={pos.ty} bind:this={fields.ty} onenter={() => next('ty')} />
    </div>
  </section>

  <section class="result">
    <div class="label">Distance</div>
    <div class="value">{fmt(result.dist)}<small>m</small></div>
    <div class="sub">
      <span>ΔX <b>{fmt(result.dx)}</b></span>
      <span>ΔY <b>{fmt(result.dy)}</b></span>
      <span>Brg <b>{fmt(result.brg, 1)}°</b></span>
    </div>
  </section>
</main>

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

  main {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; gap: 10px; padding: 12px;
  }

  section {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px;
  }
  section h2 {
    margin: 0 0 8px; font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
    display: flex; align-items: center; justify-content: space-between;
  }
  section h2 .tag {
    font-size: 10px; color: var(--accent); background: var(--accent-dim);
    padding: 1px 6px; border-radius: 999px; letter-spacing: 0.04em;
  }
  .row { display: flex; gap: 8px; }

  .result {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center;
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  }
  .result .label { font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
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

  /* Phones: bigger type, taller hit targets. */
  @media (pointer: coarse) {
    main { gap: 12px; padding: 14px; }
    section { padding: 12px; }
    section h2 { font-size: 12px; }
    .result .value { font-size: 56px; }
    .result .value small { font-size: 20px; }
    .result .sub { font-size: 14px; gap: 18px; }
    .titlebar { padding: 12px 14px; }
    .titlebar .title { font-size: 13px; }
  }
</style>
