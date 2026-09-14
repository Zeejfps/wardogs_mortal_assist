/** Release version, stamped in at build time by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The install prompt Chromium fires for a PWA; not in lib.dom because it is not a standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
