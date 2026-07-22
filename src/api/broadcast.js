/**
 * Broadcast API Handler
 * Manages broadcast operations for the admin panel
 */

import db from '../utils/postgres.js';
import * as database from '../utils/database.js';

/**
 * Send a broadcast message to a channel
 * @param {Object} params
 * @param {string} params.guildId - Discord guild ID
 * @param {string} params.message - Message to broadcast
 * @param {string} params.channelId - Target channel ID (optional, uses config if not provided)
 * @param {string} params.userId - User ID who initiated broadcast
 * @returns {Promise<Object>} {success, broadcastId, message}
 */
export async function sendBroadcast({ guildId, message, channelId, userId }) {
  try {
    // Validate inputs
    if (!guildId || !message) {
      return { success: false, error: 'Guild ID and message are required' };
    }

    if (message.length > 2000) {
      return { success: false, error: 'Message exceeds 2000 character limit' };
    }

    // Get channel from config if not provided
    let targetChannel = channelId;
    if (!targetChannel) {
      targetChannel = await database.getBroadcastChannel(guildId);
      if (!targetChannel) {
        return { success: false, error: 'No broadcast channel configured for this server' };
      }
    }

    // Log broadcast to audit_logs
    const broadcastLog = await database.addAuditLog(
      guildId,
      userId,
      'broadcast_sent',
      JSON.stringify({
        message: message.substring(0, 200),
        channelId: targetChannel,
        fullMessage: message,
        timestamp: new Date().toISOString()
      })
    );

    if (!broadcastLog) {
      return { success: false, error: 'Failed to log broadcast' };
    }

    return {
      success: true,
      broadcastId: broadcastLog.id,
      message: 'Broadcast queued for sending',
      details: {
        guildId,
        channelId: targetChannel,
        messageLength: message.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[API] Broadcast error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule a broadcast for later
 * @param {Object} params
 * @param {string} params.guildId - Discord guild ID
 * @param {string} params.message - Message to broadcast
 * @param {Date} params.scheduledTime - When to send
 * @param {string} params.userId - User ID who initiated
 * @returns {Promise<Object>} {success, scheduleId}
 */
export async function scheduleBroadcast({ guildId, message, scheduledTime, userId }) {
  try {
    // Validate
    if (!guildId || !message || !scheduledTime) {
      return { success: false, error: 'All parameters required' };
    }

    const scheduled = new Date(scheduledTime);
    if (scheduled < new Date()) {
      return { success: false, error: 'Scheduled time must be in the future' };
    }

    // Log scheduled broadcast
    const scheduleLog = await database.addAuditLog(
      guildId,
      userId,
      'broadcast_scheduled',
      JSON.stringify({
        message: message.substring(0, 200),
        scheduledTime: scheduled.toISOString(),
        fullMessage: message
      })
    );

    return {
      success: true,
      scheduleId: scheduleLog.id,
      message: 'Broadcast scheduled',
      details: {
        scheduledTime: scheduled.toISOString()
      }
    };
  } catch (error) {
    console.error('[API] Schedule broadcast error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get broadcast history for a guild
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Number of broadcasts to retrieve
 * @returns {Promise<Array>}
 */
export async function getBroadcastHistory(guildId, limit = 10) {
  try {
    return await db.any(
      `SELECT * FROM audit_logs 
       WHERE guild_id = $1 AND action IN ('broadcast_sent', 'broadcast_scheduled')
       ORDER BY created_at DESC
       LIMIT $2`,
      [guildId, limit]
    );
  } catch (error) {
    console.error('[API] Get broadcast history error:', error);
    return [];
  }
}

/**
 * Cancel a scheduled broadcast
 * @param {string} guildId - Discord guild ID
 * @param {string} scheduleId - Audit log ID of scheduled broadcast
 * @param {string} userId - User ID who initiated cancellation
 * @returns {Promise<Object>}
 */
export async function cancelScheduledBroadcast(guildId, scheduleId, userId) {
  try {
    const broadcast = await db.oneOrNone(
      'SELECT * FROM audit_logs WHERE id = $1 AND guild_id = $2 AND action = $3',
      [scheduleId, guildId, 'broadcast_scheduled']
    );

    if (!broadcast) {
      return { success: false, error: 'Scheduled broadcast not found' };
    }

    // Log cancellation
    await database.addAuditLog(
      guildId,
      userId,
      'broadcast_cancelled',
      JSON.stringify({
        originalScheduleId: scheduleId,
        cancelledAt: new Date().toISOString()
      })
    );

    return { success: true, message: 'Broadcast cancelled' };
  } catch (error) {
    console.error('[API] Cancel broadcast error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update broadcast channel configuration
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - New channel ID
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>}
 */
export async function updateBroadcastChannel(guildId, channelId, userId) {
  try {
    // Update config
    const result = await database.setBroadcastChannel(guildId, channelId);

    if (!result.success) {
      return { success: false, error: 'Failed to update broadcast channel' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'broadcast_channel_updated',
      JSON.stringify({
        newChannelId: channelId,
        timestamp: new Date().toISOString()
      })
    );

    return { success: true, message: 'Broadcast channel updated' };
  } catch (error) {
    console.error('[API] Update broadcast channel error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendBroadcast,
  scheduleBroadcast,
  getBroadcastHistory,
  cancelScheduledBroadcast,
  updateBroadcastChannel
};
