/**
 * CACHE MANAGEMENT SERVICE
 * Gère le cache centralisé avec TTL et invalidation
 * Objectif: Éviter les appels DB inutiles
 */

import { EventEmitter } from 'events';

class CacheManager extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.ttls = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Obtenir une valeur du cache
   * @param {string} key - Clé du cache
   * @returns {any} Valeur ou undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }

    // Vérifier TTL
    if (this.ttls.has(key) && this.ttls.get(key) < Date.now()) {
      this.cache.delete(key);
      this.ttls.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return this.cache.get(key);
  }

  /**
   * Stocker une valeur dans le cache
   * @param {string} key - Clé
   * @param {any} value - Valeur
   * @param {number} ttlSeconds - TTL en secondes (null = sans expiration)
   */
  set(key, value, ttlSeconds = 3600) {
    this.cache.set(key, value);
    
    if (ttlSeconds) {
      this.ttls.set(key, Date.now() + (ttlSeconds * 1000));
    } else {
      this.ttls.delete(key);
    }

    this.emit('cache:set', { key, ttl: ttlSeconds });
  }

  /**
   * Invalider une clé
   */
  invalidate(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
    this.emit('cache:invalidated', { key });
  }

  /**
   * Invalider par pattern (ex: "guild:*")
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.ttls.delete(key);
        count++;
      }
    }

    this.emit('cache:pattern-invalidated', { pattern, count });
    return count;
  }

  /**
   * Vider tout le cache
   */
  clear() {
    this.cache.clear();
    this.ttls.clear();
    this.emit('cache:cleared');
  }

  /**
   * Obtenir les stats du cache
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      total: total,
      hitRate: `${hitRate}%`,
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Réinitialiser les stats
   */
  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}

export const globalCache = new CacheManager();
export default CacheManager;
