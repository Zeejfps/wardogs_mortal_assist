# Mortar Calculator

Tiny mortar range calculator, built as an installable web app (PWA) at
<https://helpmeaim.builtbyzee.com>. Add it to a phone home screen and it works
offline.

    distance = sqrt((X1 - X)^2 + (Y1 - Y)^2) * 100

Two screens, toggled by the **Edit / Done** button in the titlebar:

- **Fire** (default) – the in-game view. The range readout is pinned at the
  top. Pick the map from the titlebar dropdown, pick a gun position from the
  pills in the **Mortar** header (**+** adds one) and type its X / Y, then tap
  a saved **Target** button to get the range. The **Manual** button reveals
  X1 / Y1 fields for a one-off target; the last six manual entries per map
  come back as **recent** tiles, and the star on one saves it as a target.
  The target grid is two rows tall and scrolls. Enter jumps to the next field.
- **Edit** – rename or add maps, name gun positions, enter targets (name,
  X1, Y1; Enter walks name -> X -> Y -> new row), and share. **Export** hands you a JSON file via the
  share sheet on phones or a download elsewhere; **Import** merges a friend's
  file by id, so re-importing an updated file replaces what changed.
- Readout also shows ΔX, ΔY (scaled) and a bearing (0° = +Y, clockwise).

Everything lives in `localStorage`; nothing is bundled or sent anywhere.

## Stack

Svelte 5 + TypeScript, bundled with Vite. `vite-plugin-pwa` generates the web
manifest and a Workbox service worker that precaches the whole build.

## Layout

- `index.html` – Vite entry point and PWA meta tags.
- `src/main.ts` – mounts the app and registers the service worker.
- `src/App.svelte` – titlebar and the fire/edit screen switch.
- `src/lib/FireScreen.svelte` – in-game view: gun position, target buttons, readout.
- `src/lib/EditScreen.svelte` – map and target entry, export/import.
- `src/lib/MapPicker.svelte` – the map dropdown in the titlebar.
- `src/lib/store.svelte.ts` – shared app state and persistence.
- `src/lib/library.ts` – map/target types, the shared JSON format, merge and export.
- `src/lib/Field.svelte` – one numeric input.
- `src/lib/InstallBar.svelte` – the add-to-home-screen hint.
- `src/lib/mortar.ts` – the range/bearing math.
- `src/lib/storage.ts` – guarded `localStorage` helpers.
- `public/` – icons and the `CNAME` for the custom domain, copied into `dist/` as-is.
- `vite.config.ts` – build config and the PWA manifest.

## Develop

    npm install
    npm run dev        # http://localhost:5173 with hot reload
    npm run check      # type-check the .ts and .svelte files
    npm run build      # production build into dist/
    npm run preview    # serve dist/ locally to test the service worker

The service worker only registers over **HTTPS** or on `localhost`, so `npm run
preview` is the way to test offline behaviour locally. Plain HTTP on a LAN
address will render, but the browser will not offer to install it.

## Install on a phone

- **Android / Chrome** - open the URL, menu -> *Add to Home screen* (or tap the
  install banner the app shows).
- **iOS / Safari** - open the URL, Share -> *Add to Home Screen*. Must be Safari;
  Chrome on iOS cannot install web apps.

Once added it launches full screen with no browser chrome, the mortar position is
remembered in `localStorage`, and it works with no signal.

## Deploying

Hosted on GitHub Pages at **https://helpmeaim.builtbyzee.com**. Deploys are cut by
tag, not by every push to `main`:

    git tag v1.0.1
    git push origin v1.0.1

That runs `.github/workflows/pages.yml`, which builds the app and uploads `dist/`
as the site. Every built file carries a content hash and the service worker's
precache list is regenerated on each build, so installed phones pick up a new
deploy on their next launch with no manual cache versioning. "Run workflow" in
the Actions tab does a manual deploy off the current branch.

One-time setup, in the repo's **Settings -> Pages**: set *Source* to **GitHub Actions**.
Then, in DNS for `builtbyzee.com`, add a CNAME record:

    helpmeaim  ->  zeejfps.github.io

GitHub issues the certificate once the record resolves (a few minutes to an hour);
tick *Enforce HTTPS* on that Pages settings page after it does.
