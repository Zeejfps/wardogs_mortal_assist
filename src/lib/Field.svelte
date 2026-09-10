<script lang="ts">
  interface Props {
    label: string;
    value?: string;
    onenter?: () => void;
    autofocus?: boolean;
  }

  let { label, value = $bindable(''), onenter, autofocus = false }: Props = $props();

  let el: HTMLInputElement;

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
    bind:value
    type="number"
    step="any"
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
    border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 9px; font-size: 15px; font-variant-numeric: tabular-nums;
    outline: none; transition: border-color 0.12s;
  }
  input:focus { border-color: var(--accent); }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
  input[type=number] { -moz-appearance: textfield; appearance: textfield; }

  /* Inputs must stay at 16px or larger or iOS Safari zooms the page in
     whenever a field is focused. */
  @media (pointer: coarse) {
    label span { font-size: 12px; }
    input { font-size: 19px; padding: 12px; border-radius: 8px; }
  }
</style>
