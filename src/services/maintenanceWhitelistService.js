import db from '../utils/postgres.js';

class MaintenanceWhitelistService {
  /**
   * Check if user is whitelisted (checks global or command-specific with expiration)
   * @param {string} userId - User ID
   * @param {string} commandName - Optional command name for command-specific check
   * @returns {boolean} true if whitelisted and not expired
   */
  static async isWhitelisted(userId, commandName = null) {
    try {
      let query = `
        SELECT id, user_id, scope, command_name, expires_at 
        FROM maintenance_whitelist 
        WHERE user_id = $1 
        AND (expires_at IS NULL OR expires_at > NOW())
      `;
      const params = [userId];

      if (commandName) {
        // Check for command-specific whitelist OR global whitelist
        query += ` AND (scope = 'global' OR (scope = 'command' AND command_name = $2))`;
        params.push(commandName);
      } else {
        // Check for global whitelist only
        query += ` AND scope = 'global'`;
      }

      query += ` LIMIT 1`;

      const result = await db.oneOrNone(query, params);
      const whitelisted = !!result;
      if (whitelisted) {
        console.log(`[WHITELIST] User ${userId} is whitelisted${commandName ? ` for command ${commandName}` : ' (global)'}`);
      }
      return whitelisted;
    } catch (error) {
      console.error('[WHITELIST CHECK ERROR]', error.message);
      return false;
    }
  }

  /**
   * Add user to whitelist with scope and optional expiration
   * @param {string} userId - User ID
   * @param {string} reason - Reason for whitelist
   * @param {string} scope - 'global' or 'command'
   * @param {string} commandName - Optional command name (required if scope='command')
   * @param {string} expiresAt - Optional ISO timestamp for expiration
   * @param {string} addedBy - User ID who added the whitelist
   */
  static async addUser(userId, reason, scope = 'global', commandName = null, expiresAt = null, addedBy = null) {
    try {
      if (!reason) {
        throw new Error('Reason is required');
      }

      const result = await db.result(
        `INSERT INTO maintenance_whitelist (user_id, command_name, scope, reason, expires_at, added_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [userId, commandName, scope, reason, expiresAt, addedBy]
      );

      console.log(`[WHITELIST] Added user ${userId} to whitelist (scope: ${scope}, command: ${commandName || 'N/A'}). Reason: ${reason}`);
      return result.rowCount > 0;
    } catch (error) {
      console.error('[WHITELIST ADD ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Remove user from whitelist by ID
   * @param {number} id - Whitelist entry ID
   */
  static async removeEntry(id) {
    try {
      const result = await db.result(
        `DELETE FROM maintenance_whitelist WHERE id = $1`,
        [id]
      );
      const removed = result.rowCount > 0;
      if (removed) {
        console.log(`[WHITELIST] Removed whitelist entry ${id}`);
      }
      return removed;
    } catch (error) {
      console.error('[WHITELIST REMOVE ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Get all whitelisted entries (with optional filter by scope)
   */
  static async getAllWhitelisted(scope = null) {
    try {
      let query = `SELECT id, user_id, command_name, scope, reason, expires_at, added_by, created_at FROM maintenance_whitelist`;
      const params = [];

      if (scope) {
        query += ` WHERE scope = $1`;
        params.push(scope);
      }

      query += ` ORDER BY created_at DESC`;

      const users = await db.any(query, params);
      console.log(`[WHITELIST] Retrieved ${users.length} whitelisted entries${scope ? ` (scope: ${scope})` : ''}`);
      return users;
    } catch (error) {
      console.error('[WHITELIST GET ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Get whitelist entries for a specific user
   */
  static async getUserWhitelistEntries(userId) {
    try {
      const entries = await db.any(
        `SELECT id, user_id, command_name, scope, reason, expires_at, added_by, created_at 
         FROM maintenance_whitelist 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );
      return entries;
    } catch (error) {
      console.error('[WHITELIST USER ENTRIES ERROR]', error.message);
      return [];
    }
  }

  /**
   * Get whitelist count
   */
  static async getWhitelistCount(scope = null) {
    try {
      let query = `SELECT COUNT(*) as count FROM maintenance_whitelist`;
      const params = [];

      if (scope) {
        query += ` WHERE scope = $1`;
        params.push(scope);
      }

      const result = await db.one(query, params);
      return result.count;
    } catch (error) {
      console.error('[WHITELIST COUNT ERROR]', error.message);
      return 0;
    }
  }

  /**
   * Parse duration string and return milliseconds
   * @param {string} duration - Duration like '30m', '2h', '1d', '7d', or empty for permanent
   * @returns {number|null} milliseconds or null for permanent
   */
  static parseDuration(duration) {
    if (!duration || duration === 'permanent') return null;

    const units = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) return null;

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Get expiration timestamp from duration
   * @param {string} duration - Duration like '30m', '2h', '1d', '7d', or empty
   * @returns {string|null} ISO timestamp or null
   */
  static getExpirationTimestamp(duration) {
    if (!duration) return null;
    const ms = this.parseDuration(duration);
    if (ms === null) return null;
    return new Date(Date.now() + ms).toISOString();
  }
}

export default MaintenanceWhitelistService;
