// The user's saved maps and locations, plus the JSON format used to share
// them. Pure data code: no Svelte, no storage, so it is easy to test.
import type { ImageId } from './maps';

declare const brand: unique symbol;
/** Ids are branded so a gun id cannot be handed to something wanting a map id. */
export type MapId = string & { readonly [brand]: 'MapId' };
export type GunId = string & { readonly [brand]: 'GunId' };
export type LocationId = string & { readonly [brand]: 'LocationId' };

// The single place each brand is minted; a brand is a compile-time tag on a string, so the cast is sound.
export function mapId(s: string): MapId {
  return s as MapId;
}
export function gunId(s: string): GunId {
  return s as GunId;
}
export function locationId(s: string): LocationId {
  return s as LocationId;
}

export interface Location {
  id: LocationId;
  name: string;
  /** Map units as typed, kept as strings so they round-trip exactly. */
  x: string;
  y: string;
}

/** A place the mortar is set up. Maps usually have one or two. */
export interface Gun {
  id: GunId;
  name: string;
  x: string;
  y: string;
}

export interface GameMap {
  id: MapId;
  name: string;
  /** Id of a built-in map image (see maps.ts) to draw under the markers. */
  image?: ImageId;
  /** Empty until the user places or types a mortar. */
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
  return { id: gunId(uid()), name, x, y };
}

/** Short default names for guns: A, B, C… then A2, B2… so pills stay narrow. */
export function nextGunName(guns: Gun[]): string {
  const n = guns.length;
  const letter = String.fromCharCode(65 + (n % 26));
  return n < 26 ? letter : `${letter}${Math.floor(n / 26) + 1}`;
}

export function newMap(name: string, image?: ImageId): GameMap {
  const map: GameMap = { id: mapId(uid()), name, guns: [], locations: [] };
  if (image) map.image = image;
  return map;
}

export function newLocation(name = '', x = '', y = ''): Location {
  return { id: locationId(uid()), name, x, y };
}

export function emptyLibrary(): Library {
  return { version: 1, maps: [] };
}

/** Coordinate text from whatever was stored: numbers become their text, anything else blank. */
export function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Property `key` of a decoded value, or undefined when it is not an object or has no such key. */
export function field(raw: unknown, key: string): unknown {
  return typeof raw === 'object' && raw !== null && key in raw ? Reflect.get(raw, key) : undefined;
}

/** Parse shared JSON, tolerating missing ids and numeric coordinates. Throws on garbage. */
export function parseLibrary(text: string): Library {
  return libraryFromJSON(JSON.parse(text));
}

/**
 * Normalise a decoded library. Also used on the locally stored copy, so a
 * library saved by an older build (single `mortar` per map) loads as one gun.
 * Guns without a position are dropped: earlier builds gave every map a blank
 * gun "A", and an unplaced gun is nothing but a pill with nothing behind it.
 */
export function libraryFromJSON(raw: unknown): Library {
  const version = field(raw, 'version');
  if (typeof version === 'number' && version > 1) {
    throw new Error(`Made by a newer version (format ${version})`);
  }
  const rawMaps = field(raw, 'maps');
  if (!Array.isArray(rawMaps)) throw new Error('Not a maps file');

  const maps: GameMap[] = rawMaps.map((m: unknown): GameMap => {
    const rawLocations = field(m, 'locations');
    const rawGuns = field(m, 'guns');
    const guns: Gun[] = (Array.isArray(rawGuns) ? rawGuns : [])
      .map((g: unknown, i: number): Gun => ({
        id: gunId(str(field(g, 'id')) || uid()),
        name: str(field(g, 'name')) || String.fromCharCode(65 + (i % 26)),
        x: str(field(g, 'x')),
        y: str(field(g, 'y')),
      }))
      .filter((g) => g.x || g.y);
    const mortar = field(m, 'mortar');
    const legacy = newGun('A', str(field(mortar, 'x')), str(field(mortar, 'y')));
    if (guns.length === 0 && (legacy.x || legacy.y)) guns.push(legacy);
    const map: GameMap = {
      id: mapId(str(field(m, 'id')) || uid()),
      name: str(field(m, 'name')) || 'Untitled',
      guns,
      locations: (Array.isArray(rawLocations) ? rawLocations : []).map((l: unknown): Location => ({
        id: locationId(str(field(l, 'id')) || uid()),
        name: str(field(l, 'name')),
        x: str(field(l, 'x')),
        y: str(field(l, 'y')),
      })),
    };
    const image = str(field(m, 'image'));
    // Branded here rather than via maps.imageId() so this module keeps no runtime edge to maps.ts
    // (and through it to Leaflet). A name no image has is harmless: imageById() returns undefined.
    if (image) map.image = image as ImageId;
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
  // Both are in lib.dom but absent on older browsers, hence the runtime check.
  const canShare = typeof navigator.canShare === 'function' && typeof navigator.share === 'function';
  if (canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
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
