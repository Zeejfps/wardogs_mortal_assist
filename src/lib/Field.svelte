<script lang="ts">
  import { coord } from './mortar';

  interface Props {
    label: string;
    value?: string;
    onenter?: () => void;
    autofocus?: boolean;
  }

  let { label, value = $bindable(''), onenter, autofocus = false }: Props = $props();

  let el: HTMLInputElement;

  // A text input, not a number one: the app keeps coordinates as the typed
  // strings and a number input would drop the trailing "." while typing 12.34.
  function set(v: string): void {
    value = coord(v);
  }

  export function focus(): void {
    el?.focus();
  }

  $effect(() => {
    if (autofocus) el.focus();
  });

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') onenter?.();
  }
</script>

<label>
  <span>{label}</span>
  <input
    bind:this={el}
    bind:value={() => value, set}
    type="text"
    inputmode="decimal"
    enterkeyhint="next"
    autocomplete="off"
    placeholder="0"
    onfocus={() => el.select()}
    {onkeydown}
  />
</label>

<style>
  label { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  label span { font-size: 11px; color: var(--muted); }
  input {
    width: 100%; background: var(--bg); color: var(--text);
    border: 1px solid var(--border);
    padding: 7px 9px; font-size: 15px; font-variant-numeric: tabular-nums;
    outline: none; transition: border-color 0.12s;
  }
  input:focus { border-color: var(--accent); }

  /* Inputs must stay at 16px or larger or iOS Safari zooms the page in
     whenever a field is focused. */
  @media (pointer: coarse) {
    label span { font-size: 12px; }
    input { font-size: 19px; padding: 12px; }
  }
</style>
