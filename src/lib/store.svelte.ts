// App state: the saved library, which map, gun and target are selected, the
// manually typed target, and the manual entries the user chose to keep. One
// instance shared by both screens.
import {
  emptyLibrary, libraryFromJSON, mergeLibrary, newGun, newLocation, newMap, nextGunName,
  parseLibrary, serialize, slug, str, exportFile,
  type GameMap, type Gun, type Library, type Location,
} from './library';
import { fmtUnit, imageByName } from './maps';
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

/**
 * Everything that is the user's own position in the data rather than the
 * data itself. Kept out of the library so exports stay clean.
 */
interface Selection {
  mapId: string;
  locationId: string | null;
  manual: { tx: string; ty: string };
  /** Active gun per map id. */
  gunIds: Record<string, string>;
  /** Kept manual targets per map id, newest first. */
  recents: Record<string, Recent[]>;
  /** Whether the map panel on the fire screen is open. */
  mapOpen: boolean;
}

function loadLibrary(): Library {
  const raw = read<unknown>(LIB_KEY, null);
  if (raw == null) return emptyLibrary();
  try {
    return libraryFromJSON(raw);
  } catch {
    return emptyLibrary();
  }
}

function load(): { library: Library; sel: Selection } {
  const library = loadLibrary();
  const stored = read<Partial<Selection>>(SEL_KEY, {});
  const sel: Selection = {
    mapId: stored.mapId ?? '',
    locationId: stored.locationId ?? null,
    // Earlier builds saved these as numbers straight from the number inputs.
    manual: { tx: str(stored.manual?.tx), ty: str(stored.manual?.ty) },
    gunIds: stored.gunIds ?? {},
    recents: stored.recents ?? {},
    mapOpen: stored.mapOpen ?? true,
  };

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
  if (read<number>(PRESETS_KEY, 0) < PRESETS_VERSION) {
    mergeLibrary(library, presetLibrary(), { byImage: true });
    write(LIB_KEY, library);
    write(PRESETS_KEY, PRESETS_VERSION);
  }
  if (!library.maps.some((m) => m.id === sel.mapId)) {
    sel.mapId = library.maps[0].id;
    sel.locationId = null;
  }
  return { library, sel };
}

function sameRecent(a: Recent, b: Recent): boolean {
  return num(a.x) === num(b.x) && num(a.y) === num(b.y);
}

class Store {
  library = $state<Library>(emptyLibrary());
  mapId = $state('');
  locationId = $state<string | null>(null);
  manual = $state({ tx: '', ty: '' });
  gunIds = $state<Record<string, string>>({});
  recents = $state<Record<string, Recent[]>>({});
  mapOpen = $state(true);

  constructor() {
    const { library, sel } = load();
    this.library = library;
    this.mapId = sel.mapId;
    this.locationId = sel.locationId;
    this.manual = sel.manual;
    this.gunIds = sel.gunIds;
    this.recents = sel.recents;
    this.mapOpen = sel.mapOpen;
  }

  get map(): GameMap {
    return this.library.maps.find((m) => m.id === this.mapId) ?? this.library.maps[0];
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

  get location(): Location | null {
    if (this.locationId == null) return null;
    return this.map.locations.find((l) => l.id === this.locationId) ?? null;
  }

  /** Recent manual targets on the current map, newest first. */
  get mapRecents(): Recent[] {
    return this.recents[this.mapId] ?? [];
  }

  /** The four fields the solver wants: gun from the map, target from the pick or manual entry. */
  get pos(): Position {
    const loc = this.location;
    const gun = this.gun;
    return {
      mx: gun?.x ?? '',
      my: gun?.y ?? '',
      tx: loc ? loc.x : this.manual.tx,
      ty: loc ? loc.y : this.manual.ty,
    };
  }

  persist(): void {
    write(LIB_KEY, this.library);
    const sel: Selection = {
      mapId: this.mapId, locationId: this.locationId, manual: this.manual,
      gunIds: this.gunIds, recents: this.recents, mapOpen: this.mapOpen,
    };
    write(SEL_KEY, sel);
  }

  selectMap(id: string): void {
    if (id === this.mapId) return;
    this.mapId = id;
    this.locationId = null;
  }

  selectLocation(id: string | null): void {
    this.locationId = id;
  }

  selectGun(id: string): void {
    this.gunIds[this.mapId] = id;
  }

  addGun(): Gun {
    const guns = this.map.guns;
    guns.push(newGun(nextGunName(guns)));
    // Hand back the reactive entry, not the plain object pushed in, so
    // writes made through it (a tap placing the gun) are seen by the UI.
    const gun = guns[guns.length - 1];
    this.gunIds[this.mapId] = gun.id;
    return gun;
  }

  deleteGun(id: string): void {
    const map = this.map;
    map.guns = map.guns.filter((g) => g.id !== id);
    if (this.gunIds[map.id] === id) delete this.gunIds[map.id];
  }

  /**
   * Whether the Add button has anything to add: a complete manual entry that
   * is not already a recent. A saved target is a tile already.
   */
  get canAddRecent(): boolean {
    if (this.locationId != null) return false;
    const { tx, ty } = this.manual;
    if (!Number.isFinite(parseFloat(tx)) || !Number.isFinite(parseFloat(ty))) return false;
    return !this.mapRecents.some((r) => sameRecent(r, { x: tx, y: ty }));
  }

  /** Keep the manual target as a recent tile, at the front. Nothing is kept unless asked. */
  addRecent(): void {
    if (!this.canAddRecent) return;
    const entry: Recent = { x: this.manual.tx, y: this.manual.ty };
    this.recents[this.mapId] = [entry, ...this.mapRecents].slice(0, MAX_RECENTS);
  }

  /**
   * Typing into a target field. With a saved target selected, the entry
   * detaches into a manual one starting from that target's coordinates, so
   * a nudge never edits the saved target itself.
   */
  typeTarget(field: 'tx' | 'ty', value: string): void {
    const loc = this.location;
    if (loc) {
      this.manual = { tx: loc.x, ty: loc.y };
      this.locationId = null;
    }
    this.manual[field] = value;
  }

  /** A tap on the map: a manual target at that point. */
  setManual(x: number, y: number): void {
    this.locationId = null;
    this.manual = { tx: fmtUnit(x), ty: fmtUnit(y) };
  }

  /** A long press or drag on the map: move the active gun there, creating it on a map with none. */
  setGun(x: number, y: number): void {
    const gun = this.gun ?? this.addGun();
    gun.x = fmtUnit(x);
    gun.y = fmtUnit(y);
  }

  /** Typing into a mortar field on the fire screen. The first keystroke on a map with no gun creates one. */
  typeGun(field: 'x' | 'y', value: string): void {
    const gun = this.gun ?? this.addGun();
    gun[field] = value;
  }

  /** Load a recent entry back into the manual fields. */
  useRecent(r: Recent): void {
    this.locationId = null;
    this.manual = { tx: r.x, ty: r.y };
  }

  /** Drop a recent tile. The manual fields keep their values, so Add can bring it back. */
  removeRecent(r: Recent): void {
    this.recents[this.mapId] = this.mapRecents.filter((e) => !sameRecent(e, r));
  }

  /** Turn a recent entry into a saved target on this map and select it. */
  promoteRecent(r: Recent): Location {
    const loc = this.addLocation(`Target ${this.map.locations.length + 1}`, r.x, r.y);
    this.recents[this.mapId] = this.mapRecents.filter((e) => !sameRecent(e, r));
    this.locationId = loc.id;
    return loc;
  }

  addMap(name = `Map ${this.library.maps.length + 1}`, image?: string): GameMap {
    const map = newMap(name, image);
    this.library.maps.push(map);
    this.mapId = map.id;
    this.locationId = null;
    return map;
  }

  /** The last map cannot be removed; there is always somewhere to type. */
  deleteMap(id: string): void {
    if (this.library.maps.length <= 1) return;
    this.library.maps = this.library.maps.filter((m) => m.id !== id);
    delete this.gunIds[id];
    delete this.recents[id];
    if (this.mapId === id) {
      this.mapId = this.library.maps[0].id;
      this.locationId = null;
    }
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
    if (this.locationId != null && !this.location) this.locationId = null;
  }

  deleteLocation(id: string): void {
    this.map.locations = this.map.locations.filter((l) => l.id !== id);
    if (this.locationId === id) this.locationId = null;
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

export const store = new Store();
