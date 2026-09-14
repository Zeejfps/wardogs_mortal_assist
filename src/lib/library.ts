// The user's saved maps and locations, plus the JSON format used to share
// them. Pure data code: no Svelte, no storage, so it is easy to test.

export interface Location {
  id: string;
  name: string;
  /** Map units as typed, kept as strings so they round-trip exactly. */
  x: string;
  y: string;
}

/** A place the mortar is set up. Maps usually have one or two. */
export interface Gun {
  id: string;
  name: string;
  x: string;
  y: string;
}

export interface GameMap {
  id: string;
  name: string;
  /** Id of a built-in map image (see maps.ts) to draw under the markers. */
  image?: string;
  /** Never empty: there is always a gun to type into. */
  guns: Gun[];
  locations: Location[];
}

export interface Library {
  version: 1;
  maps: GameMap[];
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function newGun(name: string, x = '', y = ''): Gun {
  return { id: uid(), name, x, y };
}

/** Short default names for guns: A, B, C… then A2, B2… so pills stay narrow. */
export function nextGunName(guns: Gun[]): string {
  const n = guns.length;
  const letter = String.fromCharCode(65 + (n % 26));
  return n < 26 ? letter : `${letter}${Math.floor(n / 26) + 1}`;
}

export function newMap(name: string, image?: string): GameMap {
  const map: GameMap = { id: uid(), name, guns: [newGun('A')], locations: [] };
  if (image) map.image = image;
  return map;
}

export function newLocation(name = '', x = '', y = ''): Location {
  return { id: uid(), name, x, y };
}

export function emptyLibrary(): Library {
  return { version: 1, maps: [] };
}

/** Coordinate text from whatever was stored: numbers become their text, anything else blank. */
export function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Parse shared JSON, tolerating missing ids and numeric coordinates. Throws on garbage. */
export function parseLibrary(text: string): Library {
  return libraryFromJSON(JSON.parse(text));
}

/**
 * Normalise a decoded library. Also used on the locally stored copy, so a
 * library saved by an older build (single `mortar` per map) loads as one gun.
 */
export function libraryFromJSON(raw: unknown): Library {
  if (!raw || typeof raw !== 'object') throw new Error('Not a maps file');
  const obj = raw as { version?: unknown; maps?: unknown };
  if (typeof obj.version === 'number' && obj.version > 1) {
    throw new Error(`Made by a newer version (format ${obj.version})`);
  }
  if (!Array.isArray(obj.maps)) throw new Error('Not a maps file');

  const maps: GameMap[] = obj.maps.map((m: unknown) => {
    const mm = (m ?? {}) as Partial<GameMap> & { mortar?: { x?: unknown; y?: unknown } };
    const locations = Array.isArray(mm.locations) ? mm.locations : [];
    const rawGuns = Array.isArray(mm.guns) ? mm.guns : [];
    const guns: Gun[] = rawGuns.map((g: unknown, i: number) => {
      const gg = (g ?? {}) as Partial<Gun>;
      return { id: str(gg.id) || uid(), name: str(gg.name) || String.fromCharCode(65 + (i % 26)), x: str(gg.x), y: str(gg.y) };
    });
    if (guns.length === 0) guns.push(newGun('A', str(mm.mortar?.x), str(mm.mortar?.y)));
    const map: GameMap = {
      id: str(mm.id) || uid(),
      name: str(mm.name) || 'Untitled',
      guns,
      locations: locations.map((l: unknown) => {
        const ll = (l ?? {}) as Partial<Location>;
        return { id: str(ll.id) || uid(), name: str(ll.name), x: str(ll.x), y: str(ll.y) };
      }),
    };
    if (str(mm.image)) map.image = str(mm.image);
    return map;
  });
  return { version: 1, maps };
}

export interface MergeOptions {
  /**
   * Also treat a map drawn on the same image as the same map when no id
   * matches. Right for the built-in presets, where each image has exactly
   * one map; wrong for a friend's file, whose Ozeti may be a different set
   * of targets worth keeping apart.
   */
  byImage?: boolean;
}

/**
 * Merge a shared library into the local one, matching maps, locations and
 * guns by id. Matches are replaced, everything else is appended; blank guns
 * are skipped so a friend's untouched default gun does not pile up, and a
 * positioned gun fills in a blank local gun of the same name rather than
 * joining it as a twin. Mutates `into` and reports what changed.
 */
export function mergeLibrary(into: Library, from: Library, opts: MergeOptions = {}): { maps: number; locations: number } {
  let maps = 0;
  let locations = 0;
  for (const src of from.maps) {
    const dst = into.maps.find((m) => m.id === src.id)
      ?? (opts.byImage && src.image ? into.maps.find((m) => m.image === src.image) : undefined);
    if (!dst) {
      into.maps.push(structuredClone(src));
      maps++;
      locations += src.locations.length;
      continue;
    }
    dst.name = src.name;
    if (src.image) dst.image = src.image;
    for (const gun of src.guns) {
      if (!gun.x && !gun.y) continue;
      let i = dst.guns.findIndex((g) => g.id === gun.id);
      if (i === -1) i = dst.guns.findIndex((g) => g.name === gun.name && !g.x && !g.y);
      if (i === -1) dst.guns.push({ ...gun });
      else dst.guns[i] = { ...gun };
    }
    for (const loc of src.locations) {
      const i = dst.locations.findIndex((l) => l.id === loc.id);
      if (i === -1) dst.locations.push({ ...loc });
      else dst.locations[i] = { ...loc };
      locations++;
    }
  }
  return { maps, locations };
}

export function serialize(lib: Library): string {
  return JSON.stringify(lib, null, 2);
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'maps';
}

/**
 * Hand a JSON file to the user: the native share sheet where the browser can
 * share files (phones), otherwise a download. Resolves false if the user
 * cancelled the share sheet.
 */
export async function exportFile(text: string, filename: string): Promise<boolean> {
  const file = new File([text], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
      // Fall through to a plain download on any other failure.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
