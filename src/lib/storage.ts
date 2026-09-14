// localStorage can throw (private mode, blocked storage); the app must run
// without it, so every access is guarded.

/**
 * The stored JSON decoded, or null when the key is absent, storage is blocked
 * or the text is not JSON. The caller parses the unknown into a type it wants;
 * nothing here vouches for the shape.
 */
export function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
