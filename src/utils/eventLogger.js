/**
 * Event Logger - Phase 6.1
 * Enregistrement des événements Discord
 */

import { getDb } from './database.js';

// Get database instance (automatically SQLite or PostgreSQL based on .env)
const db = getDb();

/**
 * Log event
 */
export async function logEvent(guildId, eventType, userId, channelId = null, details = '') {
  try {
    await db.none(
      `INSERT INTO discord_events (guild_id, event_type, target_id, executor_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [guildId, eventType, channelId, userId, details]
    );
  } catch (error) {
    console.error('[EventLogger] Error logging event:', error);
  }
}

/**
 * Log message event
 */
export async function logMessageEvent(guildId, userId, channelId, action, content = '') {
  return logEvent(guildId, `message_${action}`, userId, channelId, content.substring(0, 200));
}

/**
 * Log member event
 */
export async function logMemberEvent(guildId, userId, action, details = '') {
  return logEvent(guildId, `member_${action}`, userId, null, details);
}

/**
 * Log role event
 */
export async function logRoleEvent(guildId, userId, action, roleId, details = '') {
  return logEvent(guildId, `role_${action}`, userId, null, `${roleId}: ${details}`);
}

/**
 * Log channel event
 */
export async function logChannelEvent(guildId, userId, action, channelId, details = '') {
  return logEvent(guildId, `channel_${action}`, userId, channelId, details);
}

/**
 * Log moderation event
 */
export async function logModerationEvent(guildId, userId, action, targetId, reason = '') {
  return logEvent(guildId, `moderation_${action}`, userId, null, `Target: ${targetId}, Reason: ${reason}`);
}

/**
 * Get events for guild
 */
export async function getGuildEvents(guildId, limit = 100) {
  try {
    return await db.any(
      `SELECT * FROM discord_events WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [guildId, limit]
    );
  } catch (error) {
    console.error('[EventLogger] Error getting events:', error);
    return [];
  }
}

/**
 * Get events by type
 */
export async function getEventsByType(guildId, eventType, limit = 50) {
  try {
    return await db.any(
      `SELECT * FROM discord_events WHERE guild_id = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT $3`,
      [guildId, eventType, limit]
    );
  } catch (error) {
    console.error('[EventLogger] Error getting events:', error);
    return [];
  }
}

/**
 * Get events by user
 */
export async function getEventsByUser(guildId, userId, limit = 50) {
  try {
    return await db.any(
      `SELECT * FROM discord_events WHERE guild_id = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [guildId, userId, limit]
    );
  } catch (error) {
    console.error('[EventLogger] Error getting events:', error);
    return [];
  }
}

/**
 * Get events by date range
 */
export async function getEventsByDateRange(guildId, startDate, endDate, limit = 100) {
  try {
    return await db.any(
      `SELECT * FROM discord_events 
       WHERE guild_id = $1 AND created_at >= $2 AND created_at <= $3
       ORDER BY created_at DESC
       LIMIT $4`,
      [guildId, startDate, endDate, limit]
    );
  } catch (error) {
    console.error('[EventLogger] Error getting events:', error);
    return [];
  }
}

/**
 * Get event statistics
 */
export async function getEventStats(guildId, days = 7) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db.any(
      `SELECT event_type, COUNT(*) as count 
       FROM discord_events 
       WHERE guild_id = $1 AND created_at > $2
       GROUP BY event_type
       ORDER BY count DESC`,
      [guildId, since]
    );
    
    return result;
  } catch (error) {
    console.error('[EventLogger] Error getting stats:', error);
    return [];
  }
}

/**
 * Get top users by events
 */
export async function getTopEventUsers(guildId, limit = 10) {
  try {
    return await db.any(
      `SELECT target_id as user_id, COUNT(*) as count 
       FROM discord_events 
       WHERE guild_id = $1
       GROUP BY target_id
       ORDER BY count DESC
       LIMIT $2`,
      [guildId, limit]
    );
  } catch (error) {
    console.error('[EventLogger] Error getting top users:', error);
    return [];
  }
}

/**
 * Clear old events
 */
export async function clearOldEvents(guildId, days = 30) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db.result(
      `DELETE FROM discord_events WHERE guild_id = $1 AND created_at < $2`,
      [guildId, since]
    );
    
    return result.rowCount;
  } catch (error) {
    console.error('[EventLogger] Error clearing events:', error);
    return 0;
  }
}

export default {
  logEvent,
  logMessageEvent,
  logMemberEvent,
  logRoleEvent,
  logChannelEvent,
  logModerationEvent,
  getGuildEvents,
  getEventsByType,
  getEventsByUser,
  getEventsByDateRange,
  getEventStats,
  getTopEventUsers,
  clearOldEvents
};
