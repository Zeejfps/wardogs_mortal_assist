# Mortar Calculator

Tiny always-on-top Electron window for computing mortar range in-game.

    distance = sqrt((X1 - X)^2 + (Y1 - Y)^2) * 100

- **Mortar X / Y** – your gun position. Saved automatically and restored on next launch.
- **Target X1 / Y1** – updates the distance live as you type. Enter jumps to the next field.
- Readout also shows ΔX, ΔY (scaled) and a bearing (0° = +Y, clockwise).
- 📌 toggles always-on-top. Drag the title bar to move the window.

## Run

    npm install
    npm start

## Build a portable .exe

    npm run build

Produces `dist/MortarCalculator.exe`, a single self-contained file you can copy anywhere and
double-click. No install needed. Code signing is disabled (the exe is unsigned), so Windows
SmartScreen may warn on first launch; click "More info" then "Run anyway".

## Not staying on top of the game?

Windows lets nothing draw over a game running in **exclusive fullscreen**. Switch the
game's display mode to **Borderless** / **Windowed Fullscreen** and the calculator will
stay visible. The app re-asserts topmost whenever it loses focus, so games that grab the
topmost slot themselves are handled.
