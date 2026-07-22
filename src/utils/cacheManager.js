// Cache Manager Stub - PostgreSQL handles everything now
export function startCacheRefresh() {
  console.log("[Cache] PostgreSQL initialized - caching disabled");
}
export function stopCacheRefresh() {}
export function isCacheInitialized() { return true; }
export function getPlayersCache() { return []; }
export function getSavesCache() { return []; }
export async function updateAllCaches() { return true; }
