// Config may be a value or a thunk. Servers pass a thunk when the credentials come from required-only-if-selected
// env keys, so reading them is deferred to the first resolve() instead of running at module construction.
export type StorageConfigSource<T> = T | (() => T);

// A backend configured nowhere is a deployment asking for something it was never given credentials for
export function readConfigSource<T>(source: StorageConfigSource<T> | undefined, provider: string): T {
  if (source === undefined) {
    throw new Error(`Storage provider '${provider}' is not configured.`);
  }
  return typeof source === 'function' ? (source as () => T)() : source;
}
