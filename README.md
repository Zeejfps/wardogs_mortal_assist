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

Output lands in `dist/`.
