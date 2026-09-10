# Mortar Calculator

Tiny mortar range calculator. The same files in `src/` run two ways:

- an always-on-top desktop window (Tauri), and
- an installable web app (PWA) you can add to a phone home screen and use offline.

    distance = sqrt((X1 - X)^2 + (Y1 - Y)^2) * 100

- **Mortar X / Y** – your gun position. Saved automatically and restored on next launch.
- **Target X1 / Y1** – updates the distance live as you type. Enter jumps to the next field.
- Readout also shows ΔX, ΔY (scaled) and a bearing (0° = +Y, clockwise).
- Pin button toggles always-on-top (orange solid pin = pinned, grey slashed pin = not).
  Drag the title bar to move the window.

## Layout

- `src/index.html` – the whole UI and math.
- `src-tauri/` – Rust shell, window config (`tauri.conf.json`), permissions (`capabilities/`).

## Prerequisites

- Node.js
- Rust toolchain (`rustup`) with the MSVC target
- Visual Studio Build Tools (C++ workload)
- WebView2 runtime (ships with Windows 11)

## Run in dev

    npm install
    npm start

## Build a standalone .exe

    npm run build

Output:

- `src-tauri/target/release/MortarCalculator.exe` – standalone exe, copy anywhere and run.
- `src-tauri/target/release/bundle/nsis/*.exe` – optional installer.

The exe is unsigned, so Windows SmartScreen may warn on first launch; click "More info" then
"Run anyway".

## Phone / web app

`src/` is a static site with no build step - upload the folder as-is.

    npm run serve          # http://localhost:5173 to check it locally

Requirements for the install prompt and offline caching: it must be served over
**HTTPS** (or `localhost`). Plain HTTP on a LAN address will render, but the browser
will not offer to install it and the service worker stays off.

Install on the phone:

- **Android / Chrome** - open the URL, menu -> *Add to Home screen* (or the install banner).
- **iOS / Safari** - open the URL, Share -> *Add to Home Screen*. Must be Safari;
  Chrome on iOS cannot install web apps.

Once added it launches full screen with no browser chrome, the mortar position is
remembered in `localStorage`, and it works with no signal.

### Deploying an update

`src/sw.js` caches everything on first load, so after uploading new files bump
`CACHE` at the top of `sw.js` (`mortar-v1` -> `mortar-v2`). Without that bump an
already-installed phone can keep serving the old copy.

## Not staying on top of the game?

Windows lets nothing draw over a game running in **exclusive fullscreen**. Switch the
game's display mode to **Borderless** / **Windowed Fullscreen** and the calculator will
stay visible. The app re-asserts topmost whenever it loses focus, so games that grab the
topmost slot themselves are handled.
