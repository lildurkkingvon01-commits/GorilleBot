/**
 * STATS SERVICE
 * Collecte et agrège les statistiques d'utilisation
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

class StatsService {
  /**
   * Enregistrer l'exécution d'une commande
   */
  static async recordCommandExecution(commandName, guildId, executionTimeMs) {
    try {
      // Obtenir la date du jour au format YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];

      // Insérer ou mettre à jour les stats
      await db.none(
        `INSERT INTO guild_stats (guild_id, command_name, stat_date, execution_count, total_execution_time_ms, min_execution_ms, max_execution_ms)
         VALUES ($1, $2, $3, 1, $4, $5, $6)
         ON CONFLICT (guild_id, command_name, stat_date) DO UPDATE SET 
           execution_count = guild_stats.execution_count + 1,
           total_execution_time_ms = guild_stats.total_execution_time_ms + $4,
           max_execution_ms = GREATEST(guild_stats.max_execution_ms, $5),
           min_execution_ms = LEAST(guild_stats.min_execution_ms, $6)`,
        [guildId, commandName, today, executionTimeMs, executionTimeMs, executionTimeMs]
      );

      // Invalider cache
      globalCache.invalidatePattern(`stats:${guildId}:*`);
    } catch (error) {
      console.error('[StatsService] Error recording execution:', error);
    }
  }

  /**
   * Obtenir les stats globales
   */
  static async getGlobalStats(days = 30) {
    try {
      const cacheKey = `stats:global:${days}`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.one(`
        SELECT 
          COUNT(DISTINCT guild_id) as unique_guilds,
          COUNT(DISTINCT command_name) as unique_commands,
          SUM(execution_count) as total_executions,
          ROUND(AVG(total_execution_time_ms::numeric / execution_count), 2) as avg_execution_ms,
          MAX(max_execution_ms) as max_execution_ms
        FROM guild_stats
        WHERE stat_date > CURRENT_DATE - INTERVAL '${days} days'
      `);

      globalCache.set(cacheKey, stats, 3600);
      return stats;
    } catch (error) {
      console.error('[StatsService] Error getting global stats:', error);
      return null;
    }
  }

  /**
   * Obtenir les stats d'un serveur
   */
  static async getGuildStats(guildId, days = 30) {
    try {
      const cacheKey = `stats:guild:${guildId}:${days}`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.any(`
        SELECT 
          command_name,
          SUM(execution_count) as total_uses,
          ROUND(AVG(total_execution_time_ms::numeric / execution_count), 2) as avg_time_ms,
          MAX(max_execution_ms) as max_time_ms,
          MIN(min_execution_ms) as min_time_ms
        FROM guild_stats
        WHERE guild_id = $1 AND stat_date > CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY command_name
        ORDER BY total_uses DESC
      `, [guildId]);

      globalCache.set(cacheKey, stats, 1800);
      return stats;
    } catch (error) {
      console.error('[StatsService] Error getting guild stats:', error);
      return [];
    }
  }

  /**
   * Obtenir les stats d'une commande
   */
  static async getCommandStats(commandName, days = 30) {
    try {
      const cacheKey = `stats:command:${commandName}:${days}`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.any(`
        SELECT 
          guild_id,
          stat_date,
          execution_count,
          ROUND(total_execution_time_ms::numeric / execution_count, 2) as avg_time_ms
        FROM guild_stats
        WHERE command_name = $1 AND stat_date > CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY stat_date DESC, execution_count DESC
      `, [commandName]);

      globalCache.set(cacheKey, stats, 1800);
      return stats;
    } catch (error) {
      console.error('[StatsService] Error getting command stats:', error);
      return [];
    }
  }

  /**
   * Obtenir les commandes les plus populaires
   */
  static async getTopCommands(limit = 10, days = 30) {
    try {
      const cacheKey = `stats:top:${limit}:${days}`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const top = await db.any(`
        SELECT 
          command_name,
          SUM(execution_count) as total_uses,
          COUNT(DISTINCT guild_id) as unique_guilds,
          ROUND(AVG(total_execution_time_ms::numeric / execution_count), 2) as avg_time_ms
        FROM guild_stats
        WHERE stat_date > CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY command_name
        ORDER BY total_uses DESC
        LIMIT $1
      `, [limit]);

      globalCache.set(cacheKey, top, 3600);
      return top;
    } catch (error) {
      console.error('[StatsService] Error getting top commands:', error);
      return [];
    }
  }
}

export default StatsService;
