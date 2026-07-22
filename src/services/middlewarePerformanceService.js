/**
 * MiddlewarePerformanceService
 * Tracks middleware execution performance and metrics
 */

import db from '../utils/postgres.js';
import { globalCache } from './cacheService.js';

class MiddlewarePerformanceService {
  /**
   * Log middleware execution performance
   */
  static async recordPerformance({
    middlewareName = 'GlobalCommandMiddleware',
    commandName,
    userId,
    executionTimeMs,
    checksPerformed = {},
    result = 'passed', // passed, blocked, error
    blockedReason = null
  }) {
    try {
      await db.none(
        `INSERT INTO middleware_performance 
         (middleware_name, command_name, user_id, execution_time_ms, checks_performed, result, blocked_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          middlewareName,
          commandName,
          userId,
          Math.round(executionTimeMs),
          JSON.stringify(checksPerformed),
          result,
          blockedReason
        ]
      );

      // Invalidate cache
      globalCache.invalidate('middleware:stats');
      
      return { success: true };
    } catch (error) {
      console.error('[MiddlewarePerformanceService] Error recording performance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get performance statistics
   */
  static async getStats(hours = 1) {
    try {
      const cacheKey = `middleware:stats:${hours}h`;
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const stats = await db.one(
        `SELECT
          COUNT(*) as total_executions,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          MIN(execution_time_ms) as min_execution_time,
          SUM(CASE WHEN result = 'passed' THEN 1 ELSE 0 END) as passed_count,
          SUM(CASE WHEN result = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
          SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END) as error_count
        FROM middleware_performance
        WHERE created_at > NOW() - INTERVAL '${hours} hour'`,
      );

      // Format response
      const response = {
        totalExecutions: parseInt(stats.total_executions),
        avgExecutionTime: Math.round(parseFloat(stats.avg_execution_time) || 0),
        maxExecutionTime: parseInt(stats.max_execution_time),
        minExecutionTime: parseInt(stats.min_execution_time),
        passedCount: parseInt(stats.passed_count),
        blockedCount: parseInt(stats.blocked_count),
        errorCount: parseInt(stats.error_count),
        successRate: stats.total_executions > 0 
          ? Math.round((stats.passed_count / stats.total_executions) * 100)
          : 0,
        period: `${hours}h`,
        timestamp: new Date().toISOString()
      };

      // Cache for 5 minutes
      globalCache.set(cacheKey, response, 300);

      return response;
    } catch (error) {
      console.error('[MiddlewarePerformanceService] Error getting stats:', error);
      return {
        totalExecutions: 0,
        avgExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0,
        passedCount: 0,
        blockedCount: 0,
        errorCount: 0,
        successRate: 0,
        period: `${hours}h`,
        error: error.message
      };
    }
  }

  /**
   * Get performance by command
   */
  static async getStatsByCommand(hours = 1) {
    try {
      const stats = await db.any(
        `SELECT
          command_name,
          COUNT(*) as executions,
          AVG(execution_time_ms) as avg_time,
          MAX(execution_time_ms) as max_time,
          SUM(CASE WHEN result = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN result = 'blocked' THEN 1 ELSE 0 END) as blocked
        FROM middleware_performance
        WHERE created_at > NOW() - INTERVAL '${hours} hour'
        GROUP BY command_name
        ORDER BY avg_time DESC`,
      );

      return stats.map(s => ({
        commandName: s.command_name,
        executions: parseInt(s.executions),
        avgTime: Math.round(parseFloat(s.avg_time) || 0),
        maxTime: parseInt(s.max_time),
        passed: parseInt(s.passed),
        blocked: parseInt(s.blocked)
      }));
    } catch (error) {
      console.error('[MiddlewarePerformanceService] Error getting command stats:', error);
      return [];
    }
  }

  /**
   * Get slowest checks
   */
  static async getSlowestChecks(limit = 10) {
    try {
      const records = await db.any(
        `SELECT
          middleware_name,
          command_name,
          execution_time_ms,
          result,
          created_at
        FROM middleware_performance
        ORDER BY execution_time_ms DESC
        LIMIT $1`,
        [limit]
      );

      return records;
    } catch (error) {
      console.error('[MiddlewarePerformanceService] Error getting slowest checks:', error);
      return [];
    }
  }

  /**
   * Get blocked reasons summary
   */
  static async getBlockedReasons(hours = 1) {
    try {
      const stats = await db.any(
        `SELECT
          blocked_reason,
          COUNT(*) as count
        FROM middleware_performance
        WHERE result = 'blocked'
        AND created_at > NOW() - INTERVAL '${hours} hour'
        GROUP BY blocked_reason
        ORDER BY count DESC`,
      );

      return stats.map(s => ({
        reason: s.blocked_reason,
        count: parseInt(s.count)
      }));
    } catch (error) {
      console.error('[MiddlewarePerformanceService] Error getting blocked reasons:', error);
      return [];
    }
  }
}

export default MiddlewarePerformanceService;
