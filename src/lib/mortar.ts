// Map units are multiplied by SCALE to get metres.
export const SCALE = 100;

/** The four coordinate fields as typed by the user, so they may be blank. */
export interface Position {
  mx: string;
  my: string;
  tx: string;
  ty: string;
}

export interface Solution {
  /** Range in metres. */
  dist: number;
  /** Offsets in metres. */
  dx: number;
  dy: number;
  /** Bearing in degrees: 0° = +Y, clockwise. */
  brg: number;
}

/**
 * Clean a typed coordinate: digits, one decimal point and an optional leading
 * minus. Coordinates are kept as text so a half-typed "12." survives; number
 * inputs would round-trip through a number and drop the trailing point.
 */
export function coord(value: unknown): string {
  const raw = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  let out = '';
  let dot = false;
  for (const c of raw.replace(',', '.')) {
    if (c === '-' && out === '') out += c;
    else if (c === '.' && !dot) { dot = true; out += c; }
    else if (c >= '0' && c <= '9') out += c;
  }
  return out;
}

/** Parse an input's text; anything that is not a finite number counts as 0. */
/** Whether both coordinates of a point have been entered. */
export function isSet(x: string, y: string): boolean {
  return Number.isFinite(parseFloat(x)) && Number.isFinite(parseFloat(y));
}

export function num(value: string): number {
  const v = parseFloat(value);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Range and bearing from the mortar to the target.
 * Adjust the bearing convention if the game uses a different one.
 */
export function solve({ mx, my, tx, ty }: Position): Solution {
  const dx = num(tx) - num(mx);
  const dy = num(ty) - num(my);
  const dist = Math.sqrt(dx * dx + dy * dy) * SCALE;
  let brg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (brg < 0) brg += 360;
  return { dist, dx: dx * SCALE, dy: dy * SCALE, brg };
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
