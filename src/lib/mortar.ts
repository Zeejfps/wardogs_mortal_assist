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

/** Parse an input's text; anything that is not a finite number counts as 0. */
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
