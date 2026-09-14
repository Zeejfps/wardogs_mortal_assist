# Mortar Calculator

Tiny mortar range calculator, built as an installable web app (PWA) at
<https://helpmeaim.builtbyzee.com>. Add it to a phone home screen and it works
offline.

    distance = sqrt((X1 - X)^2 + (Y1 - Y)^2) * 100

Two screens, toggled by the **Edit / Done** button in the titlebar:

- **Fire** (default) – the in-game view. The range readout is pinned at the
  top. Under it, the **Map** panel shows the map image with the guns, saved
  targets and the current target drawn on it: tap to set a manual target,
  hold (or drag the active gun) to move the gun, pinch to zoom, **⌖** recentres
  on the gun. Pick the map from the titlebar dropdown, pick a gun position from the
  pills in the **Mortar** header (**+** adds one, the trash button removes
  the selected one) and type its X / Y, then tap
  a saved **Target** button to get the range. The **Manual** button reveals
  X1 / Y1 fields for a one-off target; the last six manual entries per map
  come back as **recent** tiles, and the star on one saves it as a target.
  The target grid is two rows tall and scrolls. Enter jumps to the next field.
- **Edit** – rename or add maps, pick which **image** a map is drawn on, name
  gun positions, enter targets (name,
  X1, Y1; Enter walks name -> X -> Y -> new row), and share. **Export** hands you a JSON file via the
  share sheet on phones or a download elsewhere; **Import** merges a friend's
  file by id, so re-importing an updated file replaces what changed.
- Readout also shows ΔX, ΔY (scaled) and a bearing (0° = +Y, clockwise).

Everything lives in `localStorage`; nothing is sent anywhere. Map tiles are
fetched from <https://wardogsmaps.builtbyzee.com> as you look around and kept
by the service worker, so areas you have viewed work offline.

## Preset maps

A new install starts with Bakurani, Ozeti and Zestafona and their shared
targets, from the files in `src/data/`. Gun positions are left blank in the
preset files: where the mortar sits is each player's own business. Each one is a map as the
app exports it, so to change a preset: export the map from the app, overwrite
its file, and bump `PRESETS_VERSION` in `src/lib/presets.ts`. The next build
merges the changes into installs that already have the map (matched by id, or
by image for maps made before presets existed): targets and positioned guns
with a matching id are replaced, new ones are added, and the user's own
targets are left alone. A preset target the user deleted comes back on a bump.

## Stack

Svelte 5 + TypeScript, bundled with Vite. `vite-plugin-pwa` generates the web
manifest and a Workbox service worker that precaches the whole build and
runtime-caches map tiles. Leaflet draws the map.

## Map images

The three Wardog renders (16k and 32k px PNGs, gigabytes in total) are cut into
a 256 px WebP tile pyramid and hosted in a separate `wardogs-maps` repo on
GitHub Pages, so this repo and the app itself stay small:

    python scripts/tile-maps.py "E:/Downloads/Wardog Maps" ../wardogs-maps

`src/lib/maps.ts` is the registry that ties each pyramid to game coordinates.
Calibration, confirmed against landmarks on Ozeti and Bakurani: every map is
163.84 game units (16.4 km) across, the origin is bottom-left and Y increases
northward. The 32k renders are 0.5 m per source pixel and are halved before
tiling; Bakurani's 16k render is 1 m per pixel already, so all three end up as
the same 16k pyramid (about 60 MB per map). Adding a map means dropping its
`<name>_map.png` in the source folder, re-running the script, adding a line
to `MAP_IMAGES` and a preset file for it under `src/data/`.

Set `VITE_TILE_BASE` to point the dev build at a local copy of the tiles
(the helper adds the CORS header the app needs; a plain `http.server` won't):

    python scripts/serve-tiles.py ../wardogs-maps
    VITE_TILE_BASE=http://localhost:8787 npm run dev

On HiDPI screens the map draws the next zoom level's tiles at half size so
they are pixel-sharp; the tile cache also keeps only CORS responses, because
browsers pad opaque cache entries to megabytes each for quota purposes.

## Layout

- `index.html` – Vite entry point and PWA meta tags.
- `src/main.ts` – mounts the app and registers the service worker.
- `src/App.svelte` – titlebar and the fire/edit screen switch.
- `src/lib/FireScreen.svelte` – in-game view: gun position, target buttons, readout.
- `src/lib/EditScreen.svelte` – map and target entry, export/import.
- `src/lib/MapPicker.svelte` – the map dropdown in the titlebar.
- `src/lib/MapView.svelte` – the Leaflet map panel: tiles, markers, tap and drag handling.
- `src/lib/ImagePicker.svelte` – the "which image" dropdown.
- `src/lib/maps.ts` – the map image registry, coordinate mapping and tile URLs.
- `src/lib/store.svelte.ts` – shared app state and persistence.
- `src/lib/library.ts` – map/target types, the shared JSON format, merge and export.
- `src/lib/Field.svelte` – one numeric input.
- `src/lib/InstallBar.svelte` – the add-to-home-screen hint.
- `src/lib/mortar.ts` – the range/bearing math.
- `src/lib/storage.ts` – guarded `localStorage` helpers.
- `public/` – icons and the `CNAME` for the custom domain, copied into `dist/` as-is.
- `vite.config.ts` – build config, the PWA manifest and the tile cache rule.
- `scripts/tile-maps.py` – cuts the source renders into tile pyramids.
- `scripts/serve-tiles.py` – serves a local tile folder with CORS for development.

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

The tiles deploy separately: the `wardogs-maps` repo has its own Pages
workflow, run by hand from its Actions tab (*Source* -> **GitHub Actions**,
custom domain `wardogsmaps.builtbyzee.com` set in its Pages settings), and
needs the matching DNS record:

    wardogsmaps  ->  zeejfps.github.io

GitHub issues the certificate once the record resolves (a few minutes to an hour);
tick *Enforce HTTPS* on that Pages settings page after it does.
