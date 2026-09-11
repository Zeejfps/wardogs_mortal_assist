// The user's saved maps and locations, plus the JSON format used to share
// them. Pure data code: no Svelte, no storage, so it is easy to test.

export interface Location {
  id: string;
  name: string;
  /** Map units as typed, kept as strings so they round-trip exactly. */
  x: string;
  y: string;
}

export interface GameMap {
  id: string;
  name: string;
  /** Gun position last used on this map. */
  mortar: { x: string; y: string };
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

export function newMap(name: string): GameMap {
  return { id: uid(), name, mortar: { x: '', y: '' }, locations: [] };
}

export function newLocation(name = '', x = '', y = ''): Location {
  return { id: uid(), name, x, y };
}

export function emptyLibrary(): Library {
  return { version: 1, maps: [] };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Parse shared JSON, tolerating missing ids and numeric coordinates. Throws on garbage. */
export function parseLibrary(text: string): Library {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object') throw new Error('Not a maps file');
  const obj = raw as { version?: unknown; maps?: unknown };
  if (typeof obj.version === 'number' && obj.version > 1) {
    throw new Error(`Made by a newer version (format ${obj.version})`);
  }
  if (!Array.isArray(obj.maps)) throw new Error('Not a maps file');

  const maps: GameMap[] = obj.maps.map((m: unknown) => {
    const mm = (m ?? {}) as Partial<GameMap> & { mortar?: Partial<GameMap['mortar']> };
    const locations = Array.isArray(mm.locations) ? mm.locations : [];
    return {
      id: str(mm.id) || uid(),
      name: str(mm.name) || 'Untitled',
      mortar: { x: str(mm.mortar?.x), y: str(mm.mortar?.y) },
      locations: locations.map((l: unknown) => {
        const ll = (l ?? {}) as Partial<Location>;
        return { id: str(ll.id) || uid(), name: str(ll.name), x: str(ll.x), y: str(ll.y) };
      }),
    };
  });
  return { version: 1, maps };
}

/**
 * Merge a shared library into the local one, matching maps and locations by
 * id. Matches are replaced, everything else is appended. Local mortar
 * positions are kept. Mutates `into` and reports what changed.
 */
export function mergeLibrary(into: Library, from: Library): { maps: number; locations: number } {
  let maps = 0;
  let locations = 0;
  for (const src of from.maps) {
    const dst = into.maps.find((m) => m.id === src.id);
    if (!dst) {
      into.maps.push(structuredClone(src));
      maps++;
      locations += src.locations.length;
      continue;
    }
    dst.name = src.name;
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
