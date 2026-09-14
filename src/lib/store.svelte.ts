// App state: the saved library, which map, gun and target are selected, and
// the manual entries the user chose to keep. One instance is created by
// App.svelte and handed to the screens through Svelte context.
import { getContext, setContext } from 'svelte';
import {
  emptyLibrary, field, gunId, libraryFromJSON, locationId, mapId, mergeLibrary, newGun, newLocation,
  newMap, nextGunName, parseLibrary, serialize, slug, str, exportFile,
  type GameMap, type Gun, type GunId, type Library, type Location, type LocationId, type MapId,
} from './library';
import { fmtUnit, imageByName, type ImageId } from './maps';
import { isSet, num, type Position } from './mortar';
import { PRESETS_VERSION, presetLibrary } from './presets';
import { read, write } from './storage';

const LIB_KEY = 'mortar.library';
const SEL_KEY = 'mortar.selection';
/** The PRESETS_VERSION last merged into the library. */
const PRESETS_KEY = 'mortar.presets';
/** How many kept manual entries per map; the oldest falls off the end. */
const MAX_RECENTS = 6;

/** A manual target the user chose to keep so it can be re-used. */
export interface Recent {
  x: string;
  y: string;
}

/** Which target the range is measured to: a saved target on the map, or coordinates typed in. */
export type Target =
  | { kind: 'saved'; id: LocationId }
  | { kind: 'manual'; tx: string; ty: string };

function manual(tx: string, ty: string): Target {
  return { kind: 'manual', tx, ty };
}

/**
 * Everything that is the user's own position in the data rather than the
 * data itself. Kept out of the library so exports stay clean.
 */
interface Selection {
  mapId: MapId;
  target: Target;
  /** Active gun per map id. */
  gunIds: Record<MapId, GunId>;
  /** Kept manual targets per map id, newest first. */
  recents: Record<MapId, Recent[]>;
  /** Whether the map panel on the fire screen is open. */
  mapOpen: boolean;
}

function targetFromJSON(raw: unknown): Target {
  const target = field(raw, 'target');
  const kind = field(target, 'kind');
  if (kind === 'saved') {
    const id = field(target, 'id');
    if (typeof id === 'string') return { kind: 'saved', id: locationId(id) };
  } else if (kind === 'manual') {
    return manual(str(field(target, 'tx')), str(field(target, 'ty')));
  }
  // Earlier builds kept a nullable locationId beside the manual entry, and
  // before that saved the manual entry as numbers straight from number inputs.
  const legacy = field(raw, 'locationId');
  if (typeof legacy === 'string') return { kind: 'saved', id: locationId(legacy) };
  const m = field(raw, 'manual');
  return manual(str(field(m, 'tx')), str(field(m, 'ty')));
}

function gunIdsFromJSON(raw: unknown): Record<MapId, GunId> {
  const out: Record<MapId, GunId> = {};
  if (raw === null || typeof raw !== 'object') return out;
  for (const key of Object.keys(raw)) {
    const id = field(raw, key);
    if (typeof id === 'string') out[mapId(key)] = gunId(id);
  }
  return out;
}

function recentsFromJSON(raw: unknown): Record<MapId, Recent[]> {
  const out: Record<MapId, Recent[]> = {};
  if (raw === null || typeof raw !== 'object') return out;
  for (const key of Object.keys(raw)) {
    const list = field(raw, key);
    if (!Array.isArray(list)) continue;
    const entries: unknown[] = list;
    out[mapId(key)] = entries
      .filter((r) => r !== null && typeof r === 'object')
      .map((r) => ({ x: str(field(r, 'x')), y: str(field(r, 'y')) }));
  }
  return out;
}

/** Decode a stored selection, current or legacy shape; anything malformed falls back to a default. */
function selectionFromJSON(raw: unknown): Selection {
  const id = field(raw, 'mapId');
  const open = field(raw, 'mapOpen');
  return {
    mapId: mapId(typeof id === 'string' ? id : ''),
    target: targetFromJSON(raw),
    gunIds: gunIdsFromJSON(field(raw, 'gunIds')),
    recents: recentsFromJSON(field(raw, 'recents')),
    mapOpen: typeof open === 'boolean' ? open : true,
  };
}

function loadLibrary(): Library {
  const raw = read(LIB_KEY);
  if (raw == null) return emptyLibrary();
  try {
    return libraryFromJSON(raw);
  } catch {
    return emptyLibrary();
  }
}

function load(): { library: Library; sel: Selection } {
  const library = loadLibrary();
  const sel = selectionFromJSON(read(SEL_KEY));

  // A map made before images existed links itself if it is named after one.
  // Done before the presets merge so such a map is matched rather than doubled.
  for (const m of library.maps) {
    if (!m.image) {
      const img = imageByName(m.name);
      if (img) m.image = img.id;
    }
  }
  // The built-in maps and targets: everything on a first run, and whenever a
  // build ships a newer set, the changes merged into the maps already here.
  // Saved straight away so the merge is not repeated if the app is closed
  // before the first persist.
  const merged = read(PRESETS_KEY);
  if ((typeof merged === 'number' ? merged : 0) < PRESETS_VERSION) {
    mergeLibrary(library, presetLibrary(), { byImage: true });
    write(LIB_KEY, library);
    write(PRESETS_KEY, PRESETS_VERSION);
  }
  // There is always a map, so there is always somewhere to type.
  let first = library.maps[0];
  if (first === undefined) {
    first = newMap('Map 1');
    library.maps.push(first);
  }
  // Same rule as leaving a map: a saved target belongs to the map that is
  // gone, a manual entry comes along.
  if (!library.maps.some((m) => m.id === sel.mapId)) {
    sel.mapId = first.id;
    if (sel.target.kind === 'saved') sel.target = manual('', '');
  }
  return { library, sel };
}

function sameRecent(a: Recent, b: Recent): boolean {
  return num(a.x) === num(b.x) && num(a.y) === num(b.y);
}

export class Store {
  library = $state<Library>(emptyLibrary());
  mapId = $state<MapId>(mapId(''));
  target = $state<Target>(manual('', ''));
  gunIds = $state<Record<MapId, GunId>>({});
  recents = $state<Record<MapId, Recent[]>>({});
  mapOpen = $state(true);
  /** Images whose shallow tiles have been prefetched this session (see warmTiles). */
  readonly warmedTiles = new Set<ImageId>();

  constructor(library: Library, sel: Selection) {
    this.library = library;
    this.mapId = sel.mapId;
    this.target = sel.target;
    this.gunIds = sel.gunIds;
    this.recents = sel.recents;
    this.mapOpen = sel.mapOpen;
  }

  get map(): GameMap {
    const map = this.library.maps.find((m) => m.id === this.mapId) ?? this.library.maps[0];
    if (map === undefined) throw new Error('Library has no maps');
    return map;
  }

  /** The active gun, or null on a map with none yet. */
  get gun(): Gun | null {
    const map = this.map;
    return map.guns.find((g) => g.id === this.gunIds[map.id]) ?? map.guns[0] ?? null;
  }

  /** Whether the active gun exists and has a position. Until it does, a map tap places it. */
  get gunPlaced(): boolean {
    const g = this.gun;
    return g != null && isSet(g.x, g.y);
  }

  /** The saved target, when one is selected and still exists on the current map. */
  get location(): Location | null {
    const t = this.target;
    if (t.kind !== 'saved') return null;
    return this.map.locations.find((l) => l.id === t.id) ?? null;
  }

  /** Recent manual targets on the current map, newest first. */
  get mapRecents(): Recent[] {
    return this.recents[this.mapId] ?? [];
  }

  /** The target's coordinates: the saved target's, or as typed. A saved target that is gone reads blank. */
  private get targetCoords(): { tx: string; ty: string } {
    const t = this.target;
    if (t.kind === 'manual') return { tx: t.tx, ty: t.ty };
    const loc = this.location;
    return { tx: loc?.x ?? '', ty: loc?.y ?? '' };
  }

  /** The four fields the solver wants: gun from the map, target from the pick or manual entry. */
  get pos(): Position {
    const gun = this.gun;
    const { tx, ty } = this.targetCoords;
    return { mx: gun?.x ?? '', my: gun?.y ?? '', tx, ty };
  }

  persist(): void {
    write(LIB_KEY, this.library);
    const sel: Selection = {
      mapId: this.mapId, target: this.target,
      gunIds: this.gunIds, recents: this.recents, mapOpen: this.mapOpen,
    };
    write(SEL_KEY, sel);
  }

  /** A saved target belongs to its map, so leaving the map drops it; a manual entry comes along. */
  private leaveMap(id: MapId): void {
    this.mapId = id;
    if (this.target.kind === 'saved') this.target = manual('', '');
  }

  selectMap(id: MapId): void {
    if (id === this.mapId) return;
    this.leaveMap(id);
  }

  selectLocation(id: LocationId): void {
    this.target = { kind: 'saved', id };
  }

  /** Switch to manual entry, starting from the saved target's coordinates so nothing is lost. */
  selectManual(): void {
    if (this.target.kind === 'manual') return;
    const { tx, ty } = this.targetCoords;
    this.target = manual(tx, ty);
  }

  selectGun(id: GunId): void {
    this.gunIds[this.mapId] = id;
  }

  addGun(): Gun {
    const guns = this.map.guns;
    const gun = newGun(nextGunName(guns));
    guns.push(gun);
    this.gunIds[this.mapId] = gun.id;
    // Hand back the reactive entry, not the plain object pushed in, so
    // writes made through it (a tap placing the gun) are seen by the UI.
    const added = guns.find((g) => g.id === gun.id);
    if (added === undefined) throw new Error('Gun was not added');
    return added;
  }

  deleteGun(id: GunId): void {
    const map = this.map;
    map.guns = map.guns.filter((g) => g.id !== id);
    if (this.gunIds[map.id] === id) delete this.gunIds[map.id];
  }

  /**
   * Whether the Add button has anything to add: a complete manual entry that
   * is not already a recent. A saved target is a tile already.
   */
  get canAddRecent(): boolean {
    const t = this.target;
    if (t.kind !== 'manual') return false;
    if (!isSet(t.tx, t.ty)) return false;
    return !this.mapRecents.some((r) => sameRecent(r, { x: t.tx, y: t.ty }));
  }

  /** Keep the manual target as a recent tile, at the front. Nothing is kept unless asked. */
  addRecent(): void {
    if (!this.canAddRecent) return;
    const { tx, ty } = this.targetCoords;
    this.recents[this.mapId] = [{ x: tx, y: ty }, ...this.mapRecents].slice(0, MAX_RECENTS);
  }

  /**
   * Typing into a target field. With a saved target selected, the entry
   * detaches into a manual one starting from that target's coordinates, so
   * a nudge never edits the saved target itself.
   */
  typeTarget(key: 'tx' | 'ty', value: string): void {
    const { tx, ty } = this.targetCoords;
    this.target = manual(key === 'tx' ? value : tx, key === 'ty' ? value : ty);
  }

  /** A tap on the map: a manual target at that point. */
  setManual(x: number, y: number): void {
    this.target = manual(fmtUnit(x), fmtUnit(y));
  }

  /** A long press or drag on the map: move the active gun there, creating it on a map with none. */
  setGun(x: number, y: number): void {
    const gun = this.gun ?? this.addGun();
    gun.x = fmtUnit(x);
    gun.y = fmtUnit(y);
  }

  /** Typing into a mortar field on the fire screen. The first keystroke on a map with no gun creates one. */
  typeGun(key: 'x' | 'y', value: string): void {
    const gun = this.gun ?? this.addGun();
    gun[key] = value;
  }

  /** Load a recent entry back into the manual fields. */
  useRecent(r: Recent): void {
    this.target = manual(r.x, r.y);
  }

  /** Drop a recent tile. The manual fields keep their values, so Add can bring it back. */
  removeRecent(r: Recent): void {
    this.recents[this.mapId] = this.mapRecents.filter((e) => !sameRecent(e, r));
  }

  /** Turn a recent entry into a saved target on this map and select it. */
  promoteRecent(r: Recent): Location {
    const loc = this.addLocation(`Target ${this.map.locations.length + 1}`, r.x, r.y);
    this.recents[this.mapId] = this.mapRecents.filter((e) => !sameRecent(e, r));
    this.target = { kind: 'saved', id: loc.id };
    return loc;
  }

  addMap(name = `Map ${this.library.maps.length + 1}`, image?: ImageId): GameMap {
    const map = newMap(name, image);
    this.library.maps.push(map);
    this.leaveMap(map.id);
    return map;
  }

  /** The last map cannot be removed; there is always somewhere to type. */
  deleteMap(id: MapId): void {
    const rest = this.library.maps.filter((m) => m.id !== id);
    const first = rest[0];
    if (first === undefined) return;
    this.library.maps = rest;
    delete this.gunIds[id];
    delete this.recents[id];
    if (this.mapId === id) this.leaveMap(first.id);
  }

  addLocation(name = '', x = '', y = ''): Location {
    const loc = newLocation(name, x, y);
    this.map.locations.push(loc);
    return loc;
  }

  /** Drop rows that were added but never filled in, on every map. */
  pruneBlank(): void {
    for (const m of this.library.maps) {
      const kept = m.locations.filter((l) => l.name || l.x || l.y);
      if (kept.length !== m.locations.length) m.locations = kept;
    }
    if (this.target.kind === 'saved' && !this.location) this.target = manual('', '');
  }

  deleteLocation(id: LocationId): void {
    this.map.locations = this.map.locations.filter((l) => l.id !== id);
    if (this.target.kind === 'saved' && this.target.id === id) this.target = manual('', '');
  }

  exportMap(map: GameMap): Promise<boolean> {
    const lib: Library = { version: 1, maps: [map] };
    return exportFile(serialize(lib), `${slug(map.name)}.json`);
  }

  exportAll(): Promise<boolean> {
    return exportFile(serialize(this.library), 'mortar-maps.json');
  }

  /** Merge shared JSON in. Throws with a readable message on a bad file. */
  importText(text: string): { maps: number; locations: number } {
    const incoming = parseLibrary(text);
    return mergeLibrary(this.library, incoming);
  }
}

/** Build the store from what is saved. The only place storage is read. */
export function createStore(): Store {
  const { library, sel } = load();
  return new Store(library, sel);
}

const STORE_KEY = Symbol('store');

/** Share the store with every component below the caller; call during component init. */
export function provideStore(store: Store): void {
  setContext(STORE_KEY, store);
}

/** The store provided by App.svelte; call during component init. */
export function getStore(): Store {
  const store: unknown = getContext(STORE_KEY);
  if (!(store instanceof Store)) throw new Error('Store not provided');
  return store;
}
