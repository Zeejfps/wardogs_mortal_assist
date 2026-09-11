// App state: the saved library, which map and target are selected, and the
// manually typed target. One instance shared by both screens.
import {
  emptyLibrary, mergeLibrary, newLocation, newMap, parseLibrary, serialize, slug,
  exportFile, type GameMap, type Library, type Location,
} from './library';
import type { Position } from './mortar';
import { read, write } from './storage';

const LIB_KEY = 'mortar.library';
const SEL_KEY = 'mortar.selection';
/** Pre-library builds saved the four fields under this key. */
const LEGACY_KEY = 'mortar';

interface Selection {
  mapId: string;
  locationId: string | null;
  manual: { tx: string; ty: string };
}

function load(): { library: Library; sel: Selection } {
  const library = read<Library | null>(LIB_KEY, null) ?? emptyLibrary();
  const sel = read<Selection>(SEL_KEY, { mapId: '', locationId: null, manual: { tx: '', ty: '' } });

  if (library.maps.length === 0) {
    // First run on this build: carry the old saved fields into a default map.
    const legacy = read<Partial<Position>>(LEGACY_KEY, {});
    const map = newMap('Map 1');
    map.mortar = { x: legacy.mx ?? '', y: legacy.my ?? '' };
    library.maps.push(map);
    sel.manual = { tx: legacy.tx ?? '', ty: legacy.ty ?? '' };
  }
  if (!library.maps.some((m) => m.id === sel.mapId)) {
    sel.mapId = library.maps[0].id;
    sel.locationId = null;
  }
  return { library, sel };
}

class Store {
  library = $state<Library>(emptyLibrary());
  mapId = $state('');
  locationId = $state<string | null>(null);
  manual = $state({ tx: '', ty: '' });

  constructor() {
    const { library, sel } = load();
    this.library = library;
    this.mapId = sel.mapId;
    this.locationId = sel.locationId;
    this.manual = sel.manual;
  }

  get map(): GameMap {
    return this.library.maps.find((m) => m.id === this.mapId) ?? this.library.maps[0];
  }

  get location(): Location | null {
    if (this.locationId == null) return null;
    return this.map.locations.find((l) => l.id === this.locationId) ?? null;
  }

  /** The four fields the solver wants: gun from the map, target from the pick or manual entry. */
  get pos(): Position {
    const loc = this.location;
    return {
      mx: this.map.mortar.x,
      my: this.map.mortar.y,
      tx: loc ? loc.x : this.manual.tx,
      ty: loc ? loc.y : this.manual.ty,
    };
  }

  persist(): void {
    write(LIB_KEY, this.library);
    write(SEL_KEY, { mapId: this.mapId, locationId: this.locationId, manual: this.manual });
  }

  selectMap(id: string): void {
    if (id === this.mapId) return;
    this.mapId = id;
    this.locationId = null;
  }

  selectLocation(id: string | null): void {
    this.locationId = id;
  }

  addMap(name = `Map ${this.library.maps.length + 1}`): GameMap {
    const map = newMap(name);
    this.library.maps.push(map);
    this.mapId = map.id;
    this.locationId = null;
    return map;
  }

  /** The last map cannot be removed; there is always somewhere to type. */
  deleteMap(id: string): void {
    if (this.library.maps.length <= 1) return;
    this.library.maps = this.library.maps.filter((m) => m.id !== id);
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
