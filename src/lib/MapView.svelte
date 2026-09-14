<script lang="ts">
  // The map panel: the linked image with the guns, saved targets and the
  // manual target drawn on it. A tap on a marker selects it, a tap anywhere
  // else puts the manual target there; a long press (or right-click) moves
  // the active gun, which can also be dragged. While the active gun has no
  // position yet, a plain tap places the gun instead, so a fresh map starts
  // with the mortar rather than a target measured from nowhere. Markers are not clickable
  // themselves: the tap is hit-tested here against a small radius, so the
  // browser's touch-target adjustment cannot pull a nearby tap onto one.
  // Leaflet owns the DOM inside the container, so the marker styles below are
  // global. The Leaflet map is rebuilt when the image changes, because the
  // coordinate system is baked into it at construction; the map, its image,
  // its overlay and its view key live and die together as one `shown` value,
  // so there is never a map without an image or an overlay without a map.
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { onMount, untrack } from 'svelte';
  import type { GunId, LocationId, MapId } from './library';
  import { crsFor, imageById, tileUrl, toLatLng, unitBounds, warmTiles, type MapImage } from './maps';
  import { isSet, num } from './mortar';
  import { getStore } from './store.svelte';

  const store = getStore();

  /** How close (px) a tap must be to a marker's centre to pick it rather than place a target. */
  const SNAP_PX = matchMedia('(pointer: coarse)').matches ? 12 : 9;

  /** The Leaflet map currently built into the container, with everything that belongs to it. */
  interface Shown {
    /** Map and image, so relinking a map to another image starts fresh. */
    key: string;
    img: MapImage;
    map: L.Map;
    overlay: L.LayerGroup;
  }

  /** What a tap landed on, when it landed on a marker. */
  type Hit = { kind: 'gun'; id: GunId } | { kind: 'target'; id: LocationId };

  let el: HTMLDivElement;
  let shown: Shown | undefined;
  /** Where the finger last went down, in container pixels; see the pointerdown handler. */
  let down: L.Point | undefined;
  /** Where each map was last left, so switching back does not lose the spot. */
  const views = new Map<string, { center: L.LatLng; zoom: number }>();

  function esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function icon(cls: string, label = ''): L.DivIcon {
    return L.divIcon({
      className: 'mk',
      html: `<span class="${cls}"><i></i>${label ? `<b>${esc(label)}</b>` : ''}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  function show(img: MapImage | undefined, mapId: MapId): void {
    if (shown) {
      views.set(shown.key, { center: shown.map.getCenter(), zoom: shown.map.getZoom() });
      shown.map.remove();
      shown = undefined;
    }
    down = undefined;
    if (!img) return;
    const key = `${mapId}/${img.id}`;

    const bounds = unitBounds(img);
    const map = L.map(el, {
      crs: crsFor(img),
      minZoom: 0,
      maxZoom: img.maxZoom + 2,
      zoomSnap: 0,
      zoomControl: false,
      attributionControl: false,
      maxBounds: bounds.pad(0.25),
      maxBoundsViscosity: 0.8,
    });
    // On HiDPI screens draw the next zoom level's tiles at half size, so a
    // tile pixel is a device pixel instead of two or three; same pyramid,
    // one less level of native zoom. CORS (not opaque) responses matter:
    // Chrome pads opaque cache entries to megabytes each for quota purposes.
    const hidpi = devicePixelRatio > 1 ? 1 : 0;
    L.tileLayer(tileUrl(img), {
      tileSize: hidpi ? 128 : 256,
      zoomOffset: hidpi,
      minZoom: 0,
      maxZoom: img.maxZoom + 2,
      maxNativeZoom: img.maxZoom - hidpi,
      bounds,
      noWrap: true,
      crossOrigin: true,
      updateWhenIdle: false,
      keepBuffer: 4,
      className: 'tiles',
    }).addTo(map);
    const overlay = L.layerGroup().addTo(map);

    // Leaflet only fires click/contextmenu for taps that did not drag, so the
    // down point (recorded on the container in onMount) is the tap.
    map.on('click', (e) => {
      const pt = down ?? e.containerPoint;
      const hit = nearest(map, pt);
      if (hit?.kind === 'target') store.selectLocation(hit.id);
      else if (hit?.kind === 'gun') store.selectGun(hit.id);
      else {
        const p = map.containerPointToLatLng(pt);
        if (store.gunPlaced) store.setManual(p.lng, p.lat);
        else store.setGun(p.lng, p.lat);
      }
    });
    map.on('contextmenu', (e) => {
      const p = map.containerPointToLatLng(down ?? e.containerPoint);
      store.setGun(p.lng, p.lat);
    });
    map.on('moveend', () => {
      views.set(key, { center: map.getCenter(), zoom: map.getZoom() });
    });

    const view = views.get(key);
    if (view) map.setView(view.center, view.zoom);
    else map.fitBounds(bounds);
    shown = { key, img, map, overlay };
    warmTiles(img, store.warmedTiles);
    sync();
  }

  /** The gun or saved target whose centre is within SNAP_PX of a container point, nearest first. */
  function nearest(map: L.Map, pt: L.Point): Hit | undefined {
    let best: Hit | undefined;
    let bestD = SNAP_PX;
    function consider<Id>(items: { id: Id; x: string; y: string }[], hit: (id: Id) => Hit): void {
      for (const it of items) {
        if (!isSet(it.x, it.y)) continue;
        const d = map.latLngToContainerPoint(toLatLng(num(it.x), num(it.y))).distanceTo(pt);
        if (d <= bestD) {
          bestD = d;
          best = hit(it.id);
        }
      }
    }
    consider(store.map.locations, (id) => ({ kind: 'target', id }));
    consider(store.map.guns, (id) => ({ kind: 'gun', id }));
    return best;
  }

  function sync(): void {
    // Read the store before bailing so the effect below always tracks it.
    const m = store.map;
    const gun = store.gun;
    const loc = store.location;
    const pos = store.pos;
    if (!shown) return;
    const { overlay } = shown;
    overlay.clearLayers();

    for (const g of m.guns) {
      if (!isSet(g.x, g.y)) continue;
      const active = g.id === gun?.id;
      // Only the active gun is a real (draggable) hit target; everything else
      // is picked by the tap hit-test above.
      const mk = L.marker(toLatLng(num(g.x), num(g.y)), {
        icon: icon(active ? 'mk-gun active' : 'mk-gun', g.name),
        draggable: active,
        interactive: active,
        zIndexOffset: active ? 1000 : 500,
      });
      if (active) {
        mk.on('dragend', () => {
          const p = mk.getLatLng();
          store.setGun(p.lng, p.lat);
        });
      }
      overlay.addLayer(mk);
    }

    for (const l of m.locations) {
      if (!isSet(l.x, l.y)) continue;
      const active = loc?.id === l.id;
      overlay.addLayer(
        L.marker(toLatLng(num(l.x), num(l.y)), {
          icon: icon(active ? 'mk-tgt active' : 'mk-tgt', l.name),
          interactive: false,
          zIndexOffset: active ? 900 : 100,
        }),
      );
    }

    if (!loc && isSet(pos.tx, pos.ty)) {
      overlay.addLayer(
        L.marker(toLatLng(num(pos.tx), num(pos.ty)), { icon: icon('mk-manual'), zIndexOffset: 800, interactive: false }),
      );
    }

    if (isSet(pos.mx, pos.my) && isSet(pos.tx, pos.ty)) {
      overlay.addLayer(
        L.polyline([toLatLng(num(pos.mx), num(pos.my)), toLatLng(num(pos.tx), num(pos.ty))], {
          color: '#f5a623', weight: 2, opacity: 0.9, dashArray: '6 6', interactive: false,
        }),
      );
    }
  }

  /** Centre on the active gun, or on the whole map when the gun is not placed. */
  export function home(): void {
    if (!shown) return;
    const { map, img } = shown;
    const g = store.gun;
    if (g && isSet(g.x, g.y)) map.setView(toLatLng(num(g.x), num(g.y)), Math.max(map.getZoom(), 3));
    else map.fitBounds(unitBounds(img));
  }

  onMount(() => {
    // Resolve taps where the finger went down, not where the click lands:
    // tapping the map blurs a focused field, the keyboard closes and the page
    // reflows in between, and Leaflet would read the click against the new
    // layout. Recorded on the container, which outlives any one Leaflet map.
    const onDown = (ev: PointerEvent): void => {
      down = shown?.map.mouseEventToContainerPoint(ev);
    };
    el.addEventListener('pointerdown', onDown);
    const ro = new ResizeObserver(() => shown?.map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      shown?.map.remove();
      shown = undefined;
    };
  });

  $effect(() => {
    const img = imageById(store.map.image);
    const id = store.map.id;
    untrack(() => show(img, id));
  });

  $effect(() => {
    sync();
  });
</script>

<div class="map" bind:this={el}></div>

<style>
  .map {
    width: 100%; height: 100%; background: #0d0f12; overflow: hidden;
    cursor: crosshair;
  }
  .map :global(.tiles) { image-rendering: auto; }
  .map :global(.leaflet-container) { background: #0d0f12; font: inherit; }
  .map :global(.leaflet-marker-icon.mk) { background: none; border: 0; }

  /* Every marker is a zero-size anchor with the drawing centred on it. */
  .map :global(.mk span) {
    position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 4px;
    transform: translate(-50%, -50%); white-space: nowrap; pointer-events: none;
  }
  .map :global(.mk span i) {
    display: block; flex: none;
    box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.7);
  }
  .map :global(.mk span b) {
    font-size: 11px; font-weight: 700; color: #fff;
    text-shadow: 0 0 2px #000, 0 0 3px #000, 0 1px 2px #000;
  }

  .map :global(.mk-gun i) { width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; }
  .map :global(.mk-gun.active i) {
    background: #f5a623; width: 16px; height: 16px; cursor: grab; pointer-events: auto;
  }
  .map :global(.mk-gun.active b) { color: #f5a623; }

  .map :global(.mk-tgt i) {
    width: 10px; height: 10px; border-radius: 2px; background: #e5484d; transform: rotate(45deg);
  }
  .map :global(.mk-tgt.active i) { background: #f5a623; width: 12px; height: 12px; }
  .map :global(.mk-tgt.active b) { color: #f5a623; }

  .map :global(.mk-manual i) {
    width: 18px; height: 18px; border-radius: 50%; box-shadow: none;
    border: 2px solid #f5a623; outline: 1.5px solid rgba(0, 0, 0, 0.7);
    background: radial-gradient(circle, #f5a623 0 2px, transparent 2.5px);
  }

  @media (pointer: coarse) {
    .map :global(.mk-gun i) { width: 18px; height: 18px; }
    .map :global(.mk-gun.active i) { width: 20px; height: 20px; }
    .map :global(.mk-tgt i) { width: 13px; height: 13px; }
    .map :global(.mk-tgt.active i) { width: 15px; height: 15px; }
    .map :global(.mk span b) { font-size: 12px; }
  }
</style>
