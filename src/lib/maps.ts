// The map images the app can draw under a map's guns and targets. The tiles
// are cut by scripts/tile-maps.py and hosted separately (they are hundreds of
// megabytes); this file is what ties a tile pyramid to game coordinates.
import L from 'leaflet';

declare const brand: unique symbol;
/** Id of a built-in image, distinct from the map/gun/location ids in library.ts. */
export type ImageId = string & { readonly [brand]: 'ImageId' };

// The single place this brand is minted; a brand is a compile-time tag on a string, so the cast is sound.
export function imageId(s: string): ImageId {
  return s as ImageId;
}

export interface MapImage {
  id: ImageId;
  name: string;
  /** Game units across the square image; the origin is bottom-left, Y up. */
  units: number;
  /** Deepest zoom that has tiles; Leaflet upscales past it. */
  maxZoom: number;
}

/**
 * Every map is a 163.84-unit (16.4 km) world; calibrated against landmarks
 * on Ozeti and Bakurani. The 32k renders are 0.5 m per source pixel, the 16k
 * Bakurani render 1 m, and all three tile down to the same 16k pyramid.
 */
export const MAP_IMAGES: MapImage[] = [
  { id: imageId('bakurani'), name: 'Bakurani', units: 163.84, maxZoom: 6 },
  { id: imageId('ozeti'), name: 'Ozeti', units: 163.84, maxZoom: 6 },
  { id: imageId('zesty'), name: 'Zestafona', units: 163.84, maxZoom: 6 },
];

/** Where the tiles live; override with VITE_TILE_BASE to test a local copy. */
const tileBaseEnv: unknown = import.meta.env.VITE_TILE_BASE;
export const TILE_BASE: string =
  typeof tileBaseEnv === 'string' ? tileBaseEnv.replace(/\/$/, '') : 'https://wardogsmaps.builtbyzee.com';

export function imageById(id: ImageId | undefined): MapImage | undefined {
  return id ? MAP_IMAGES.find((m) => m.id === id) : undefined;
}

/** The image whose name matches a map name, so "Ozeti" links itself. */
export function imageByName(name: string): MapImage | undefined {
  const n = name.trim().toLowerCase();
  return MAP_IMAGES.find((m) => m.name.toLowerCase() === n);
}

export function tileUrl(img: MapImage): string {
  return `${TILE_BASE}/${img.id}/{z}/{x}/{y}.webp`;
}

/**
 * A Leaflet CRS where latlng *is* the game coordinate: lat = Y, lng = X.
 * Zoom 0 puts the whole map in one 256 px tile with the origin bottom-left,
 * which is exactly how the tiler lays the pyramid out.
 */
export function crsFor(img: MapImage): L.CRS {
  const s = 256 / img.units;
  return L.Util.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(s, 0, -s, 256),
  });
}

export function unitBounds(img: MapImage): L.LatLngBounds {
  return L.latLngBounds([0, 0], [img.units, img.units]);
}

export function toLatLng(x: number, y: number): L.LatLngExpression {
  return [y, x];
}

/** Map units from a tap: 0.01 unit is a metre, plenty for a mortar. */
export function fmtUnit(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/**
 * Pull the shallow zoom levels through the service worker once per session
 * so the whole map is there at a glance offline; deeper tiles are cached as
 * they are viewed. About 340 small requests (3 MB), fired and forgotten.
 * `warmed` is the caller's record of which images are done (the store owns
 * it), so this module holds no state of its own.
 */
export function warmTiles(img: MapImage, warmed: Set<ImageId>, upToZoom = 4): void {
  if (warmed.has(img.id) || !navigator.onLine) return;
  warmed.add(img.id);
  const tpl = tileUrl(img);
  for (let z = 0; z <= Math.min(upToZoom, img.maxZoom); z++) {
    const n = 1 << z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const url = tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
        fetch(url).catch(() => {});
      }
    }
  }
}
