/**
 * LogPurgeService
 * Automatically purges old logs to keep database clean
 * Runs via cron job (scheduled in src/index.js)
 */

import db from '../utils/postgres.js';
import cron from 'node-cron';

class LogPurgeService {
  // Configuration (en jours)
  static RETENTION_POLICY = {
    command_logs: 30,      // Garder 30 jours
    error_logs: 60,        // Garder 60 jours
    middleware_performance: 30  // Garder 30 jours
  };

  /**
   * Initialize cron job for automatic purge
   */
  static initializePurgeSchedule() {
    // Exécuter la purge chaque jour à 2h du matin
    const schedule = '0 2 * * *'; // 02:00 every day
    
    cron.schedule(schedule, async () => {
      console.log('[LogPurgeService] Starting scheduled cleanup...');
      const result = await this.purgeOldLogs();
      if (result.success) {
        console.log(`[LogPurgeService] ✅ Cleanup completed: ${result.summary}`);
      } else {
        console.error(`[LogPurgeService] ❌ Cleanup failed: ${result.error}`);
      }
    });

    console.log(`[LogPurgeService] Purge schedule initialized (${schedule})`);
  }

  /**
   * Purge all old logs
   */
  static async purgeOldLogs() {
    try {
      const results = {};

      // Purge command_logs
      const cmdResult = await db.result(
        `DELETE FROM command_logs 
         WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.command_logs} day'`
      );
      results.command_logs = cmdResult.rowCount;

      // Purge error_logs
      const errResult = await db.result(
        `DELETE FROM error_logs 
         WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.error_logs} day'`
      );
      results.error_logs = errResult.rowCount;

      // Purge middleware_performance
      const perfResult = await db.result(
        `DELETE FROM middleware_performance 
         WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.middleware_performance} day'`
      );
      results.middleware_performance = perfResult.rowCount;

      const summary = `Deleted ${results.command_logs} command logs, ` +
        `${results.error_logs} error logs, ` +
        `${results.middleware_performance} perf records`;

      return {
        success: true,
        summary,
        details: results
      };
    } catch (error) {
      console.error('[LogPurgeService] Purge error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual purge (on-demand)
   */
  static async purgeManually(tableName = null) {
    try {
      if (tableName === 'command_logs') {
        const result = await db.result(
          `DELETE FROM command_logs 
           WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.command_logs} day'`
        );
        return { success: true, deleted: result.rowCount };
      }

      if (tableName === 'error_logs') {
        const result = await db.result(
          `DELETE FROM error_logs 
           WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.error_logs} day'`
        );
        return { success: true, deleted: result.rowCount };
      }

      if (tableName === 'middleware_performance') {
        const result = await db.result(
          `DELETE FROM middleware_performance 
           WHERE created_at < NOW() - INTERVAL '${this.RETENTION_POLICY.middleware_performance} day'`
        );
        return { success: true, deleted: result.rowCount };
      }

      // Purge all
      return await this.purgeOldLogs();
    } catch (error) {
      console.error('[LogPurgeService] Manual purge error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get log statistics (sizes, counts, etc.)
   */
  static async getLogStatistics() {
    try {
      const stats = await db.one(
        `SELECT
          (SELECT COUNT(*) FROM command_logs) as command_logs_count,
          (SELECT COUNT(*) FROM error_logs) as error_logs_count,
          (SELECT COUNT(*) FROM middleware_performance) as middleware_perf_count,
          (SELECT COALESCE(SUM(pg_total_relation_size(schemaname||'.'||tablename)), 0) 
           FROM pg_tables 
           WHERE tablename IN ('command_logs', 'error_logs', 'middleware_performance')
          ) as total_size_bytes,
          (SELECT MIN(created_at) FROM command_logs) as oldest_command_log,
          (SELECT MIN(created_at) FROM error_logs) as oldest_error_log,
          (SELECT MIN(created_at) FROM middleware_performance) as oldest_perf_log`
      );

      return {
        command_logs: parseInt(stats.command_logs_count),
        error_logs: parseInt(stats.error_logs_count),
        middleware_performance: parseInt(stats.middleware_perf_count),
        totalSizeBytes: parseInt(stats.total_size_bytes),
        totalSizeMB: Math.round(parseInt(stats.total_size_bytes) / (1024 * 1024)),
        oldestCommandLog: stats.oldest_command_log,
        oldestErrorLog: stats.oldest_error_log,
        oldestPerfLog: stats.oldest_perf_log,
        retentionPolicy: this.RETENTION_POLICY
      };
    } catch (error) {
      console.error('[LogPurgeService] Error getting statistics:', error);
      return { error: error.message };
    }
  }

  /**
   * Set custom retention policy
   */
  static setRetentionPolicy(policy) {
    if (policy.command_logs) this.RETENTION_POLICY.command_logs = policy.command_logs;
    if (policy.error_logs) this.RETENTION_POLICY.error_logs = policy.error_logs;
    if (policy.middleware_performance) this.RETENTION_POLICY.middleware_performance = policy.middleware_performance;
    
    console.log('[LogPurgeService] Retention policy updated:', this.RETENTION_POLICY);
  }
}

export default LogPurgeService;
