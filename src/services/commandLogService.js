/**
 * COMMAND LOG SERVICE
 * Log tous les appels de commandes pour audit et stats
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

class CommandLogService {
  /**
   * Logger une commande exécutée
   */
  static async logCommand({
    commandName,
    userId,
    username,
    guildId,
    guildName,
    arguments: args,
    success = true,
    errorMessage = null,
    executionTimeMs = 0
  }) {
    try {
      // Insérer dans DB (non-bloquant en async)
      db.none(
        `INSERT INTO command_logs 
         (command_name, user_id, username, guild_id, guild_name, arguments, success, error_message, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [commandName, userId, username, guildId, guildName, args ? JSON.stringify(args) : null, success, errorMessage, executionTimeMs]
      ).catch(err => console.error('[CommandLog] DB Error:', err));

      // Invalider cache des stats
      globalCache.invalidatePattern(`stats:command:${commandName}:*`);
      globalCache.invalidatePattern(`stats:guild:${guildId}:*`);
    } catch (error) {
      console.error('[CommandLogService] Error logging command:', error);
    }
  }

  /**
   * Obtenir les logs d'un utilisateur
   */
  static async getLogsByUser(userId, limit = 50) {
    try {
      return await db.any(
        'SELECT * FROM command_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
    } catch (error) {
      console.error('[CommandLogService] Error fetching user logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les logs d'un serveur
   */
  static async getLogsByGuild(guildId, limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM command_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2',
        [guildId, limit]
      );
    } catch (error) {
      console.error('[CommandLogService] Error fetching guild logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les logs d'une commande
   */
  static async getLogsByCommand(commandName, limit = 100) {
    try {
      return await db.any(
        'SELECT * FROM command_logs WHERE command_name = $1 ORDER BY created_at DESC LIMIT $2',
        [commandName, limit]
      );
    } catch (error) {
      console.error('[CommandLogService] Error fetching command logs:', error);
      return [];
    }
  }

  /**
   * Obtenir les stats des commandes
   * @returns {Object} Statistiques aggregées
   */
  static async getCommandStats() {
    try {
      // Vérifier cache
      const cacheKey = 'stats:commands:all';
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.any(`
        SELECT 
          command_name,
          COUNT(*) as total_uses,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
          ROUND(AVG(execution_time_ms), 2) as avg_execution_ms,
          MAX(execution_time_ms) as max_execution_ms,
          COUNT(DISTINCT user_id) as unique_users
        FROM command_logs
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY command_name
        ORDER BY total_uses DESC
      `);

      globalCache.set(cacheKey, stats, 3600); // Cache 1 heure
      return stats;
    } catch (error) {
      console.error('[CommandLogService] Error getting stats:', error);
      return [];
    }
  }

  /**
   * Obtenir les stats d'un serveur
   */
  static async getGuildStats(guildId) {
    try {
      const cacheKey = `stats:guild:${guildId}`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.one(`
        SELECT 
          COUNT(*) as total_commands,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT user_id) as unique_users,
          ROUND(AVG(execution_time_ms), 2) as avg_execution_ms
        FROM command_logs
        WHERE guild_id = $1
      `, [guildId]);

      globalCache.set(cacheKey, stats, 1800); // Cache 30 min
      return stats;
    } catch (error) {
      console.error('[CommandLogService] Error getting guild stats:', error);
      return null;
    }
  }

  /**
   * Obtenir les erreurs les plus fréquentes
   */
  static async getTopErrors(limit = 20) {
    try {
      return await db.any(`
        SELECT 
          command_name,
          error_message,
          COUNT(*) as count
        FROM command_logs
        WHERE success = false AND error_message IS NOT NULL
        GROUP BY command_name, error_message
        ORDER BY count DESC
        LIMIT $1
      `, [limit]);
    } catch (error) {
      console.error('[CommandLogService] Error getting top errors:', error);
      return [];
    }
  }

  /**
   * Nettoyer les vieux logs (archive)
   */
  static async cleanupOldLogs(daysToKeep = 90) {
    try {
      const result = await db.result(
        'DELETE FROM command_logs WHERE created_at < NOW() - INTERVAL \'$1 days\'',
        [daysToKeep]
      );
      return { rowsDeleted: result.rowCount };
    } catch (error) {
      console.error('[CommandLogService] Error cleaning logs:', error);
      return { rowsDeleted: 0 };
    }
  }
}

export default CommandLogService;
