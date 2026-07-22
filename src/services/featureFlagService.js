/**
 * FEATURE FLAGS SERVICE
 * Contrôle dynamique des features sans redémarrage
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

const CACHE_KEY_PREFIX = 'featureflag:';
const CACHE_TTL = 300; // 5 minutes

class FeatureFlagService {
  /**
   * Vérifier si un feature flag est activé
   * @param {string} flagName
   * @returns {boolean}
   */
  static async isEnabled(flagName) {
    try {
      // Vérifier cache d'abord
      const cacheKey = `${CACHE_KEY_PREFIX}${flagName}`;
      const cached = globalCache.get(cacheKey);
      if (cached !== undefined) return cached;

      // DB
      const flag = await db.oneOrNone(
        'SELECT enabled FROM feature_flags WHERE flag_name = $1',
        [flagName]
      );

      const result = flag?.enabled ?? false;
      globalCache.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      console.error(`[FeatureFlagService] Error checking flag ${flagName}:`, error);
      return false;
    }
  }

  /**
   * Obtenir tous les flags
   */
  static async getAllFlags() {
    try {
      const cached = globalCache.get('featureflags:all');
      if (cached) return cached;

      const flags = await db.any('SELECT * FROM feature_flags');
      const result = {};
      flags.forEach(f => {
        result[f.flag_name] = f.enabled;
      });

      globalCache.set('featureflags:all', result, CACHE_TTL);
      return result;
    } catch (error) {
      console.error('[FeatureFlagService] Error getting flags:', error);
      return {};
    }
  }

  /**
   * Activer/désactiver un flag
   */
  static async setFlag(flagName, enabled) {
    try {
      await db.none(
        'UPDATE feature_flags SET enabled = $1, updated_at = NOW() WHERE flag_name = $2',
        [enabled, flagName]
      );

      // Invalider le cache
      globalCache.invalidate(`${CACHE_KEY_PREFIX}${flagName}`);
      globalCache.invalidate('featureflags:all');

      return { success: true };
    } catch (error) {
      console.error(`[FeatureFlagService] Error setting flag ${flagName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize default flags (run on bot startup)
   */
  static async initializeDefaultFlags() {
    const defaultFlags = [
      { name: 'middleware_enabled', enabled: true, description: 'Enable global command middleware' },
      { name: 'performance_tracking_enabled', enabled: true, description: 'Track middleware performance' },
      { name: 'log_purge_enabled', enabled: true, description: 'Automatic log purging' }
    ];

    try {
      for (const flag of defaultFlags) {
        const exists = await db.oneOrNone(
          'SELECT id FROM feature_flags WHERE flag_name = $1',
          [flag.name]
        );

        if (!exists) {
          await db.none(
            'INSERT INTO feature_flags (flag_name, enabled, description) VALUES ($1, $2, $3)',
            [flag.name, flag.enabled, flag.description]
          );
          console.log(`[FeatureFlagService] ✅ Created flag: ${flag.name}`);
        }
      }

      globalCache.invalidate('featureflags:all');
      return { success: true };
    } catch (error) {
      console.error('[FeatureFlagService] Error initializing flags:', error);
      return { success: false, error: error.message };
    }
  }
}

export default FeatureFlagService;
