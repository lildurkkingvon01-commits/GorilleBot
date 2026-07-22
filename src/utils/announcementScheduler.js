/**
 * Announcement Scheduler - Phase 5.1
 * Création et programmation des annonces
 */

import db from './postgres.js';
import cron from 'node-cron';

const jobs = new Map(); // {guildId:announcementId: cronJob}

/**
 * Create announcement
 */
export async function createAnnouncement(guildId, channelId, title, content, scheduledAt = null) {
  try {
    const result = await db.one(
      `INSERT INTO announcements (guild_id, channel_id, title, content, scheduled_at, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [guildId, channelId, title, content, scheduledAt]
    );
    
    return result;
  } catch (error) {
    console.error('[AnnouncementScheduler] Error creating announcement:', error);
    throw error;
  }
}

/**
 * Get announcements for guild
 */
export async function getAnnouncements(guildId) {
  try {
    return await db.any(
      `SELECT * FROM announcements WHERE guild_id = $1 ORDER BY created_at DESC`,
      [guildId]
    );
  } catch (error) {
    console.error('[AnnouncementScheduler] Error getting announcements:', error);
    return [];
  }
}

/**
 * Get single announcement
 */
export async function getAnnouncement(id) {
  try {
    return await db.one(
      `SELECT * FROM announcements WHERE id = $1`,
      [id]
    );
  } catch (error) {
    console.error('[AnnouncementScheduler] Error getting announcement:', error);
    return null;
  }
}

/**
 * Update announcement
 */
export async function updateAnnouncement(id, title, content, channelId, scheduledAt) {
  try {
    await db.none(
      `UPDATE announcements 
       SET title = $2, content = $3, channel_id = $4, scheduled_at = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, title, content, channelId, scheduledAt]
    );
    
    return true;
  } catch (error) {
    console.error('[AnnouncementScheduler] Error updating announcement:', error);
    return false;
  }
}

/**
 * Delete announcement
 */
export async function deleteAnnouncement(id, guildId) {
  try {
    const key = `${guildId}:${id}`;
    
    // Stop job if exists
    if (jobs.has(key)) {
      jobs.get(key).stop();
      jobs.delete(key);
    }
    
    await db.none(
      `DELETE FROM announcements WHERE id = $1 AND guild_id = $2`,
      [id, guildId]
    );
    
    return true;
  } catch (error) {
    console.error('[AnnouncementScheduler] Error deleting announcement:', error);
    return false;
  }
}

/**
 * Send announcement immediately
 */
export async function sendAnnouncement(id, bot) {
  try {
    const announcement = await getAnnouncement(id);
    if (!announcement) return false;
    
    const channel = await bot.channels.fetch(announcement.channel_id);
    if (!channel || !channel.send) return false;
    
    await channel.send({
      embeds: [{
        title: announcement.title,
        description: announcement.content,
        timestamp: new Date(),
        color: 0x7289da
      }]
    });
    
    // Update sent_at
    await db.none(
      `UPDATE announcements SET sent_at = CURRENT_TIMESTAMP, status = 'sent' WHERE id = $1`,
      [id]
    );
    
    return true;
  } catch (error) {
    console.error('[AnnouncementScheduler] Error sending announcement:', error);
    return false;
  }
}

/**
 * Initialize scheduler - check for pending announcements
 */
export async function initializeScheduler(bot) {
  try {
    // Get all pending announcements
    const pending = await db.any(
      `SELECT * FROM announcements WHERE status = 'pending' AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC`
    );
    
    for (const announcement of pending) {
      const scheduledTime = new Date(announcement.scheduled_at);
      const now = new Date();
      
      if (scheduledTime <= now) {
        // Send immediately if already past scheduled time
        await sendAnnouncement(announcement.id, bot);
      } else {
        // Schedule for later
        const delay = scheduledTime.getTime() - now.getTime();
        setTimeout(() => {
          sendAnnouncement(announcement.id, bot);
        }, delay);
      }
    }
    
    console.log(`[AnnouncementScheduler] Initialized with ${pending.length} pending announcements`);
  } catch (error) {
    console.error('[AnnouncementScheduler] Error initializing:', error);
  }
}

/**
 * Get announcement stats
 */
export async function getAnnouncementStats(guildId) {
  try {
    const total = await db.one(
      `SELECT COUNT(*) as count FROM announcements WHERE guild_id = $1`,
      [guildId]
    );
    
    const pending = await db.one(
      `SELECT COUNT(*) as count FROM announcements WHERE guild_id = $1 AND status = 'pending'`,
      [guildId]
    );
    
    const sent = await db.one(
      `SELECT COUNT(*) as count FROM announcements WHERE guild_id = $1 AND status = 'sent'`,
      [guildId]
    );
    
    return {
      total: parseInt(total.count),
      pending: parseInt(pending.count),
      sent: parseInt(sent.count)
    };
  } catch (error) {
    console.error('[AnnouncementScheduler] Error getting stats:', error);
    return { total: 0, pending: 0, sent: 0 };
  }
}

export default {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  sendAnnouncement,
  initializeScheduler,
  getAnnouncementStats
};
