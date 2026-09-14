<script lang="ts">
  import { read, write } from './storage';

  // Android/Chrome fires beforeinstallprompt and lets us trigger the real
  // dialog. iOS Safari has no such event and no prompt, so all we can do is
  // tell the user where the button is. Neither applies once it is installed.
  const DISMISSED = 'mortar.installDismissed';

  const installed =
    matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);

  let dismissed = $state(installed || read(DISMISSED) === true);
  let prompt = $state<BeforeInstallPromptEvent | null>(null);

  // iPadOS 13+ reports itself as a Mac, hence the touch-point check.
  const ua = navigator.userAgent;
  const ios = /iPhone|iPod|iPad/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Only Safari can install on iOS; every other iOS browser is WebKit in a
  // wrapper with no Add to Home Screen.
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  type Mode = 'prompt' | 'ios' | 'ios-other' | null;
  const mode = $derived<Mode>(prompt ? 'prompt' : iosOtherBrowser ? 'ios-other' : ios ? 'ios' : null);

  $effect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      prompt = e;
    };
    const onInstalled = () => dismiss(true);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
    };
  });

  function dismiss(remember: boolean): void {
    dismissed = true;
    if (remember) write(DISMISSED, true);
  }

  async function install(): Promise<void> {
    const p = prompt;
    if (!p) return;
    dismiss(false);
    p.prompt();
    await p.userChoice;
    prompt = null;
  }
</script>

{#if !dismissed && mode}
  <div class="install">
    <p>
      {#if mode === 'prompt'}
        Add to your home screen for offline use.
      {:else if mode === 'ios-other'}
        Open this page in <b>Safari</b> to add it to your home screen.
      {:else}
        Tap <b>Share</b>, then <b>Add to Home Screen</b>.
      {/if}
    </p>
    {#if mode === 'prompt'}
      <button onclick={install}>Install</button>
    {/if}
    <button class="dismiss" title="Dismiss" onclick={() => dismiss(true)}>&#10005;</button>
  </div>
{/if}

<style>
  .install {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; font-size: 12px; line-height: 1.35;
    background: var(--accent-dim); border-top: 1px solid var(--border);
    color: var(--text);
  }
  .install p { margin: 0; flex: 1; }
  .install b { color: var(--accent); }
  .install button {
    flex: none; border: 0; cursor: pointer;
    font: inherit; font-weight: 600; padding: 8px 12px;
    background: var(--accent); color: #14171c;
  }
  .install button.dismiss {
    background: transparent; color: var(--muted); padding: 8px; font-weight: 400;
  }

  @media (pointer: coarse) {
    .install { font-size: 13px; padding: 12px 14px; }
    .install button { padding: 10px 14px; }
  }
</style>
