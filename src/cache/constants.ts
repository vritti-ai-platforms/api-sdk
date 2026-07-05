// Injection token for the active cache provider — use this to inject ICacheProvider
export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');

// Injection token for LruCacheProvider construction options
export const LRU_CACHE_OPTIONS = Symbol('LRU_CACHE_OPTIONS');

// Injection token for the resolved CacheModuleOptions (used by forRootAsync)
export const CACHE_MODULE_OPTIONS = Symbol('CACHE_MODULE_OPTIONS');

// Default entry cap for the in-memory LRU provider when no max is configured
export const DEFAULT_LRU_MAX = 10000;
