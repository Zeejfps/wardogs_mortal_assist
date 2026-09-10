# Mortar Calculator

Tiny always-on-top desktop window (Tauri) for computing mortar range in-game.

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

## Not staying on top of the game?

Windows lets nothing draw over a game running in **exclusive fullscreen**. Switch the
game's display mode to **Borderless** / **Windowed Fullscreen** and the calculator will
stay visible. The app re-asserts topmost whenever it loses focus, so games that grab the
topmost slot themselves are handled.
