/**
 * HEALTH MONITORING SERVICE
 * Monitore la santé du bot
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

class HealthMonitoringService {
  /**
   * Enregistrer un check de santé
   */
  static async recordHealthCheck(checkName, isHealthy, message = null, details = {}) {
    try {
      const severity = isHealthy ? 'info' : 'warning';

      await db.none(
        `INSERT INTO health_monitoring (check_name, is_healthy, message, details, severity)
         VALUES ($1, $2, $3, $4, $5)`,
        [checkName, isHealthy, message, JSON.stringify(details), severity]
      );

      // Invalider cache
      globalCache.invalidate(`health:latest`);
    } catch (error) {
      console.error('[HealthMonitoringService] Error recording check:', error);
    }
  }

  /**
   * Obtenir l'état général du bot
   */
  static async getSystemHealth() {
    try {
      const cacheKey = 'health:latest';
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      // DB health
      const dbCheck = await this.checkDatabaseHealth();
      
      // Cache health
      const cacheStats = globalCache.getStats();
      const cacheHealthy = cacheStats.hitRate > 0.3; // Au moins 30% hit rate

      const overallHealthy = dbCheck && cacheHealthy;

      const health = {
        status: overallHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        database: {
          healthy: dbCheck,
          lastChecked: new Date()
        },
        cache: {
          healthy: cacheHealthy,
          hitRate: cacheStats.hitRate,
          stats: cacheStats
        }
      };

      globalCache.set(cacheKey, health, 300); // Cache 5 min
      return health;
    } catch (error) {
      console.error('[HealthMonitoringService] Error getting system health:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Vérifier la santé de la DB
   */
  static async checkDatabaseHealth() {
    try {
      const result = await db.one('SELECT 1 as status');
      return !!result;
    } catch (error) {
      console.error('[HealthMonitoringService] Database check failed:', error);
      return false;
    }
  }

  /**
   * Obtenir les vérifications récentes
   */
  static async getRecentChecks(limit = 50) {
    try {
      return await db.any(
        'SELECT * FROM health_monitoring ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    } catch (error) {
      console.error('[HealthMonitoringService] Error fetching checks:', error);
      return [];
    }
  }

  /**
   * Obtenir un résumé de santé par vérification
   */
  static async getHealthSummary(hoursBack = 24) {
    try {
      return await db.any(`
        SELECT 
          check_name,
          COUNT(*) as total_checks,
          SUM(CASE WHEN is_healthy THEN 1 ELSE 0 END) as healthy_count,
          ROUND(100.0 * SUM(CASE WHEN is_healthy THEN 1 ELSE 0 END) / COUNT(*), 1) as health_percentage,
          MAX(created_at) as last_check
        FROM health_monitoring
        WHERE created_at > NOW() - INTERVAL '${hoursBack} hours'
        GROUP BY check_name
        ORDER BY health_percentage ASC
      `);
    } catch (error) {
      console.error('[HealthMonitoringService] Error getting summary:', error);
      return [];
    }
  }
}

export default HealthMonitoringService;
