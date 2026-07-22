/**
 * Moderation Manager - Phase 4.1
 * Gère warn/kick/ban/unban avec historique
 */

import db from './postgres.js';

/**
 * Add moderation action (warn/kick/ban)
 */
export async function addModerationAction(guildId, actionType, userId, moderatorId, reason = '', durationMs = null) {
  try {
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
    
    const action = await db.one(
      `INSERT INTO moderation_actions 
       (guild_id, action_type, user_id, moderator_id, reason, duration_ms, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING *`,
      [guildId, actionType, userId, moderatorId, reason, durationMs, expiresAt]
    );
    
    // Log to audit
    await db.none(
      'INSERT INTO audit_logs (action, user_id, guild_id, details, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
      ['moderation_action', moderatorId, guildId, JSON.stringify({
        action_type: actionType,
        target_user: userId,
        reason
      })]
    );
    
    return action;
  } catch (error) {
    console.error('[ModerationManager] Error adding action:', error);
    return null;
  }
}

/**
 * Get user moderation history
 */
export async function getUserModerationHistory(guildId, userId) {
  try {
    return await db.any(
      `SELECT * FROM moderation_actions 
       WHERE guild_id = $1 AND user_id = $2 
       ORDER BY created_at DESC`,
      [guildId, userId]
    );
  } catch (error) {
    console.error('[ModerationManager] Error getting history:', error);
    return [];
  }
}

/**
 * Get all active moderation actions for a guild
 */
export async function getActiveActions(guildId) {
  try {
    return await db.any(
      `SELECT * FROM moderation_actions 
       WHERE guild_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [guildId]
    );
  } catch (error) {
    console.error('[ModerationManager] Error getting active actions:', error);
    return [];
  }
}

/**
 * Check if user has active ban
 */
export async function hasActiveBan(guildId, userId) {
  try {
    const ban = await db.oneOrNone(
      `SELECT * FROM moderation_actions 
       WHERE guild_id = $1 AND user_id = $2 
       AND action_type = 'ban' AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [guildId, userId]
    );
    
    return !!ban;
  } catch (error) {
    console.error('[ModerationManager] Error checking ban:', error);
    return false;
  }
}

/**
 * Get active ban details
 */
export async function getActiveBan(guildId, userId) {
  try {
    return await db.oneOrNone(
      `SELECT * FROM moderation_actions 
       WHERE guild_id = $1 AND user_id = $2 
       AND action_type = 'ban' AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [guildId, userId]
    );
  } catch (error) {
    console.error('[ModerationManager] Error getting ban:', error);
    return null;
  }
}

/**
 * Count warns for user
 */
export async function getWarnCount(guildId, userId) {
  try {
    const result = await db.one(
      `SELECT COUNT(*) as count FROM moderation_actions 
       WHERE guild_id = $1 AND user_id = $2 
       AND action_type = 'warn' AND status = 'active'`,
      [guildId, userId]
    );
    
    return result.count;
  } catch (error) {
    console.error('[ModerationManager] Error counting warns:', error);
    return 0;
  }
}

/**
 * Remove moderation action
 */
export async function removeModerationAction(actionId, guildId, reason = '') {
  try {
    await db.none(
      `UPDATE moderation_actions 
       SET status = 'removed', expires_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND guild_id = $2`,
      [actionId, guildId]
    );
    
    return true;
  } catch (error) {
    console.error('[ModerationManager] Error removing action:', error);
    return false;
  }
}

/**
 * Clear all warns for user
 */
export async function clearWarns(guildId, userId) {
  try {
    await db.none(
      `UPDATE moderation_actions 
       SET status = 'cleared'
       WHERE guild_id = $1 AND user_id = $2 AND action_type = 'warn'`,
      [guildId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('[ModerationManager] Error clearing warns:', error);
    return false;
  }
}

/**
 * Check expired actions and cleanup
 */
export async function cleanupExpiredActions() {
  try {
    const now = new Date();
    
    // Find expired bans
    const expiredBans = await db.any(
      `SELECT * FROM moderation_actions 
       WHERE action_type = 'ban' AND status = 'active'
       AND expires_at IS NOT NULL AND expires_at < $1`,
      [now]
    );
    
    // Mark as expired
    for (const ban of expiredBans) {
      await db.none(
        `UPDATE moderation_actions 
         SET status = 'expired'
         WHERE id = $1`,
        [ban.id]
      );
    }
    
    console.log(`[ModerationManager] Cleaned up ${expiredBans.length} expired actions`);
    return expiredBans.length;
  } catch (error) {
    console.error('[ModerationManager] Error cleaning up expired actions:', error);
    return 0;
  }
}

/**
 * Get moderation statistics for guild
 */
export async function getModerationStats(guildId) {
  try {
    const warns = await db.one(
      `SELECT COUNT(*) as count FROM moderation_actions 
       WHERE guild_id = $1 AND action_type = 'warn' AND status = 'active'`,
      [guildId]
    );
    
    const kicks = await db.one(
      `SELECT COUNT(*) as count FROM moderation_actions 
       WHERE guild_id = $1 AND action_type = 'kick'`,
      [guildId]
    );
    
    const bans = await db.one(
      `SELECT COUNT(*) as count FROM moderation_actions 
       WHERE guild_id = $1 AND action_type = 'ban' AND status = 'active'`,
      [guildId]
    );
    
    return {
      active_warns: warns.count,
      total_kicks: kicks.count,
      active_bans: bans.count
    };
  } catch (error) {
    console.error('[ModerationManager] Error getting stats:', error);
    return { active_warns: 0, total_kicks: 0, active_bans: 0 };
  }
}

export default {
  addModerationAction,
  getUserModerationHistory,
  getActiveActions,
  hasActiveBan,
  getActiveBan,
  getWarnCount,
  removeModerationAction,
  clearWarns,
  cleanupExpiredActions,
  getModerationStats
};
