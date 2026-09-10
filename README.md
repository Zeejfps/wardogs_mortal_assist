# Mortar Calculator

Tiny mortar range calculator, built as an installable web app (PWA) at
<https://helpmeaim.builtbyzee.com>. Add it to a phone home screen and it works
offline.

    distance = sqrt((X1 - X)^2 + (Y1 - Y)^2) * 100

- **Mortar X / Y** – your gun position. Saved automatically and restored on next launch.
- **Target X1 / Y1** – updates the distance live as you type. Enter jumps to the next field.
- Readout also shows ΔX, ΔY (scaled) and a bearing (0° = +Y, clockwise).

## Stack

Svelte 5 + TypeScript, bundled with Vite. `vite-plugin-pwa` generates the web
manifest and a Workbox service worker that precaches the whole build.

## Layout

- `index.html` – Vite entry point and PWA meta tags.
- `src/main.ts` – mounts the app and registers the service worker.
- `src/App.svelte` – layout, state, persistence.
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
