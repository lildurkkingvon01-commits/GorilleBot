import { getDb } from '../utils/database.js';

class ErrorLogService {
  /**
   * Initialize error_logs table if it doesn't exist
   */
  static async initTable() {
    try {
      const db = getDb();
      await db.query(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id SERIAL PRIMARY KEY,
          error_type VARCHAR(50) NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          command_name VARCHAR(100),
          user_id VARCHAR(50),
          guild_id VARCHAR(50),
          channel_id VARCHAR(50),
          severity VARCHAR(20) DEFAULT 'medium',
          resolved BOOLEAN DEFAULT false,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[ERROR LOG SERVICE] Table error_logs initialized');
    } catch (error) {
      console.error('[ERROR LOG SERVICE] Failed to initialize table:', error.message);
    }
  }

  /**
   * Log a command error
   */
  static async logCommandError(data) {
    try {
      const db = getDb();
      
      const query = `
        INSERT INTO error_logs 
        (error_type, error_message, error_stack, command_name, user_id, guild_id, severity, resolved, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at;
      `;

      const result = await db.query(query, [
        data.errorType || 'UNKNOWN_ERROR',
        data.errorMessage,
        data.errorStack,
        data.commandName,
        data.userId,
        data.guildId,
        data.severity || 'medium',
        data.resolved || false,
        JSON.stringify(data.metadata || {})
      ]);

      const row = result?.rows?.[0] || null;
      const logId = row?.id || null;
      const createdAt = row?.created_at || null;

      console.log(`[ERROR LOG] Logged error ${logId ? `#${logId}` : ''} - ${data.commandName || 'unknown'} by ${data.userId || 'unknown'}`);

      return { id: logId, createdAt };
    } catch (error) {
      console.error('[ERROR LOG SERVICE] Failed to log error:', error);
      throw error;
    }
  }

  /**
   * Get recent errors
   */
  static async getRecentErrors(limit = 50, guildId = null, commandName = null, unresolved = false) {
    try {
      const db = getDb();
      
      let query = 'SELECT * FROM error_logs WHERE 1=1';
      const params = [];
      
      if (guildId) {
        query += ` AND guild_id = $${params.length + 1}`;
        params.push(guildId);
      }
      
      if (commandName) {
        query += ` AND command_name = $${params.length + 1}`;
        params.push(commandName);
      }
      
      if (unresolved) {
        query += ` AND resolved = false`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('[ERROR LOG SERVICE] Failed to get recent errors:', error);
      return [];
    }
  }

  /**
   * Mark error as resolved
   */
  static async markAsResolved(errorId) {
    try {
      const db = getDb();
      
      const result = await db.query(
        `UPDATE error_logs 
         SET resolved = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id;`,
        [errorId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('[ERROR LOG SERVICE] Failed to mark as resolved:', error);
      return false;
    }
  }

  /**
   * Get error stats
   */
  static async getErrorStats(guildId = null) {
    try {
      const db = getDb();
      
      let whereClause = '1=1';
      const params = [];
      
      if (guildId) {
        whereClause = `guild_id = $1`;
        params.push(guildId);
      }
      
      const result = await db.query(`
        SELECT 
          error_type,
          command_name,
          COUNT(*) as count,
          SUM(CASE WHEN resolved THEN 1 ELSE 0 END) as resolved_count,
          MAX(created_at) as last_error
        FROM error_logs
        WHERE ${whereClause}
        GROUP BY error_type, command_name
        ORDER BY count DESC;
      `, params);
      
      return result.rows;
    } catch (error) {
      console.error('[ERROR LOG SERVICE] Failed to get error stats:', error);
      return [];
    }
  }
}

export default ErrorLogService;
