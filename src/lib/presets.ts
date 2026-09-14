// The maps every install starts with. Each file under src/data is a map as
// the app exports it (Edit -> Export), dropped in unchanged; the ids inside
// are what later builds match on. Bump PRESETS_VERSION after editing one so
// installs that already have these maps merge the change in.
import bakurani from '../data/bakurani.json';
import ozeti from '../data/ozeti.json';
import zestafona from '../data/zestafona.json';
import { libraryFromJSON, type Library } from './library';

export const PRESETS_VERSION = 1;

export function presetLibrary(): Library {
  const maps = [bakurani, ozeti, zestafona].flatMap((file) => libraryFromJSON(file).maps);
  return { version: 1, maps };
}
